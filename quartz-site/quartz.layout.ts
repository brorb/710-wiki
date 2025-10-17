import { PageLayout, SharedLayout } from "./quartz/cfg"
import * as Component from "./quartz/components"
import { hasCanvasFrontmatter } from "./quartz/components/Canvas"
import { commentsConfig } from "./quartz/comments.config"

const graphHiddenTags = ["graph-exclude"]

const sharedAfterBody = [
  Component.ConditionalRender({
    component: Component.Canvas(),
    condition: (props) => hasCanvasFrontmatter(props.fileData.frontmatter),
  }),
  Component.MobileOnly(Component.Backlinks()),
]

const mobileDiscordWidget = Component.MobileOnly(
  Component.DiscordWidget({
    variant: "banner",
  }),
)

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
        mobileAppend: mobileDiscordWidget,
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
        mobileAppend: mobileDiscordWidget,
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
    Component.ArticleTitle(),
    Component.ContentMeta(),
  Component.InfoBox(),
    Component.TagList(),
    Component.MobileOnly(
      Component.TableOfContents({
        defaultCollapsed: true,
      }),
    ),
  ],
  left: [
    Component.PageTitle(),
    Component.DesktopOnly(Component.Search()),
    Component.MobileOnly(
      Component.Explorer({
        folderClickBehavior: "link",
        folderDefaultState: "collapsed",
        headerSlot: Component.Search({ variant: "inline" }),
        useSavedState: false,
        startCollapsed: true,
        filterFn: (node) => {
          const segment = typeof node.slugSegment === "string" ? node.slugSegment.toLowerCase() : ""
          return segment !== "templates" && segment !== "canvases"
        },
      }),
    ),
    Component.DesktopOnly(
      Component.Explorer({
        folderClickBehavior: "link",
        folderDefaultState: "collapsed",
        useSavedState: false,
        startCollapsed: false,
        filterFn: (node) => {
          const segment = typeof node.slugSegment === "string" ? node.slugSegment.toLowerCase() : ""
          return segment !== "templates" && segment !== "canvases"
        },
      })
    ),
  ],
  right: [
    Component.DesktopOnly(
      Component.Graph({
        localGraph: { removeTags: graphHiddenTags },
        globalGraph: { removeTags: graphHiddenTags },
      })
    ),
    Component.DesktopOnly(
      Component.TableOfContents({
        defaultCollapsed: true,
      }),
    ),
    Component.DesktopOnly(Component.Backlinks()),
    Component.DesktopOnly(
      Component.DiscordWidget({
        variant: "sidebar",
      }),
    ),
  ],
}



// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.MobileOnly(
      Component.TableOfContents({
        defaultCollapsed: true,
      })
    ),
  ],
  left: [
    Component.PageTitle(),
    Component.DesktopOnly(Component.Search()),
    Component.MobileOnly(
      Component.Explorer({
        folderClickBehavior: "link",
        folderDefaultState: "collapsed",
        useSavedState: false,
        headerSlot: Component.Search({ variant: "inline" }),
        filterFn: (node) => node.slugSegment !== "templates",
      }),
    ),
    Component.DesktopOnly(
      Component.Explorer({
        folderClickBehavior: "link",
        folderDefaultState: "open",
        filterFn: (node) => node.slugSegment !== "templates",
      })
    ),
  ],
  right: [],
}
