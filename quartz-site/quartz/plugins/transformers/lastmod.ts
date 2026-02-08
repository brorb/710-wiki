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
          
          // Debug counter
          let processCount = 0;

          if (opts.priority.includes("git")) {
            try {
              repo = Repository.discover(ctx.argv.directory)
              repoRoot = repo.workdir() || ""
              console.error(`[DEBUG] Git Repo Discovered. Root: ${repoRoot}, ArgvDir: ${ctx.argv.directory}`);
            } catch (e) {
              console.error(`[DEBUG] Failed to discover git repo: ${e}`);
            }
          }

          return async (_tree, file) => {
            processCount++;
            const isDebug = processCount <= 5; // Log first 5 files

            let created: MaybeDate = undefined
            let modified: MaybeDate = undefined
            let published: MaybeDate = undefined

            const fp = file.data.relativePath!
            const fullFp = file.data.filePath!

            if (isDebug) {
                console.error(`[DEBUG] File #${processCount}: ${fp}`);
                console.error(`[DEBUG] Full Path: ${fullFp}`);
            }

            for (const source of opts.priority) {
              if (source === "filesystem") {
                 try {
                    const st = await fs.promises.stat(fullFp)
                    created ||= st.birthtimeMs
                    modified ||= st.mtimeMs
                 } catch (e) {
                    // ignore
                 }
              } else if (source === "frontmatter" && file.data.frontmatter) {
                if (file.data.frontmatter.created) created ||= file.data.frontmatter.created as MaybeDate
                if (file.data.frontmatter.modified) modified ||= file.data.frontmatter.modified as MaybeDate
                if (file.data.frontmatter.published) published ||= file.data.frontmatter.published as MaybeDate
              } else if (source === "git" && repoRoot) {
                try {
                   const absoluteFp = path.resolve(fullFp)
                   // Normalize slashes
                   const normalize = (p: string) => p.replace(/\\/g, "/")
                   const normWorkdir = normalize(repoRoot)
                   const normFp = normalize(absoluteFp)
                   
                   let relativePath = normFp
                   if (normFp.toLowerCase().startsWith(normWorkdir.toLowerCase())) {
                       relativePath = normFp.slice(normWorkdir.length)
                   }
                   relativePath = relativePath.replace(/^\/+/, "")
                   
                   if (isDebug) console.error(`[DEBUG] Relative path for git: ${relativePath}`);

                   // 1. Try simple-git
                   let gitDate = undefined;
                   if (repo) {
                        gitDate = await repo.getFileLatestModifiedDateAsync(relativePath)
                        if (isDebug) console.error(`[DEBUG] Simple-Git returned: ${gitDate}`);
                   }
                   
                   // 2. Fallback to CLI git if simple-git failed
                   if (!gitDate) {
                        try {
                           // Use strict allow-list for args to prevent injection, though limited here
                           const cmd = `git log -1 --format=%ct -- "${relativePath}"`
                           const out = execSync(cmd, { cwd: repoRoot, encoding: "utf-8" }).trim()
                           
                           if (isDebug) console.error(`[DEBUG] CLI Git returned: '${out}'`);

                           if (out && !isNaN(parseInt(out))) {
                               gitDate = parseInt(out) * 1000
                           }
                        } catch(execErr) {
                           if (isDebug) console.error(`[DEBUG] CLI Git failed: ${execErr}`);
                        }
                   }

                   if (gitDate) {
                       modified ||= gitDate;
                   }
                } catch (e) {
                   console.error(`[DEBUG] Git processing error for ${fp}: ${e}`);
                }
              }
            }

            const finalDate = coerceDate(fp, modified);
            if (isDebug) console.error(`[DEBUG] Final Modified Date: ${finalDate}`);

            file.data.dates = {
              created: coerceDate(fp, created),
              modified: finalDate,
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
