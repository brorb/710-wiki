import { FullSlug, isFolderPath, resolveRelative } from "../util/path"
import { QuartzPluginData } from "../plugins/vfile"
import { Date, getDate } from "./Date"
import { QuartzComponent, QuartzComponentProps } from "./types"
import { GlobalConfiguration } from "../cfg"

export type SortFn = (f1: QuartzPluginData, f2: QuartzPluginData) => number

export function byDateAndAlphabetical(cfg: GlobalConfiguration): SortFn {
  return (f1, f2) => {
    // Sort by date/alphabetical
    if (f1.dates && f2.dates) {
      // sort descending
      const d1 = getDate(cfg, f1)
      const d2 = getDate(cfg, f2)
      
      if (d1 && d2) {
          return d2.getTime() - d1.getTime()
      } else if (d1 && !d2) {
          return -1
      } else if (!d1 && d2) {
          return 1
      }
    } else if (f1.dates && !f2.dates) {
      // prioritize files with dates
      return -1
    } else if (!f1.dates && f2.dates) {
      return 1
    }

    // otherwise, sort lexographically by title
    const f1Title = f1.frontmatter?.title.toLowerCase() ?? ""
    const f2Title = f2.frontmatter?.title.toLowerCase() ?? ""
    return f1Title.localeCompare(f2Title)
  }
}

export function byDateAndAlphabeticalFolderFirst(cfg: GlobalConfiguration): SortFn {
  return (f1, f2) => {
    // Sort folders first
    const f1IsFolder = isFolderPath(f1.slug ?? "")
    const f2IsFolder = isFolderPath(f2.slug ?? "")
    if (f1IsFolder && !f2IsFolder) return -1
    if (!f1IsFolder && f2IsFolder) return 1

    // If both are folders or both are files, sort by date/alphabetical
    if (f1.dates && f2.dates) {
      // sort descending
      const d1 = getDate(cfg, f1)
      const d2 = getDate(cfg, f2)
      
      if (d1 && d2) {
          return d2.getTime() - d1.getTime()
      } else if (d1 && !d2) {
          return -1
      } else if (!d1 && d2) {
          return 1
      }
    } else if (f1.dates && !f2.dates) {
      // prioritize files with dates
      return -1
    } else if (!f1.dates && f2.dates) {
      return 1
    }

    // otherwise, sort lexographically by title
    const f1Title = f1.frontmatter?.title.toLowerCase() ?? ""
    const f2Title = f2.frontmatter?.title.toLowerCase() ?? ""
    return f1Title.localeCompare(f2Title)
  }
}

export const PageList: QuartzComponent = ({ cfg, fileData, allFiles, limit }: QuartzComponentProps) => {
  let list = allFiles.sort(byDateAndAlphabetical(cfg))
  if (limit) {
    list = list.slice(0, limit)
  }

  return (
    <ul class="section-ul">
      {list.map((page) => {
        const title = page.frontmatter?.title
        const tags = page.frontmatter?.tags ?? []
        const date = getDate(cfg, page)

        return (
          <li class="section-li">
            <div class="section-li-journal">
              {title && (
                <div class="section-li-title">
                  <a href={resolveRelative(fileData.slug!, page.slug!)} class="internal">
                    {title}
                  </a>
                </div>
              )}
              <div class="section-li-details">
                 {date && <p class="meta"><Date date={date} locale={cfg.locale} /></p>} 
                <ul class="tags">
                  {tags.map((tag) => (
                    <li>
                      <a
                        class="internal tag-link"
                        href={resolveRelative(fileData.slug!, `tags/${tag}` as FullSlug)}
                      >
                        #{tag}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

PageList.css = `
.section-ul {
  margin-top: 2rem;
  padding: 0;
}

.section-li {
  list-style-type: none;
  margin-bottom: 2rem;
}

.section-li-title {
  font-family: var(--headerFont);
  font-size: 1.25rem;
  line-height: 1.5rem;
  margin-bottom: 0.5rem;
}

.section-li-title a {
  color: var(--dark);
  font-weight: 700;
}

.section-li-details {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.meta {
  margin: 0;
  font-family: var(--codeFont);
  color: var(--gray);
  font-size: 0.8rem;
}
`
