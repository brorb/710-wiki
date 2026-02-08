import fs from "fs"
import { Repository } from "@napi-rs/simple-git"
import { QuartzTransformerPlugin } from "../types"
import path from "path"
import { styleText } from "util"
import { execSync } from "child_process"

export interface Options {
  priority: ("frontmatter" | "git" | "filesystem")[]
}

const defaultOptions: Options = {
  priority: ["frontmatter", "git", "filesystem"],
}

function coerceDate(fp: string, d: any): Date | undefined {
  const dt = new Date(d)
  const invalidDate = isNaN(dt.getTime()) || dt.getTime() === 0
  if (invalidDate && d !== undefined) {
    console.log(
      styleText(
        "yellow",
        `\nWarning: found invalid date "${d}" in ${fp}. Supported formats: https://quartz.jzhao.xyz/features/created-modified-dates#date-format`,
      ),
    )
  }
  return invalidDate ? undefined : dt
}

type MaybeDate = undefined | string | number
export const CreatedModifiedDate: QuartzTransformerPlugin<Partial<Options>> = (userOpts) => {
  const opts = { ...defaultOptions, ...userOpts }
  return {
    name: "CreatedModifiedDate",
    markdownPlugins(ctx) {
      return [
        () => {
          let repo: Repository | undefined = undefined
          let repoRoot: string = ""

          if (opts.priority.includes("git")) {
            try {
              repo = Repository.discover(ctx.argv.directory)
              repoRoot = repo.workdir() || ""
            } catch (e) {
              console.log(styleText("yellow", `\nWarning: Failed to discover git repo: ${e}`))
            }
          }

          return async (_tree, file) => {
            let created: MaybeDate = undefined
            let modified: MaybeDate = undefined
            let published: MaybeDate = undefined

            const fp = file.data.relativePath!
            const fullFp = file.data.filePath!
            const debugFile = fp.endsWith("index.md") || fp.includes("710 NPP")

            if (debugFile) {
                console.log(styleText("blue", `\n[DEBUG-START] ${fp}`));
                console.log(`[DEBUG] Priorities: ${opts.priority.join(", ")}`);
            }

            for (const source of opts.priority) {
              if (source === "filesystem") {
                 try {
                    const st = await fs.promises.stat(fullFp)
                    created ||= st.birthtimeMs
                    modified ||= st.mtimeMs
                    if (debugFile) console.log(`[DEBUG] Check Filesystem -> Modified: ${st.mtimeMs}`);
                 } catch (e) {
                    // ignore
                 }
              } else if (source === "frontmatter" && file.data.frontmatter) {
                if (file.data.frontmatter.created) created ||= file.data.frontmatter.created as MaybeDate
                if (file.data.frontmatter.modified) modified ||= file.data.frontmatter.modified as MaybeDate
                if (file.data.frontmatter.published) published ||= file.data.frontmatter.published as MaybeDate
                
                if (debugFile && modified) console.log(`[DEBUG] Check Frontmatter -> Modified: ${modified}`);
              } else if (source === "git" && repoRoot) {
                // Try git strategy
                try {
                   // Calculate relative path robustly
                   const absoluteFp = path.resolve(fullFp)
                   const normalize = (p: string) => p.replace(/\\/g, "/")
                   const normWorkdir = normalize(repoRoot)
                   const normFp = normalize(absoluteFp)
                   
                   let relativePath = normFp
                   if (normFp.toLowerCase().startsWith(normWorkdir.toLowerCase())) {
                       relativePath = normFp.slice(normWorkdir.length)
                   }
                   relativePath = relativePath.replace(/^\/+/, "")

                   if (debugFile) console.log(`[DEBUG] Git Check: Relative Path "${relativePath}"`);

                   // 1. Try simple-git
                   let gitDate = undefined;
                   if (repo) {
                        gitDate = await repo.getFileLatestModifiedDateAsync(relativePath)
                        if (debugFile) console.log(`[DEBUG] Simple-Git Result: ${gitDate}`);
                   }
                   
                   // 2. Fallback to CLI git if simple-git failed
                   if (!gitDate) {
                        try {
                           const cmd = `git log -1 --format=%ct -- "${relativePath}"`
                           const out = execSync(cmd, { cwd: repoRoot, encoding: "utf-8" }).trim()
                           if (debugFile) console.log(`[DEBUG] Git CLI Result (raw): "${out}"`);
                           
                           if (out && !isNaN(parseInt(out))) {
                               gitDate = parseInt(out) * 1000
                           }
                        } catch(execErr) {
                           if (debugFile) console.log(`[DEBUG] Git CLI Error: ${execErr}`);
                        }
                   }

                   if (gitDate) {
                       modified ||= gitDate;
                   }

                } catch (e) {
                   console.log(styleText("yellow", `\nWarning: git lookup failed for ${fp}: ${e}`))
                }
              }
            }

            const finalModified = coerceDate(fp, modified);

            if (debugFile) {
                console.log(`[DEBUG] Final Resolved Modified: ${modified}`);
                console.log(`[DEBUG] Final Coerced Date: ${finalModified}`);
                console.log(styleText("blue", `[DEBUG-END] ${fp}\n`));
            }

            file.data.dates = {
              created: coerceDate(fp, created),
              modified: finalModified,
              published: coerceDate(fp, published),
            }
          }
        },
      ]
    },
  }
}

declare module "vfile" {
  interface DataMap {
    dates: {
      created?: Date
      modified?: Date
      published?: Date
    }
  }
}
