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

    // Date (picker + text field)
    const dateRow = contentEl.createDiv("community-date-row")
    dateRow.createEl("label", { text: "Date" })
    const dateDesc = dateRow.createEl("small", {
      text: "Pick a date or type a label like '12 Jun 2025'.",
    })
    dateDesc.style.cssText = "display:block;color:var(--text-muted);margin-bottom:4px;font-size:0.82em;"

    const dateInputs = dateRow.createDiv("community-date-inputs")
    const datePicker = dateInputs.createEl("input", { type: "date" }) as HTMLInputElement
    datePicker.value = this.date
    dateInputs.createEl("span", { text: "or" }).style.cssText =
      "color:var(--text-muted);font-size:0.85em;"
    const dateText = dateInputs.createEl("input", {
      type: "text",
      placeholder: "e.g. 12 Jun 2025",
    }) as HTMLInputElement
    dateText.value = formatDate(this.date)

    datePicker.addEventListener("change", () => {
      this.date = datePicker.value
      dateText.value = formatDate(datePicker.value)
    })
    dateText.addEventListener("input", () => {
      this.date = dateText.value
    })

    // Likes & Comments
    const statsRow = contentEl.createDiv("community-stats-row")

    const likesGroup = statsRow.createDiv("community-stat-group")
    likesGroup.createEl("label", { text: "Likes" })
    const likesInput = likesGroup.createEl("input", {
      type: "number",
      value: this.likes,
      attr: { min: "0" },
    }) as HTMLInputElement
    likesInput.addEventListener("input", () => { this.likes = likesInput.value })

    const commentsGroup = statsRow.createDiv("community-stat-group")
    commentsGroup.createEl("label", { text: "Comments" })
    const commentsInput = commentsGroup.createEl("input", {
      type: "number",
      value: this.comments,
      attr: { min: "0" },
    }) as HTMLInputElement
    commentsInput.addEventListener("input", () => { this.comments = commentsInput.value })

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

    // Build the code fence — metadata on the first line of the body
    const metaLine = `${handle},${likes},${comments},${dateLabel}`
    const block = "```community-post\n" + metaLine + "\n" + this.content.trimEnd() + "\n```"

    this.editor.replaceSelection(block)
    new Notice("Community post inserted.")
    this.close()
  }

  private applyModalStyles() {
    const style = document.createElement("style")
    style.textContent = `
      .modal:has(.community-post-modal) {
        width: 700px;
        max-width: 90vw;
      }
      .community-post-modal .modal-content {
        padding: 16px 20px;
      }
      .community-date-row { margin: 8px 0 12px; }
      .community-date-row > label { display: block; font-weight: 500; margin-bottom: 2px; }
      .community-date-inputs {
        display: flex; gap: 8px; align-items: center;
      }
      .community-date-inputs input {
        padding: 6px 8px; border-radius: 6px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary); color: var(--text-normal);
        font-size: 0.93em;
      }
      .community-date-inputs input[type="date"] { width: 155px; }
      .community-date-inputs input[type="text"] { flex: 1; }
      .community-stats-row {
        display: flex; gap: 16px; margin: 8px 0 12px; align-items: flex-end;
      }
      .community-stat-group { flex: 1; }
      .community-stat-group label {
        display: block; font-weight: 500; margin-bottom: 4px; font-size: 0.9em;
      }
      .community-stat-group input {
        width: 100%; padding: 6px 8px; border-radius: 6px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary); color: var(--text-normal);
        font-size: 0.93em; box-sizing: border-box;
      }
    `
    this.contentEl.prepend(style)
    this.modalEl.style.width = "700px"
    this.modalEl.style.maxWidth = "90vw"
    this.modalEl.style.maxHeight = "none"
  }
}
