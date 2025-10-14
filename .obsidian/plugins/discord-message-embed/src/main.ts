// @ts-nocheck
import { Editor, MarkdownView, Notice, Plugin, requestUrl } from "obsidian"

const API_ENDPOINT = "https://discord-system-firebase-bot-production.up.railway.app/api/message?url="
const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png"

interface DiscordApiAuthor {
  display_name?: string
  username?: string
  avatar_url?: string
  colour?: string
  color?: string
  colour_value?: number
}

interface DiscordApiResponse {
  id?: string
  timestamp?: string
  content?: string
  author?: DiscordApiAuthor
  url?: string
}

interface DiscordMessageBlock {
  id?: string
  author: {
    display_name?: string
    username: string
    color?: string
    colour?: string
    colour_value?: number
  }
  content: string
  timestamp?: string
  avatar_url: string
  url: string
}

const normaliseColour = (input?: string | null, numeric?: number | null): string | undefined => {
  const trimmed = input?.trim()
  if (trimmed) {
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`
  }

  if (typeof numeric === "number" && Number.isFinite(numeric)) {
    return `#${numeric.toString(16).padStart(6, "0")}`
  }

  return undefined
}

type CommandMode = "embed" | "citation"

export default class DiscordMessageEmbedPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: "insert-discord-message-embed",
      name: "Insert Discord message embed",
      editorCheckCallback: (checking, editor, view) =>
        this.handleCommand(checking, editor, view, "embed"),
    })

    this.addCommand({
      id: "insert-discord-message-citation",
      name: "Insert Discord message citation",
      editorCheckCallback: (checking, editor, view) =>
        this.handleCommand(checking, editor, view, "citation"),
    })

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        if (!(view instanceof MarkdownView)) {
          return
        }

        const selection = editor.getSelection()
        const urls = this.extractDiscordUrls(this.stripCitationMarker(selection))
        if (urls.length === 0) {
          return
        }

        menu.addItem((item) => {
          item
            .setTitle("Insert Discord message embed")
            .setIcon("message-square")
            .onClick(() => {
              void this.insertEmbed(editor)
            })
        })

        if (this.selectionHasCitationMarker(selection)) {
          menu.addItem((item) => {
            item
              .setTitle("Insert Discord message citation")
              .setIcon("superscript")
              .onClick(() => {
                void this.insertCitation(editor)
              })
          })
        }
      }),
    )
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

    if (mode === "citation" && !this.selectionHasCitationMarker(selection)) {
      return false
    }

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

  private selectionHasCitationMarker(selection: string): boolean {
    return selection?.trim().startsWith("^") ?? false
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

    if (!this.selectionHasCitationMarker(selection)) {
      new Notice("Add a '^' before the Discord link to create a citation.")
      return
    }

    const urls = this.extractDiscordUrls(this.stripCitationMarker(selection))
    if (urls.length === 0) {
      new Notice("Highlight at least one Discord message URL first.")
      return
    }

    const loading = new Notice(`Fetching ${urls.length} Discord citation...`, 0)

    try {
      const messages = await this.fetchMessages(urls)
      const citationId = this.generateCitationId()
      const encoded = Buffer.from(JSON.stringify(messages)).toString("base64")
      const marker = `{{discord-cite:${citationId}}}`
      const comment = `%%discord-cite:${citationId}|${encoded}%%`

      editor.replaceSelection(marker)

      const cursor = editor.getCursor()
      editor.replaceRange(`\n${comment}`, cursor)
    } catch (error) {
      console.error(error)
      new Notice("Unable to fetch the Discord citation.")
    } finally {
      loading.hide()
    }
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

  private async fetchDiscordMessage(url: string): Promise<DiscordApiResponse> {
    const response = await requestUrl({
      url: `${API_ENDPOINT}${encodeURIComponent(url)}`,
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
}

module.exports = DiscordMessageEmbedPlugin
module.exports.default = DiscordMessageEmbedPlugin
