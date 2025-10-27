import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"
import themeColors from "./theme.colors.json"

const palette = themeColors

const sharedCssVars = {
  "color-primary-background": palette.primaryBackground,
  "color-surface-overlay": palette.surfaceOverlay,
  "color-panel-depth": palette.panelDepth,
  "color-tone-primary": palette.tonePrimary,
  "color-tone-contrast": palette.toneContrast,
  "color-tone-subtle": palette.toneSubtle,
  "color-tone-muted": palette.toneMuted,
  "color-accent-bright": palette.accentBright,
  "color-accent-deep": palette.accentDeep,
  "color-accent-shadow": palette.accentShadow,
  "color-accent-shadow-light": palette.accentShadowLight,
  "color-highlight-overlay": palette.highlightOverlay,
  "color-link": palette.link,
  "color-button-text": palette.buttonText,
  "color-button-background": palette.accentDeep,
  "color-button-hover": palette.accentBright,
  "color-scrollbar-thumb": palette.accentBright,
  "color-scrollbar-track": palette.surfaceOverlay,
  "color-feedback-success": palette.feedbackSuccess,
  "color-feedback-error": palette.feedbackError,
}

const sharedColorScheme = {
  light: palette.primaryBackground,
  lightgray: palette.surfaceOverlay,
  gray: palette.panelDepth,
  darkgray: palette.toneContrast,
  dark: palette.tonePrimary,
  secondary: palette.accentBright,
  tertiary: palette.accentDeep,
  highlight: palette.highlightOverlay,
  textHighlight: palette.textHighlight,
}

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
  baseUrl: "https://www.710tone.wiki",
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
          ...sharedColorScheme,
          cssVars: {
            ...sharedCssVars,
          },
        },
        darkMode: {
          ...sharedColorScheme,
          cssVars: {
            ...sharedCssVars,
          },
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
  Plugin.InfoboxBlock(),
  Plugin.DiscordMessages(),
  Plugin.YouTubeCommunityPosts(),
      Plugin.TableOfContents({
        collapseByDefault: true,
      }),
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
