import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"

/**
 * Quartz 4 Configuration
 *
 * See https://quartz.jzhao.xyz/configuration for more information.
 */
const config: QuartzConfig = {
  configuration: {
    pageTitle: "710 Tone Sleuth Wiki",
    pageTitleSuffix: "",
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
        header: "Bebas Neue",
        body: "Inter",
        code: "JetBrains Mono",
      },
      colors: {
        lightMode: {
          light: "#0c0103",
          lightgray: "#1d050a",
          gray: "#a93945",
          darkgray: "#fbe2e6",
          dark: "#fff7f8",
          secondary: "#ff1744",
          tertiary: "#c21807",
          highlight: "rgba(255, 23, 68, 0.18)",
          textHighlight: "#ff174466",
        },
        darkMode: {
          light: "#040001",
          lightgray: "#1a0509",
          gray: "#ff5c7a",
          darkgray: "#ffe8ee",
          dark: "#ffffff",
          secondary: "#ff284f",
          tertiary: "#a80f2b",
          highlight: "rgba(255, 72, 72, 0.2)",
          textHighlight: "#ff284f66",
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
