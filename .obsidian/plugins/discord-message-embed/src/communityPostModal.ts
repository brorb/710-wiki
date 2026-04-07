import { App, Modal, Setting, Notice, Editor } from "obsidian"

const DEFAULT_CHANNEL_URL = "https://www.youtube.com/@7-10tone"

function extractHandle(input: string): string {
  const trimmed = input.trim()

  // Already a bare @handle
  if (/^@[\w-]+$/.test(trimmed)) return trimmed

  // URL like https://www.youtube.com/@7-10tone
  const match = trimmed.match(/@([\w-]+)/)
  if (match) return `@${match[1]}`

  // Plain text handle without @
  if (/^[\w-]+$/.test(trimmed)) return `@${trimmed}`

  return "@7-10tone"
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ""

  // If already a nice label like "12 Jun 2025", keep it
  if (/^\d{1,2}\s+\w+\s+\d{4}$/.test(dateStr.trim())) return dateStr.trim()

  // Try parsing as a date
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return dateStr.trim()

  const day = d.getDate()
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ]
  const mon = months[d.getMonth()]
  const year = d.getFullYear()
  return `${day} ${mon} ${year}`
}

function todayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = (d.getMonth() + 1).toString().padStart(2, "0")
  const dd = d.getDate().toString().padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

export class CommunityPostModal extends Modal {
  private editor: Editor

  private channelUrl = DEFAULT_CHANNEL_URL
  private likes = "0"
  private comments = "0"
  private date = todayISO()
  private content = ""

  constructor(app: App, editor: Editor) {
    super(app)
    this.editor = editor
  }

  onOpen() {
    const { contentEl } = this
    contentEl.empty()
    contentEl.addClass("community-post-modal")

    this.applyModalStyles()

    contentEl.createEl("h2", { text: "Insert Community Post" })

    // Channel URL
    new Setting(contentEl)
      .setName("Channel")
      .setDesc("YouTube channel URL or @handle. Default: @7-10tone")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_CHANNEL_URL)
          .setValue(this.channelUrl)
          .onChange((v) => {
            this.channelUrl = v.trim() || DEFAULT_CHANNEL_URL
          }),
      )

    // Date
    new Setting(contentEl)
      .setName("Date")
      .setDesc("When the post was made. YYYY-MM-DD or a label like '12 Jun 2025'.")
      .addText((text) =>
        text
          .setPlaceholder(todayISO())
          .setValue(this.date)
          .onChange((v) => {
            this.date = v.trim()
          }),
      )

    // Likes & Comments on the same row
    const statsRow = contentEl.createDiv()
    statsRow.style.display = "flex"
    statsRow.style.gap = "12px"
    statsRow.style.marginBottom = "12px"

    new Setting(statsRow)
      .setName("Likes")
      .addText((text) =>
        text
          .setPlaceholder("0")
          .setValue(this.likes)
          .onChange((v) => {
            this.likes = v.trim()
          }),
      )

    new Setting(statsRow)
      .setName("Comments")
      .addText((text) =>
        text
          .setPlaceholder("0")
          .setValue(this.comments)
          .onChange((v) => {
            this.comments = v.trim()
          }),
      )

    // Content
    const contentLabel = contentEl.createEl("label", { text: "Post content" })
    contentLabel.style.display = "block"
    contentLabel.style.marginTop = "8px"
    contentLabel.style.marginBottom = "4px"
    contentLabel.style.fontWeight = "500"

    const textarea = contentEl.createEl("textarea")
    textarea.value = this.content
    textarea.placeholder = "Type the community post content here…"
    textarea.rows = 8
    textarea.style.width = "100%"
    textarea.style.resize = "vertical"
    textarea.style.fontSize = "0.95em"
    textarea.style.padding = "8px"
    textarea.style.borderRadius = "6px"
    textarea.style.border = "1px solid var(--background-modifier-border)"
    textarea.style.backgroundColor = "var(--background-primary)"
    textarea.style.color = "var(--text-normal)"
    textarea.style.fontFamily = "var(--font-monospace)"
    textarea.addEventListener("input", () => {
      this.content = textarea.value
    })

    // Insert button
    new Setting(contentEl)
      .addButton((btn) =>
        btn
          .setButtonText("Insert Post")
          .setCta()
          .onClick(() => {
            this.doInsert()
          }),
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => {
          this.close()
        }),
      )
  }

  onClose() {
    this.contentEl.empty()
  }

  private doInsert() {
    if (!this.content.trim()) {
      new Notice("Post content cannot be empty.")
      return
    }

    const handle = extractHandle(this.channelUrl)
    const likes = parseInt(this.likes, 10) || 0
    const comments = parseInt(this.comments, 10) || 0
    const dateLabel = formatDate(this.date) || formatDate(todayISO())

    // Build the code fence
    const header = `community-post,${handle},${likes},${comments},${dateLabel},`
    const block = "```" + header + "\n" + this.content.trimEnd() + "\n```"

    this.editor.replaceSelection(block)
    new Notice("Community post inserted.")
    this.close()
  }

  private applyModalStyles() {
    const style = document.createElement("style")
    style.textContent = `
      .community-post-modal {
        max-width: 580px;
        width: 580px;
      }
      .community-post-modal .modal-content {
        padding: 16px 20px;
      }
    `
    this.contentEl.prepend(style)
  }
}
