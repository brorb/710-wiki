import sourceMapSupport from "source-map-support"
import path from "path"
import { PerfTimer } from "./util/perf"
import { rm } from "fs/promises"
import { GlobbyFilterFunction, isGitIgnored } from "globby"
import { styleText } from "util"
import { parseMarkdown } from "./processors/parse"
import { filterContent } from "./processors/filter"
import { emitContent } from "./processors/emit"
import cfg from "../quartz.config"
import { FilePath, joinSegments, slugifyFilePath } from "./util/path"
import chokidar from "chokidar"
import { ProcessedContent } from "./plugins/vfile"
import { Argv, BuildCtx } from "./util/ctx"
import { glob, toPosixPath } from "./util/glob"
import { trace } from "./util/trace"
import { options } from "./util/sourcemap"
import { Mutex } from "async-mutex"
import { getStaticResourcesFromPlugins } from "./plugins"
import { randomIdNonSecure } from "./util/random"
import { ChangeEvent } from "./plugins/types"
import { minimatch } from "minimatch"

sourceMapSupport.install(options)

type ContentMap = Map<
  FilePath,
  | {
      type: "markdown"
      content: ProcessedContent
    }
  | {
      type: "other"
    }
>

type BuildData = {
  ctx: BuildCtx
  ignored: GlobbyFilterFunction
  mut: Mutex
  contentMap: ContentMap
  changesSinceLastBuild: Record<FilePath, ChangeEvent["type"]>
}

async function buildQuartz(argv: Argv, mut: Mutex, clientRefresh: () => void) {
  const ctx: BuildCtx = {
    buildId: randomIdNonSecure(),
    argv,
    cfg,
    allSlugs: [],
    allFiles: [],
    incremental: false,
  }

  const perf = new PerfTimer()
  const output = argv.output
  let parsedFiles: ProcessedContent[] = []

  const pluginCount = Object.values(cfg.plugins).flat().length
  const pluginNames = (key: "transformers" | "filters" | "emitters") =>
    cfg.plugins[key].map((plugin) => plugin.name)
  if (argv.verbose) {
    console.log(`Loaded ${pluginCount} plugins`)
    console.log(`  Transformers: ${pluginNames("transformers").join(", ")}`)
    console.log(`  Filters: ${pluginNames("filters").join(", ")}`)
    console.log(`  Emitters: ${pluginNames("emitters").join(", ")}`)
  }

  const release = await mut.acquire()
  try {
    perf.addEvent("clean")
    await rm(output, { recursive: true, force: true })
    console.log(`Cleaned output directory \`${output}\` in ${perf.timeSince("clean")}`)

    perf.addEvent("glob")
    const allFiles = await glob("**/*.*", argv.directory, cfg.configuration.ignorePatterns)
    const markdownPaths = allFiles.filter((fp) => fp.endsWith(".md")).sort()
    console.log(
      `Found ${markdownPaths.length} input files from \`${argv.directory}\` in ${perf.timeSince("glob")}`,
    )

    const filePaths = markdownPaths.map((fp) => joinSegments(argv.directory, fp) as FilePath)
    ctx.allFiles = allFiles
    ctx.allSlugs = allFiles.map((fp) => slugifyFilePath(fp as FilePath))

  parsedFiles = await parseMarkdown(ctx, filePaths)
  const filteredContent = filterContent(ctx, parsedFiles)

    await emitContent(ctx, filteredContent)
    console.log(
      styleText("green", `Done processing ${markdownPaths.length} files in ${perf.timeSince()}`),
    )
  } finally {
    release()
  }

  if (argv.watch) {
    ctx.incremental = true
    return startWatching(ctx, mut, parsedFiles, clientRefresh)
  }
}

// setup watcher for rebuilds
async function startWatching(
  ctx: BuildCtx,
  mut: Mutex,
  initialContent: ProcessedContent[],
  clientRefresh: () => void,
) {
  const { argv, allFiles } = ctx

  const contentMap: ContentMap = new Map()
  for (const filePath of allFiles) {
    contentMap.set(filePath, {
      type: "other",
    })
  }

  for (const content of initialContent) {
    const [_tree, vfile] = content
    contentMap.set(vfile.data.relativePath!, {
      type: "markdown",
      content,
    })
  }

  const gitIgnoredMatcher = await isGitIgnored()
  const buildData: BuildData = {
    ctx,
    mut,
    contentMap,
    ignored: (fp) => {
      const pathStr = toPosixPath(fp.toString())
      if (pathStr.startsWith(".git/")) return true
      if (gitIgnoredMatcher(pathStr)) return true
      for (const pattern of cfg.configuration.ignorePatterns) {
        if (minimatch(pathStr, pattern)) {
          return true
        }
      }

      return false
    },

    changesSinceLastBuild: {},
  }

  const watcher = chokidar.watch(".", {
    persistent: true,
    cwd: argv.directory,
    ignoreInitial: true,
  })

  const changes: ChangeEvent[] = []
  watcher
    .on("add", (fp) => {
      fp = toPosixPath(fp)
      if (buildData.ignored(fp)) return
      changes.push({ path: fp as FilePath, type: "add" })
      void rebuild(changes, clientRefresh, buildData)
    })
    .on("change", (fp) => {
      fp = toPosixPath(fp)
      if (buildData.ignored(fp)) return
      changes.push({ path: fp as FilePath, type: "change" })
      void rebuild(changes, clientRefresh, buildData)
    })
    .on("unlink", (fp) => {
      fp = toPosixPath(fp)
      if (buildData.ignored(fp)) return
      changes.push({ path: fp as FilePath, type: "delete" })
      void rebuild(changes, clientRefresh, buildData)
    })

  return async () => {
    await watcher.close()
  }
}

async function rebuild(changes: ChangeEvent[], clientRefresh: () => void, buildData: BuildData) {
  const { ctx, contentMap, mut, changesSinceLastBuild } = buildData
  const { argv, cfg } = ctx

  const buildId = randomIdNonSecure()
  ctx.buildId = buildId
  const numChangesInBuild = changes.length
  const release = await mut.acquire()
  try {
    // if there's another build after us, release and let them do it
    if (ctx.buildId !== buildId) {
      return
    }

    const perf = new PerfTimer()
    perf.addEvent("rebuild")
    console.log(styleText("yellow", "Detected change, rebuilding..."))

    for (const change of changes) {
      changesSinceLastBuild[change.path] = change.type
    }

    const staticResources = getStaticResourcesFromPlugins(ctx)
    const pathsToParse: FilePath[] = []
    for (const [fp, type] of Object.entries(changesSinceLastBuild)) {
      if (type === "delete" || path.extname(fp) !== ".md") continue
      const fullPath = joinSegments(argv.directory, toPosixPath(fp)) as FilePath
      pathsToParse.push(fullPath)
    }

    const parsed = await parseMarkdown(ctx, pathsToParse)
    for (const content of parsed) {
      contentMap.set(content[1].data.relativePath!, {
        type: "markdown",
        content,
      })
    }

    for (const [file, change] of Object.entries(changesSinceLastBuild)) {
      if (change === "delete") {
        contentMap.delete(file as FilePath)
      }

      if (change === "add" && path.extname(file) !== ".md") {
        contentMap.set(file as FilePath, {
          type: "other",
        })
      }
    }

    const changeEntries = Object.entries(changesSinceLastBuild)
    const changeEvents: ChangeEvent[] = changeEntries.map(([fp, type]) => {
      const path = fp as FilePath
      const processedContent = contentMap.get(path)
      if (processedContent?.type === "markdown") {
        const [_tree, file] = processedContent.content
        return {
          type,
          path,
          file,
        }
      }

      return {
        type,
        path,
      }
    })

    ctx.allFiles = Array.from(contentMap.keys())
    ctx.allSlugs = ctx.allFiles.map((fp) => slugifyFilePath(fp as FilePath))
    const processedFiles = filterContent(
      ctx,
      Array.from(contentMap.values())
        .filter((file) => file.type === "markdown")
        .map((file) => file.content),
    )

    let emittedFiles = 0
    for (const emitter of cfg.plugins.emitters) {
      const emitFn = emitter.partialEmit ?? emitter.emit
      const emitted = await emitFn(ctx, processedFiles, staticResources, changeEvents)
      if (emitted === null) {
        continue
      }

      if (Symbol.asyncIterator in emitted) {
        for await (const file of emitted) {
          emittedFiles++
          if (ctx.argv.verbose) {
            console.log(`[emit:${emitter.name}] ${file}`)
          }
        }
      } else {
        emittedFiles += emitted.length
        if (ctx.argv.verbose) {
          for (const file of emitted) {
            console.log(`[emit:${emitter.name}] ${file}`)
          }
        }
      }
    }

    console.log(
      `Emitted ${emittedFiles} files to \`${argv.output}\` in ${perf.timeSince("rebuild")}`,
    )
    console.log(styleText("green", `Done rebuilding in ${perf.timeSince()}`))
    changes.splice(0, numChangesInBuild)
    for (const [fp] of changeEntries) {
      delete changesSinceLastBuild[fp as FilePath]
    }
    clientRefresh()
  } finally {
    release()
  }
}

export default async (argv: Argv, mut: Mutex, clientRefresh: () => void) => {
  try {
    return await buildQuartz(argv, mut, clientRefresh)
  } catch (err) {
    trace("\nExiting Quartz due to a fatal error", err as Error)
  }
}
