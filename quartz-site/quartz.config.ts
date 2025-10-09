import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"
import themeColors from "./theme.colors.json"

const palette = themeColors

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "710 Tone Sleuth Wiki",
  pageTitleSuffix: " - 7/10 Wiki",
    enableSPA: true,
    enablePopovers: true,
    analytics: null,
    locale: "en-US",
    baseUrl: "https://710-wiki-production.up.railway.app",
    ignorePatterns: [
      "private",
      "templates",
      ".obsidian",
      "Content/.obsidian",
      "Content/.obsidian/**",
      "quartz-site",
      "quartz-site/**",
      "node_modules",
      "node_modules/**",
      "public",
      "public/**",
      ".git",
      ".git/**",
      ".github",
      ".github/**",
    ],
    defaultDateType: "modified",
    theme: {
      fontOrigin: "googleFonts",
      cdnCaching: true,
      typography: {
        header: "Schibsted Grotesk",
        body: "Source Sans Pro",
        code: "IBM Plex Mono",
      },
      colors: {
        lightMode: {
          light: palette.backgroundPrimary,
          lightgray: palette.backgroundSecondary,
          gray: palette.muted,
          darkgray: palette.textSecondary,
          dark: palette.textPrimary,
          secondary: palette.accentPrimary,
          tertiary: palette.accentSecondary,
          highlight: palette.highlight,
          textHighlight: palette.textHighlight,
        },
        darkMode: {
          light: palette.backgroundPrimary,
          lightgray: palette.backgroundSecondary,
          gray: palette.muted,
          darkgray: palette.textSecondary,
          dark: palette.textPrimary,
          secondary: palette.accentPrimary,
          tertiary: palette.accentSecondary,
          highlight: palette.highlight,
          textHighlight: palette.textHighlight,
        },
      },
    },
  },
  plugins: {
    transformers: [
      Plugin.FrontMatter(),
      Plugin.CreatedModifiedDate({
        priority: ["frontmatter", "git", "filesystem"],
      }),
      Plugin.SyntaxHighlighting({
        theme: {
          light: "github-light",
          dark: "github-dark",
        },
        keepBackground: false,
      }),
      Plugin.ObsidianFlavoredMarkdown({ enableInHtmlEmbed: false }),
      Plugin.GitHubFlavoredMarkdown(),
      Plugin.TableOfContents(),
      Plugin.CrawlLinks({ markdownLinkResolution: "shortest" }),
      Plugin.Description(),
      Plugin.Latex({ renderEngine: "katex" }),
      Plugin.HardLineBreaks(),
    ],
    filters: [Plugin.RemoveDrafts()],
    emitters: [
      Plugin.AliasRedirects(),
      Plugin.ComponentResources(),
      Plugin.ContentPage(),
      Plugin.FolderPage(),
      Plugin.TagPage(),
      Plugin.ContentIndex({
        enableSiteMap: true,
        enableRSS: true,
      }),
      Plugin.Assets(),
      Plugin.Static(),
      Plugin.Favicon(),
      Plugin.NotFoundPage(),
  // Custom OG image generation is expensive; leave it disabled for faster builds.
  // Plugin.CustomOgImages(),
    ],
  },
}

export default config
