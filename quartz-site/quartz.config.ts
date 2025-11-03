import * as path from "node:path"
import { fileURLToPath } from "node:url"
import * as dotenv from "dotenv"

import { QuartzConfig } from "./quartz/cfg"
import * as Plugin from "./quartz/plugins"
import themeColors from "./theme.colors.json"

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url))
const cwd = process.cwd()

const envCandidates = [
  path.resolve(moduleDirectory, "../.env"),
  path.resolve(moduleDirectory, ".env"),
  path.resolve(cwd, "../.env"),
  path.resolve(cwd, ".env"),
]

for (const candidate of envCandidates) {
  dotenv.config({ path: candidate, override: false })
}

const previewSecret = (value?: string) => {
  if (!value) {
    return null
  }
  if (value.length <= 8) {
    return `${value.slice(0, 2)}...${value.slice(-2)}`
  }
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

if (process.env.NODE_ENV !== "production") {
  console.info("[quartz] Oracle env", {
    cwd,
    moduleDirectory,
    candidates: envCandidates,
    proxyBaseUrl: process.env.ORACLE_PROXY_BASE_URL ?? null,
    hasRecaptchaSiteKey: Boolean(process.env.ORACLE_RECAPTCHA_SITE_KEY),
    recaptchaSiteKeyPreview: previewSecret(process.env.ORACLE_RECAPTCHA_SITE_KEY),
  })
}

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
  baseUrl: "710tone.wiki",
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
  cdnCaching: false,
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
    oracleChat: {
      enabled: true,
      apiBaseUrl: process.env.ORACLE_PROXY_BASE_URL ?? "",
      endpointPath: "/api/oracle/query",
      recaptchaSiteKey: process.env.ORACLE_RECAPTCHA_SITE_KEY ?? "",
      storageKey: "oracle-chat-history",
      maxHistory: 24,
      contextStreamPath: "/api/oracle/context-stream",
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
  Plugin.MediaBox(),
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
