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
  }
  content: string
  timestamp?: string
  avatar_url: string
  url: string
}

export default class DiscordMessageEmbedPlugin extends Plugin {
  async onload() {
    this.addCommand({
      id: "insert-discord-message-embed",
      name: "Insert Discord message embed",
      editorCheckCallback: (checking, editor, view) => {
        if (!(view instanceof MarkdownView)) {
          return false
        }

        const urls = this.extractDiscordUrls(editor.getSelection())
        if (checking) {
          return urls.length > 0
        }

        void this.convertSelection(editor)
        return true
      },
    })

    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        if (!(view instanceof MarkdownView)) {
          return
        }

        const urls = this.extractDiscordUrls(editor.getSelection())
        if (urls.length === 0) {
          return
        }

        menu.addItem((item) => {
          item
            .setTitle("Insert Discord message embed")
            .setIcon("message-square")
            .onClick(() => {
              void this.convertSelection(editor)
            })
        })
      }),
    )
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

  private async convertSelection(editor: Editor): Promise<void> {
    const selection = editor.getSelection()
    const urls = this.extractDiscordUrls(selection)

    if (urls.length === 0) {
      new Notice("Highlight at least one Discord message URL first.")
      return
    }

    const loading = new Notice(`Fetching ${urls.length} Discord message${urls.length > 1 ? "s" : ""}...`, 0)

    try {
      const messages: DiscordMessageBlock[] = []
      for (const url of urls) {
        const apiPayload = await this.fetchDiscordMessage(url)
        messages.push(this.mapToMessageBlock(url, apiPayload))
      }

      const json = JSON.stringify(messages, null, 2)
  const block = `\`\`\`discord\n${json}\n\`\`\``
      editor.replaceSelection(block)
    } catch (error) {
      console.error(error)
      new Notice("Unable to fetch one or more Discord messages.")
    } finally {
      loading.hide()
    }
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
    const authorColor = payload.author?.color?.trim() || payload.author?.colour?.trim()

    return {
      id: payload.id,
      author: {
        display_name: authorDisplay || undefined,
        username: authorUsername || authorDisplay || "Unknown User",
        color: authorColor || undefined,
      },
      content: payload.content ?? "",
      timestamp: payload.timestamp,
      avatar_url: payload.author?.avatar_url || DEFAULT_AVATAR,
      url,
    }
  }
}
