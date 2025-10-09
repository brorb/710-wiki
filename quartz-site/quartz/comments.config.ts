type RepoSlug = `${string}/${string}`

type DisabledConfig = {
  enabled: false
}

type GiscusConfig = {
  enabled: true
  provider: "giscus"
  repo: RepoSlug
  repoId: string
  category: string
  categoryId: string
  mapping?: "url" | "title" | "og:title" | "specific" | "number" | "pathname"
  strict?: boolean
  reactionsEnabled?: boolean
  inputPosition?: "top" | "bottom"
  lang?: string
  lightTheme?: string
  darkTheme?: string
  themeUrl?: string
}

type UtterancesConfig = {
  enabled: true
  provider: "utterances"
  repo: RepoSlug
  issueTerm?: "pathname" | "url" | "title" | "og:title" | "issue-number" | "specific"
  label?: string
  theme?: string
}

export type CommentsConfig = DisabledConfig | GiscusConfig | UtterancesConfig

export const commentsConfig: CommentsConfig = {
  enabled: true,
  provider: "utterances",
  repo: "brorb/710-wiki",
  issueTerm: "pathname",
  label: "💬 comment",
}
