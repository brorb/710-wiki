import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import { hasCanvasFrontmatter } from "./quartz/components/Canvas"
import { commentsConfig } from "./quartz/comments.config"

const graphHiddenTags = ["graph-exclude"]

const sharedAfterBody = [
  Component.MediaNormalizer(),
  Component.ConditionalRender({
    component: Component.Canvas(),
    condition: (props) => hasCanvasFrontmatter(props.fileData.frontmatter),
  }),
  Component.ConditionalRender({
    component: Component.HomepageFeatures(),
    condition: (page) => page.fileData.slug === "index",
  }),
]

if (commentsConfig.enabled) {
  if (commentsConfig.provider === "giscus") {
    const {
      repo,
      repoId,
      category,
      categoryId,
      mapping,
      strict,
      reactionsEnabled,
      inputPosition,
      lang,
      lightTheme,
      darkTheme,
      themeUrl,
    } = commentsConfig

    sharedAfterBody.push(
      Component.Comments({
        provider: "giscus",
        options: {
          repo,
          repoId,
          category,
          categoryId,
          mapping,
          strict,
          reactionsEnabled,
          inputPosition,
          lang,
          lightTheme,
          darkTheme,
          themeUrl,
        },
      })
    )
  } else if (commentsConfig.provider === "utterances") {
    const { repo, issueTerm, label, theme } = commentsConfig
    sharedAfterBody.push(
      Component.Comments({
        provider: "utterances",
        options: {
          repo,
          issueTerm,
          label,
          theme,
        },
      })
    )
  }
}

// components shared across all pages
export const sharedPageComponents: SharedLayout = {
  head: Component.Head(),
  header: [Component.LinksHeader()],
  afterBody: sharedAfterBody,
  footer: Component.Footer(),
}

// components for pages that display a single page (e.g. a single note)
export const defaultContentPageLayout: PageLayout = {
  beforeBody: [
    Component.ConditionalRender({
      component: Component.Breadcrumbs(),
      condition: (page) => page.fileData.slug !== "index",
    }),
    Component.ArticleHeader(),
    Component.InfoBox(),
    Component.TagList(),
  ],
  left: [
    Component.PageTitle(),
    Component.Search(),
    Component.Explorer({
      folderClickBehavior: "link",
      folderDefaultState: "collapsed",
      headerSlot: Component.Search({ variant: "inline" }),
      useSavedState: false,
      startCollapsed: false,
      filterFn: (node) => {
        const segment = typeof node.slugSegment === "string" ? node.slugSegment.toLowerCase() : ""
        return segment !== "templates" && segment !== "canvases"
      },
    }),
  ],
  right: [
    Component.OracleWidget(),
    Component.Graph({
      localGraph: { removeTags: graphHiddenTags },
      globalGraph: { removeTags: graphHiddenTags },
    }),
    Component.TableOfContents({
      defaultCollapsed: true,
    }),
    Component.DiscordWidget({
      variant: "sidebar",
    }),
    Component.Backlinks(),
  ],
}



// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.ContentMeta(),
  ],
  left: [
    Component.PageTitle(),
    Component.Search(),
    Component.Explorer({
      folderClickBehavior: "link",
      folderDefaultState: "open",
      headerSlot: Component.Search({ variant: "inline" }),
      useSavedState: false,
      filterFn: (node) => node.slugSegment !== "templates",
    }),
  ],
  right: [],
}
