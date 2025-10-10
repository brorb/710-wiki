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

interface BaseExtras {
  mobileAppend?: QuartzComponent
}

type Options =
  | ({
      provider: "giscus"
      options: GiscusOptions
    } & BaseExtras)
  | ({
      provider: "utterances"
      options: UtterancesOptions
    } & BaseExtras)

function boolToStringBool(b: boolean): string {
  return b ? "1" : "0"
}

export default ((opts: Options) => {
  const Comments: QuartzComponent = (props: QuartzComponentProps) => {
    const { displayClass, fileData, cfg } = props
    // check if comments should be displayed according to frontmatter
    const disableComment: boolean =
      typeof fileData.frontmatter?.comments !== "undefined" &&
      (!fileData.frontmatter?.comments || fileData.frontmatter?.comments === "false")
    if (disableComment) {
      return <></>
    }

    if (opts.provider === "giscus") {
      const options = opts.options
      const MobileAppend = opts.mobileAppend
      return (
        <div class={classNames(displayClass, "comments-section")}>
          <hr class="comments-separator" aria-hidden="true" />
          <div class="comments-wrapper" data-provider="giscus">
            <div
              class="comments giscus"
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
            {MobileAppend ? (
              <div class="comments-mobile-append">
                <MobileAppend {...props} displayClass="mobile-only" />
              </div>
            ) : null}
          </div>
        </div>
      )
    }

    const options = opts.options
    const MobileAppend = opts.mobileAppend
    return (
      <div class={classNames(displayClass, "comments-section")}>
        <hr class="comments-separator" aria-hidden="true" />
        <div class="comments-wrapper" data-provider="utterances">
          <div
            class="comments utterances"
            data-provider="utterances"
            data-repo={options.repo}
            data-issue-term={options.issueTerm ?? "pathname"}
            data-label={options.label ?? ""}
            data-theme={options.theme ?? "github-dark"}
          ></div>
          {MobileAppend ? (
            <div class="comments-mobile-append">
              <MobileAppend {...props} displayClass="mobile-only" />
            </div>
          ) : null}
        </div>
      </div>
    )
  }

  Comments.afterDOMLoaded = script

  return Comments
}) satisfies QuartzComponentConstructor<Options>
