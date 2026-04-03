/* ── Shared types for the discord-message-embed plugin ── */

/** A saved Discord user profile. */
export interface DiscordProfile {
  /** Unique key used in markdown blocks, e.g. "brorb" */
  id: string
  /** Display name shown in the embed */
  display_name: string
  /** Discord username (the @handle) */
  username: string
  /** Role colour as a hex string, e.g. "#FF0000" */
  color?: string
  /** URL to avatar image */
  avatar_url?: string
}

/** The shape stored in data.json by Obsidian's loadData/saveData. */
export interface PluginSettings {
  /** API endpoint for fetching linked server messages */
  apiEndpoint: string
  /** Map of profile id → profile data */
  profiles: Record<string, DiscordProfile>
}

export const DEFAULT_SETTINGS: PluginSettings = {
  apiEndpoint:
    "https://discord-system-firebase-bot-production.up.railway.app/api/message?url=",
  profiles: {},
}

export const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png"

/* ── API response shapes ── */

export interface DiscordApiAuthor {
  display_name?: string
  username?: string
  avatar_url?: string
  colour?: string
  color?: string
  colour_value?: number
}

export interface DiscordApiResponse {
  id?: string
  timestamp?: string
  content?: string
  author?: DiscordApiAuthor
  url?: string
}

/* ── The message block written into markdown ── */

export interface DiscordMessageBlock {
  /** Profile key — when present, author/avatar are resolved from settings */
  profile?: string
  /** Only needed when profile is absent (legacy / inline) */
  id?: string
  author?: {
    display_name?: string
    username: string
    color?: string
    colour?: string
    colour_value?: number
  }
  content: string
  timestamp?: string
  /** Only needed when profile is absent */
  avatar_url?: string
  /** Only present for linked server messages */
  url?: string
}
