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
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.TagList(),
    Component.MobileOnly(Component.TableOfContents()),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Search(),
    Component.DesktopOnly(
      Component.Explorer({
        folderClickBehavior: "link",
        filterFn: (node) => node.slugSegment !== "templates",
      })
    ),
  ],
  right: [
    Component.MobileOnly(
      Component.Explorer({
        folderClickBehavior: "link",
        filterFn: (node) => node.slugSegment !== "templates",
      })
    ),
    Component.DesktopOnly(
      Component.Graph({
        localGraph: { removeTags: graphHiddenTags },
        globalGraph: { removeTags: graphHiddenTags },
      })
    ),
    Component.DesktopOnly(Component.TableOfContents()),
    Component.Backlinks(),
  ],
}

// components for pages that display lists of pages  (e.g. tags or folders)
export const defaultListPageLayout: PageLayout = {
  beforeBody: [
    Component.Breadcrumbs(),
    Component.ArticleTitle(),
    Component.ContentMeta(),
    Component.MobileOnly(Component.TableOfContents()),
  ],
  left: [
    Component.PageTitle(),
    Component.MobileOnly(Component.Spacer()),
    Component.Search(),
    Component.DesktopOnly(
      Component.Explorer({
        folderClickBehavior: "link",
        filterFn: (node) => node.slugSegment !== "templates",
      })
    ),
  ],
  right: [
    Component.MobileOnly(
      Component.Explorer({
        folderClickBehavior: "link",
        filterFn: (node) => node.slugSegment !== "templates",
      })
    ),
  ],
}
