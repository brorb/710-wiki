import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
import { classNames } from "../util/lang"
// @ts-ignore
import script from "./scripts/comments.inline"

type RepoSlug = `${string}/${string}`

type GiscusOptions = {
  repo: RepoSlug
  repoId: string
  category: string
  categoryId: string
  themeUrl?: string
  lightTheme?: string
  darkTheme?: string
  mapping?: "url" | "title" | "og:title" | "specific" | "number" | "pathname"
  strict?: boolean
  reactionsEnabled?: boolean
  inputPosition?: "top" | "bottom"
  lang?: string
}

type UtterancesOptions = {
  repo: RepoSlug
  issueTerm?: "pathname" | "url" | "title" | "og:title" | "issue-number" | "specific"
  label?: string
  theme?: string
}

type Options =
  | {
      provider: "giscus"
      options: GiscusOptions
    }
  | {
      provider: "utterances"
      options: UtterancesOptions
    }

function boolToStringBool(b: boolean): string {
  return b ? "1" : "0"
}

export default ((opts: Options) => {
  const Comments: QuartzComponent = ({ displayClass, fileData, cfg }: QuartzComponentProps) => {
    // check if comments should be displayed according to frontmatter
    const disableComment: boolean =
      typeof fileData.frontmatter?.comments !== "undefined" &&
      (!fileData.frontmatter?.comments || fileData.frontmatter?.comments === "false")
    if (disableComment) {
      return <></>
    }

    if (opts.provider === "giscus") {
      const options = opts.options
      return (
        <div
          class={classNames(displayClass, "comments", "giscus")}
          data-provider="giscus"
          data-repo={options.repo}
          data-repo-id={options.repoId}
          data-category={options.category}
          data-category-id={options.categoryId}
          data-mapping={options.mapping ?? "url"}
          data-strict={boolToStringBool(options.strict ?? true)}
          data-reactions-enabled={boolToStringBool(options.reactionsEnabled ?? true)}
          data-input-position={options.inputPosition ?? "bottom"}
          data-light-theme={options.lightTheme ?? "light"}
          data-dark-theme={options.darkTheme ?? "dark"}
          data-theme-url={options.themeUrl ?? `https://${cfg.baseUrl ?? "example.com"}/static/giscus`}
          data-lang={options.lang ?? "en"}
        ></div>
      )
    }

    const options = opts.options
    const ensureAbsoluteUrl = (value: string) => {
      if (/^https?:\/\//i.test(value)) {
        return value
      }
      const base = cfg.baseUrl ?? ""
      if (base) {
        const normalizedBase = base.startsWith("http") ? base : `https://${base}`
        try {
          return new URL(value, normalizedBase).toString()
        } catch {
          // fall through to relative value
        }
      }
      return value
    }

    const resolvedTheme = ensureAbsoluteUrl(options.theme ?? "/static/utterances-theme.css")
    return (
      <div
        class={classNames(displayClass, "comments", "utterances")}
        data-provider="utterances"
        data-repo={options.repo}
        data-issue-term={options.issueTerm ?? "pathname"}
        data-label={options.label ?? ""}
        data-theme={resolvedTheme}
      ></div>
    )
  }

  Comments.afterDOMLoaded = script

  return Comments
}) satisfies QuartzComponentConstructor<Options>
