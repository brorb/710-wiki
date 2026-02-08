import fs from "fs"
import { Repository } from "@napi-rs/simple-git"
import { QuartzTransformerPlugin } from "../types"
import path from "path"
import { styleText } from "util"

export interface Options {
  priority: ("frontmatter" | "git" | "filesystem")[]
}

const defaultOptions: Options = {
  priority: ["frontmatter", "git", "filesystem"],
}

function coerceDate(fp: string, d: any): Date {
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
  return invalidDate ? new Date() : dt
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
          let repositoryWorkdir: string = ""
          
          if (opts.priority.includes("git")) {
            try {
              repo = Repository.discover(ctx.argv.directory)
              repositoryWorkdir = repo.workdir() ?? ctx.argv.directory
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
              } else if (source === "git" && repo) {
                try {
                  const absoluteFp = path.resolve(fullFp)
                  // Normalize for git lookup
                  const normalize = (p: string) => p.replace(/\\/g, "/")
                  const normWorkdir = normalize(repositoryWorkdir)
                  const normFp = normalize(absoluteFp)
                  
                  let relativePath = normFp
                  if (normFp.toLowerCase().startsWith(normWorkdir.toLowerCase())) {
                      relativePath = normFp.slice(normWorkdir.length)
                  }
                  relativePath = relativePath.replace(/^\/+/, "")
                  
                  const gitModified = await repo.getFileLatestModifiedDateAsync(relativePath)
                  if (gitModified) {
                      modified ||= gitModified
                  }
                } catch (e) {
                   // ignore
                }
              }
            }
            
            file.data.dates = {
              created: coerceDate(fp, created),
              modified: coerceDate(fp, modified),
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
      created: Date
      modified: Date
      published: Date
    }
  }
}
