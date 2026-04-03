import { Editor, MarkdownView, Notice, Plugin, requestUrl } from "obsidian"
import {
  DEFAULT_AVATAR,
  DEFAULT_SETTINGS,
  type DiscordApiResponse,
  type DiscordMessageBlock,
  type PluginSettings,
} from "./types"
import { normaliseColour } from "./utils"
import { DiscordEmbedSettingTab } from "./settings"
import { ManualEmbedModal } from "./modal"
import { registerDiscordRenderer } from "./renderer"

type CommandMode = "embed" | "citation"

export default class DiscordMessageEmbedPlugin extends Plugin {
  settings: PluginSettings = DEFAULT_SETTINGS

  async onload() {
    await this.loadSettings()
    this.addSettingTab(new DiscordEmbedSettingTab(this.app, this))

    // Register in-editor discord block renderer
    registerDiscordRenderer(this)

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
    const authorColourHex = normaliseColour(
      payload.author?.color ?? payload.author?.colour,
      payload.author?.colour_value,
    )

    // Try to match to a saved profile
    const matchedProfile = this.findMatchingProfile(authorUsername, authorDisplay)

    if (matchedProfile) {
      return {
        profile: matchedProfile.id,
        content: payload.content ?? "",
        timestamp: payload.timestamp,
        url,
      }
    }

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
      avatar_url: payload.author?.avatar_url || DEFAULT_AVATAR,
      url,
    }
  }

  /** Try to match an API response author to a saved profile by username. */
  private findMatchingProfile(
    username?: string,
    displayName?: string,
  ) {
    if (!username && !displayName) return null
    const profiles = this.settings.profiles
    for (const key of Object.keys(profiles)) {
      const p = profiles[key]
      if (
        (username && p.username.toLowerCase() === username.toLowerCase()) ||
        (username && p.id.toLowerCase() === username.toLowerCase()) ||
        (displayName && p.display_name.toLowerCase() === displayName.toLowerCase())
      ) {
        return p
      }
    }
    return null
  }
}
