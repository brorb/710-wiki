import { QuartzEmitterPlugin } from "../types"
import { QuartzComponentProps } from "../../components/types"
import HeaderConstructor from "../../components/Header"
import BodyConstructor from "../../components/Body"
import { pageResources, renderPage } from "../../components/renderPage"
import { ProcessedContent, QuartzPluginData, defaultProcessedContent } from "../vfile"
import { FullPageLayout } from "../../cfg"
import path from "path"
import {
  FullSlug,
  SimpleSlug,
  stripSlashes,
  joinSegments,
  pathToRoot,
  simplifySlug,
} from "../../util/path"
import { defaultListPageLayout, sharedPageComponents } from "../../../quartz.layout"
import { FolderContent } from "../../components"
import { write } from "./helpers"
import { i18n, TRANSLATIONS } from "../../i18n"
import { BuildCtx } from "../../util/ctx"
import { StaticResources } from "../../util/resources"
import { VFile } from "vfile"
interface FolderPageOptions extends FullPageLayout {
  sort?: (f1: QuartzPluginData, f2: QuartzPluginData) => number
}

async function* processFolderInfo(
  ctx: BuildCtx,
  folderInfo: Record<SimpleSlug, ProcessedContent>,
  allFiles: QuartzPluginData[],
  opts: FullPageLayout,
  resources: StaticResources,
) {
  for (const [folder, folderContent] of Object.entries(folderInfo) as [
    SimpleSlug,
    ProcessedContent,
  ][]) {
    const slug = joinSegments(folder, "index") as FullSlug
    const [tree, file] = folderContent
    const cfg = ctx.cfg.configuration
    const externalResources = pageResources(pathToRoot(slug), resources)
    const componentData: QuartzComponentProps = {
      ctx,
      fileData: file.data,
      externalResources,
      cfg,
      children: [],
      tree,
      allFiles,
    }

    const content = renderPage(cfg, slug, componentData, opts, externalResources)
    yield write({
      ctx,
      content,
      slug,
      ext: ".html",
    })
  }
}

function computeFolderInfo(
  folders: Set<SimpleSlug>,
  content: ProcessedContent[],
  locale: keyof typeof TRANSLATIONS,
): Record<SimpleSlug, ProcessedContent> {
  // Create default folder descriptions
  const folderInfo: Record<SimpleSlug, ProcessedContent> = Object.fromEntries(
    [...folders].map((folder) => {
      const folderLabel = folder.split("/").filter(Boolean).at(-1) ?? folder
      const defaultTitle = folderLabel.length > 0 ? folderLabel : i18n(locale).pages.folderContent.folder
      return [
        folder,
        defaultProcessedContent({
          slug: joinSegments(folder, "index") as FullSlug,
          frontmatter: {
            title: defaultTitle,
            tags: [],
          },
        }),
      ]
    }),
  )

  const explicitFolders = new Set<SimpleSlug>()
  const descriptionContent = new Map<SimpleSlug, ProcessedContent>()
  const descriptionBasename = "foldercontentdescription"

  // Update with actual content if available
  for (const [tree, file] of content) {
    const originalSlug = file.data.slug
    if (!originalSlug) {
      continue
    }
    const simplifiedSlug = stripSlashes(simplifySlug(originalSlug)) as SimpleSlug
    const segments = simplifiedSlug.split("/")
    const lastSegment = segments.at(-1)?.toLowerCase()

    if (lastSegment === descriptionBasename) {
      const folderSlug = segments.slice(0, -1).join("/") as SimpleSlug
      if (folders.has(folderSlug)) {
        const remappedSlug = joinSegments(folderSlug, "index") as FullSlug
        const clonedFile = new VFile(file)
        const existingFrontmatter = (file.data.frontmatter ?? {}) as Record<string, unknown>
        const folderLabel = folderSlug.split("/").filter(Boolean).at(-1) ?? folderSlug
        const fallbackTitle = folderLabel.length > 0 ? folderLabel : i18n(locale).pages.folderContent.folder
        const frontmatterTitle =
          typeof existingFrontmatter.title === "string"
            ? existingFrontmatter.title.trim()
            : ""
        const resolvedTitle =
          frontmatterTitle.length > 0 && frontmatterTitle.toLowerCase() !== descriptionBasename
            ? frontmatterTitle
            : fallbackTitle
        clonedFile.data = {
          ...file.data,
          slug: remappedSlug,
          frontmatter: {
            ...existingFrontmatter,
            title: resolvedTitle,
          },
        }
        descriptionContent.set(folderSlug, [tree, clonedFile])
      }
      continue
    }

    if (folders.has(simplifiedSlug)) {
      folderInfo[simplifiedSlug] = [tree, file]
      explicitFolders.add(simplifiedSlug)
    }
  }

  for (const [folder, processed] of descriptionContent) {
    if (!explicitFolders.has(folder)) {
      folderInfo[folder] = processed
    }
  }

  return folderInfo
}

function _getFolders(slug: FullSlug): SimpleSlug[] {
  var folderName = path.dirname(slug ?? "") as SimpleSlug
  const parentFolderNames = [folderName]

  while (folderName !== ".") {
    folderName = path.dirname(folderName ?? "") as SimpleSlug
    parentFolderNames.push(folderName)
  }
  return parentFolderNames.filter((folder) => folder !== "canvases")
}

export const FolderPage: QuartzEmitterPlugin<Partial<FolderPageOptions>> = (userOpts) => {
  const opts: FullPageLayout = {
    ...sharedPageComponents,
    ...defaultListPageLayout,
    pageBody: FolderContent({ sort: userOpts?.sort }),
    ...userOpts,
  }

  const { head: Head, header, beforeBody, pageBody, afterBody, left, right, footer: Footer } = opts
  const Header = HeaderConstructor()
  const Body = BodyConstructor()

  return {
    name: "FolderPage",
    getQuartzComponents() {
      return [
        Head,
        Header,
        Body,
        ...header,
        ...beforeBody,
        pageBody,
        ...afterBody,
        ...left,
        ...right,
        Footer,
      ]
    },
    async *emit(ctx, content, resources) {
      const allFiles = content.map((c) => c[1].data)
      const cfg = ctx.cfg.configuration

      const folders: Set<SimpleSlug> = new Set(
        allFiles.flatMap((data) => {
          return data.slug
            ? _getFolders(data.slug).filter(
                (folderName) => folderName !== "." && folderName !== "tags",
              )
            : []
        }),
      )

      const folderInfo = computeFolderInfo(folders, content, cfg.locale)
      yield* processFolderInfo(ctx, folderInfo, allFiles, opts, resources)
    },
    async *partialEmit(ctx, content, resources, changeEvents) {
      const allFiles = content.map((c) => c[1].data)
      const cfg = ctx.cfg.configuration

      // Find all folders that need to be updated based on changed files
      const affectedFolders: Set<SimpleSlug> = new Set()
      for (const changeEvent of changeEvents) {
        if (!changeEvent.file) continue
        const slug = changeEvent.file.data.slug!
        const folders = _getFolders(slug).filter(
          (folderName) => folderName !== "." && folderName !== "tags",
        )
        folders.forEach((folder) => affectedFolders.add(folder))
      }

      // If there are affected folders, rebuild their pages
      if (affectedFolders.size > 0) {
        const folderInfo = computeFolderInfo(affectedFolders, content, cfg.locale)
        yield* processFolderInfo(ctx, folderInfo, allFiles, opts, resources)
      }
    },
  }
}
