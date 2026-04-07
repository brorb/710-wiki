import { Editor, MarkdownView, Notice, Plugin, requestUrl } from "obsidian"
import {
  DEFAULT_AVATAR,
  DEFAULT_SETTINGS,
  type DiscordApiResponse,
  type DiscordMessageBlock,
  type DiscordProfile,
  type PluginSettings,
} from "./types"
import { normaliseColour, normalizeUsername, extractAvatarId } from "./utils"
import { DiscordEmbedSettingTab } from "./settings"
import { ManualEmbedModal } from "./modal"
import { registerDiscordRenderer } from "./renderer"
import { registerCommunityPostRenderer } from "./communityPostRenderer"

type CommandMode = "embed" | "citation"

export default class DiscordMessageEmbedPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS

  async onload() {
    await this.loadSettings()
    this.addSettingTab(new DiscordEmbedSettingTab(this.app, this))

    // Register in-editor renderers
    registerDiscordRenderer(this)
    registerCommunityPostRenderer(this)

    /* ── URL-based commands (existing) ── */

    this.addCommand({
      id: "insert-discord-message-embed",
      name: "Insert Discord message embed (from URL)",
      editorCheckCallback: (checking, editor, view) =>
        this.handleCommand(checking, editor, view, "embed"),
    })

    this.addCommand({
      id: "insert-discord-message-citation",
      name: "Insert Discord message citation (from URL)",
      editorCheckCallback: (checking, editor, view) =>
        this.handleCommand(checking, editor, view, "citation"),
    })

    /* ── Manual embed commands (new) ── */

    this.addCommand({
      id: "insert-manual-discord-embed",
      name: "Insert manual Discord messages",
      editorCallback: (editor, view) => {
        new ManualEmbedModal(this.app, this, editor, "embed").open()
      },
    })

    this.addCommand({
      id: "insert-manual-discord-citation",
      name: "Insert manual Discord citation",
      editorCallback: (editor, view) => {
        new ManualEmbedModal(this.app, this, editor, "citation").open()
      },
    })

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        if (!(view instanceof MarkdownView)) {
          return
        }

        const selection = editor.getSelection()
        const urls = this.extractDiscordUrls(this.stripCitationMarker(selection))

        if (urls.length > 0) {
          menu.addItem((item) => {
            item
              .setTitle("Insert Discord embed (from URL)")
              .setIcon("message-square")
              .onClick(() => {
                void this.insertEmbed(editor)
              })
          })

          menu.addItem((item) => {
            item
              .setTitle("Insert Discord citation (from URL)")
              .setIcon("superscript")
              .onClick(() => {
                void this.insertCitation(editor)
              })
          })
        }

        menu.addSeparator()

        menu.addItem((item) => {
          item
            .setTitle("Insert Discord embed (manual)")
            .setIcon("message-square-plus")
            .onClick(() => {
              new ManualEmbedModal(this.app, this, editor, "embed").open()
            })
        })

        menu.addItem((item) => {
          item
            .setTitle("Insert Discord citation (manual)")
            .setIcon("quote")
            .onClick(() => {
              new ManualEmbedModal(this.app, this, editor, "citation").open()
            })
        })
      }),
    )
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData())
  }

  async saveSettings() {
    await this.saveData(this.settings)
  }

  private handleCommand(
    checking: boolean,
    editor: Editor,
    view: MarkdownView,
    mode: CommandMode,
  ): boolean {
    if (!(view instanceof MarkdownView)) {
      return false
    }

    const selection = editor.getSelection()
    const urls = this.extractDiscordUrls(
      mode === "citation" ? this.stripCitationMarker(selection) : selection,
    )

    if (checking) {
      return urls.length > 0
    }

    if (mode === "embed") {
      void this.insertEmbed(editor)
    } else {
      void this.insertCitation(editor)
    }

    return true
  }

  private extractDiscordUrls(source: string): string[] {
    if (!source) {
      return []
    }

    const regex = /https:\/\/(?:ptb\.|canary\.)?discord\.com\/channels\/\d+\/\d+\/\d+/gi
    const seen = new Set<string>()
    const ordered: string[] = []

    let match: RegExpExecArray | null
    while ((match = regex.exec(source)) !== null) {
      const url = match[0]
      if (!seen.has(url)) {
        seen.add(url)
        ordered.push(url)
      }
    }

    return ordered
  }

  private stripCitationMarker(selection: string): string {
    const caretIndex = selection.indexOf("^")
    if (caretIndex === -1) {
      return selection
    }

    return selection.slice(0, caretIndex) + selection.slice(caretIndex + 1)
  }

  private async insertEmbed(editor: Editor): Promise<void> {
    const selection = editor.getSelection()
    const urls = this.extractDiscordUrls(selection)

    if (urls.length === 0) {
      new Notice("Highlight at least one Discord message URL first.")
      return
    }

    const loading = new Notice(
      `Fetching ${urls.length} Discord message${urls.length > 1 ? "s" : ""}...`,
      0,
    )

    try {
      const messages = await this.fetchMessages(urls)
      const json = JSON.stringify(messages, null, 2)
      const block = "```discord\n" + json + "\n```"
      editor.replaceSelection(block)
    } catch (error) {
      console.error(error)
      new Notice("Unable to fetch one or more Discord messages.")
    } finally {
      loading.hide()
    }
  }

  private async insertCitation(editor: Editor): Promise<void> {
    const selection = editor.getSelection()
    const urls = this.extractDiscordUrls(this.stripCitationMarker(selection))
    if (urls.length === 0) {
      new Notice("Highlight at least one Discord message URL first.")
      return
    }

    const loading = new Notice(`Fetching ${urls.length} Discord citation...`, 0)

    try {
      const messages = await this.fetchMessages(urls)
      const citationId = this.generateCitationId()
      const marker = `<!-- discord-cite:${citationId} -->`
      const callout = this.buildCitationCallout(citationId, messages)

      editor.replaceSelection(marker)

      if (callout.trim().length > 0) {
        const cursor = editor.getCursor()
        const block = `\n\n${callout}\n`
        editor.replaceRange(block, cursor)
      }
    } catch (error) {
      console.error(error)
      new Notice("Unable to fetch the Discord citation.")
    } finally {
      loading.hide()
    }
  }

  private buildCitationCallout(citationId: string, messages: DiscordMessageBlock[]): string {
    if (messages.length === 0) {
      return ""
    }

    const countLabel = messages.length === 1 ? "1 message" : `${messages.length} messages`
    const payload = {
      id: citationId,
      messages,
    }

    const jsonLines = JSON.stringify(payload, null, 2).split("\n")

    const lines: string[] = [`> [!discord-cite]- Discord citation (${countLabel})`, ">",
      `> \`\`\`json`]

    jsonLines.forEach((line) => {
      lines.push(`> ${line}`)
    })
    lines.push(`> \`\`\``)

    return lines.join("\n")
  }

  private async fetchMessages(urls: string[]): Promise<DiscordMessageBlock[]> {
    const messages: DiscordMessageBlock[] = []
    for (const url of urls) {
      const apiPayload = await this.fetchDiscordMessage(url)
      messages.push(this.mapToMessageBlock(url, apiPayload))
    }
    return messages
  }

  private generateCitationId(): string {
    const random = Math.random().toString(36).slice(2, 8)
    const timestamp = Date.now().toString(36)
    return `cite-${timestamp}-${random}`
  }

  /** Fetch a single Discord message from the API. Public so settings/modals can use it. */
  async fetchDiscordMessage(url: string): Promise<DiscordApiResponse> {
    const response = await requestUrl({
      url: `${this.settings.apiEndpoint}${encodeURIComponent(url)}`,
    })

    if (response.status >= 400) {
      throw new Error(`Request failed with status ${response.status}`)
    }

    return response.json as DiscordApiResponse
  }

  private mapToMessageBlock(url: string, payload: DiscordApiResponse): DiscordMessageBlock {
    const authorUsername = payload.author?.username?.trim()
    const authorDisplay = payload.author?.display_name?.trim()
    const authorAvatar = payload.author?.avatar_url?.trim() || payload.author?.avatar?.trim()
    const authorColourHex = normaliseColour(
      payload.author?.color ?? payload.author?.colour,
      payload.author?.colour_value,
    )

    // Try to match to a saved profile (smart multi-signal matching)
    const matchedProfile = this.findMatchingProfile(authorUsername, authorDisplay, authorAvatar)

    if (matchedProfile) {
      // Update the profile if API has fresher data (avatar change, display name change)
      this.maybeUpdateProfile(matchedProfile, authorDisplay, authorAvatar, authorColourHex)

      return {
        profile: matchedProfile.id,
        content: payload.content ?? "",
        timestamp: payload.timestamp,
        url,
      }
    }

    // No existing profile — auto-create one for this user
    if (authorUsername) {
      const created = this.autoCreateProfile(authorUsername, authorDisplay, authorAvatar, authorColourHex)
      if (created) {
        return {
          profile: created.id,
          content: payload.content ?? "",
          timestamp: payload.timestamp,
          url,
        }
      }
    }

    // Fallback: inline author block (no profile)
    return {
      id: payload.id,
      author: {
        display_name: authorDisplay || undefined,
        username: authorUsername || authorDisplay || "Unknown User",
        color: authorColourHex,
        colour: payload.author?.colour?.trim() || undefined,
        colour_value: payload.author?.colour_value,
      },
      content: payload.content ?? "",
      timestamp: payload.timestamp,
      avatar_url: authorAvatar || this.settings.defaultAvatarUrl || DEFAULT_AVATAR,
      url,
    }
  }

  /**
   * Smart multi-signal profile matching.
   * Priority: 1) exact username  2) avatar hash  3) normalized username
   * For a small user population this is safe and eliminates duplicates.
   */
  private findMatchingProfile(
    username?: string,
    displayName?: string,
    avatarUrl?: string,
  ) {
    if (!username && !displayName && !avatarUrl) return null
    const profiles = this.settings.profiles

    // Pass 1: exact username or profile-id match (existing behaviour)
    for (const key of Object.keys(profiles)) {
      const p = profiles[key]
      if (
        (username && p.username.toLowerCase() === username.toLowerCase()) ||
        (username && p.id.toLowerCase() === username.toLowerCase())
      ) {
        return p
      }
    }

    // Pass 2: avatar hash match (strongest dedup signal — same avatar = same person)
    if (avatarUrl) {
      const incomingHash = extractAvatarId(avatarUrl)
      if (incomingHash) {
        for (const key of Object.keys(profiles)) {
          const p = profiles[key]
          if (p.avatar_url) {
            const profileHash = extractAvatarId(p.avatar_url)
            if (profileHash && profileHash === incomingHash) {
              return p
            }
          }
        }
      }
    }

    // Pass 3: normalized username (strips dots/underscores/dashes)
    if (username) {
      const normalizedIncoming = normalizeUsername(username)
      if (normalizedIncoming.length >= 3) {
        for (const key of Object.keys(profiles)) {
          const p = profiles[key]
          if (normalizeUsername(p.username) === normalizedIncoming) {
            return p
          }
        }
      }
    }

    // Pass 4: display name match (least reliable, but useful for small populations)
    if (displayName) {
      for (const key of Object.keys(profiles)) {
        const p = profiles[key]
        if (p.display_name.toLowerCase() === displayName.toLowerCase()) {
          return p
        }
      }
    }

    return null
  }

  /**
   * Auto-create a profile from API response data.
   * Generates a clean profile ID from the username.
   */
  private autoCreateProfile(
    username: string,
    displayName?: string,
    avatarUrl?: string,
    color?: string,
  ): DiscordProfile | null {
    const id = username.toLowerCase().replace(/[^a-z0-9_-]/g, "")
    if (!id) return null

    // Avoid collision with existing profile IDs
    let finalId = id
    if (this.settings.profiles[finalId]) {
      // Already exists — this shouldn't happen if findMatchingProfile worked,
      // but guard against it anyway
      return this.settings.profiles[finalId]
    }

    const profile: DiscordProfile = {
      id: finalId,
      display_name: displayName || username,
      username: username,
      color: color || undefined,
      avatar_url: avatarUrl || undefined,
    }

    this.settings.profiles[finalId] = profile
    // Fire-and-forget save — don't block the embed insertion
    void this.saveSettings()
    new Notice(`Auto-created profile "${finalId}" for @${username}`)

    return profile
  }

  /**
   * Update an existing profile if the API returned newer/better info.
   * Only overwrites empty fields or updates the avatar (users change these).
   */
  private maybeUpdateProfile(
    profile: DiscordProfile,
    displayName?: string,
    avatarUrl?: string,
    color?: string,
  ): void {
    let changed = false

    // Update avatar if it changed (users update profile pictures)
    if (avatarUrl && avatarUrl !== profile.avatar_url) {
      const newHash = extractAvatarId(avatarUrl)
      const oldHash = profile.avatar_url ? extractAvatarId(profile.avatar_url) : null
      if (newHash && newHash !== oldHash) {
        profile.avatar_url = avatarUrl
        changed = true
      }
    }

    // Fill in missing display name
    if (displayName && !profile.display_name) {
      profile.display_name = displayName
      changed = true
    }

    // Fill in missing color
    if (color && !profile.color) {
      profile.color = color
      changed = true
    }

    if (changed) {
      void this.saveSettings()
    }
  }
}
