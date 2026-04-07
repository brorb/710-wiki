import {
  App,
  Modal,
  Setting,
  Notice,
  DropdownComponent,
  TextAreaComponent,
  TextComponent,
  ButtonComponent,
  Editor,
} from "obsidian"
import type DiscordMessageEmbedPlugin from "./main"
import type { DiscordProfile, DiscordMessageBlock } from "./types"
import { DEFAULT_AVATAR } from "./types"
import { normaliseColour } from "./utils"

interface MessageDraft {
  profileId: string
  content: string
  dateVal: string
  timeVal: string
  timezone: string
}

type InsertMode = "embed" | "citation"

/* ── Timezone / date helpers ── */

function getTimezones(): string[] {
  try {
    return (Intl as any).supportedValuesOf("timeZone") as string[]
  } catch {
    return [
      "UTC", "America/New_York", "America/Chicago", "America/Denver",
      "America/Los_Angeles", "America/Sao_Paulo", "Europe/London",
      "Europe/Berlin", "Europe/Paris", "Europe/Oslo", "Europe/Moscow",
      "Asia/Dubai", "Asia/Kolkata", "Asia/Shanghai", "Asia/Tokyo",
      "Australia/Sydney", "Pacific/Auckland",
    ]
  }
}

function getLocalTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return "UTC"
  }
}

function wallClockToISO(dateVal: string, timeVal: string, tz: string): string {
  if (!dateVal) return new Date().toISOString()
  const time = timeVal || "12:00"
  const [year, month, day] = dateVal.split("-").map(Number)
  const [hour, minute] = time.split(":").map(Number)
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0)
  try {
    const probe = new Date(naiveUtcMs)
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).formatToParts(probe)
    const g = (t: string) =>
      parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10)
    const wallMs = Date.UTC(
      g("year"), g("month") - 1, g("day"),
      g("hour") % 24, g("minute"), g("second"),
    )
    return new Date(naiveUtcMs - (wallMs - naiveUtcMs)).toISOString()
  } catch {
    return new Date(naiveUtcMs).toISOString()
  }
}

export class ManualEmbedModal extends Modal {
  private plugin: DiscordMessageEmbedPlugin
  private editor: Editor
  private mode: InsertMode
  private messages: MessageDraft[] = []
  private messageContainer!: HTMLElement

  constructor(
    app: App,
    plugin: DiscordMessageEmbedPlugin,
    editor: Editor,
    mode: InsertMode,
  ) {
    super(app)
    this.plugin = plugin
    this.editor = editor
    this.mode = mode
  }

  onOpen() {
    const { contentEl } = this
    contentEl.empty()
    contentEl.addClass("discord-manual-embed-modal")

    // Apply custom styles
    this.applyModalStyles()

    contentEl.createEl("h2", {
      text:
        this.mode === "embed"
          ? "Insert Manual Discord Messages"
          : "Insert Manual Discord Citation",
    })

    const profileKeys = Object.keys(this.plugin.settings.profiles)
    if (profileKeys.length === 0) {
      contentEl.createEl("p", {
        text: "No profiles found. Create one first!",
        cls: "mod-warning",
      })
    }

    // Add initial empty message
    if (this.messages.length === 0) {
      this.messages.push(this.createEmptyDraft())
    }

    this.messageContainer = contentEl.createDiv("discord-messages-list")

    // Timezone datalist (shared across all message blocks)
    const tzDl = contentEl.createEl("datalist")
    tzDl.id = "discord-tz-list"
    for (const tz of getTimezones()) tzDl.createEl("option", { value: tz })

    this.renderAllMessages()

    // Bottom bar: add message + submit
    const bottomBar = contentEl.createDiv("discord-modal-bottom-bar")

    new Setting(bottomBar)
      .addButton((btn) =>
        btn
          .setButtonText("+ Add Message")
          .onClick(() => {
            this.messages.push(this.createEmptyDraft())
            this.renderAllMessages()
          }),
      )

    new Setting(bottomBar).addButton((btn) =>
      btn
        .setButtonText(this.mode === "embed" ? "Insert Embed" : "Insert Citation")
        .setCta()
        .onClick(() => {
          this.doInsert()
        }),
    )
  }

  onClose() {
    this.contentEl.empty()
  }

  /* ── Rendering ── */

  private renderAllMessages() {
    this.messageContainer.empty()

    this.messages.forEach((msg, index) => {
      this.renderMessageBlock(this.messageContainer, msg, index)
    })
  }

  private renderMessageBlock(
    container: HTMLElement,
    draft: MessageDraft,
    index: number,
  ) {
    const wrapper = container.createDiv("discord-msg-block")
    wrapper.style.border = "1px solid var(--background-modifier-border)"
    wrapper.style.borderRadius = "8px"
    wrapper.style.padding = "10px 14px"
    wrapper.style.marginBottom = "10px"
    wrapper.style.backgroundColor = "var(--background-secondary)"

    const header = wrapper.createDiv()
    header.style.display = "flex"
    header.style.alignItems = "center"
    header.style.justifyContent = "space-between"
    header.style.marginBottom = "6px"

    header.createEl("strong", { text: `Message ${index + 1}` })

    if (this.messages.length > 1) {
      const removeBtn = header.createEl("button", { text: "✕" })
      removeBtn.style.cursor = "pointer"
      removeBtn.style.background = "none"
      removeBtn.style.border = "none"
      removeBtn.style.color = "var(--text-error)"
      removeBtn.style.fontSize = "1.1em"
      removeBtn.addEventListener("click", () => {
        this.messages.splice(index, 1)
        this.renderAllMessages()
      })
    }

    // Profile dropdown + manage button
    const profileSetting = new Setting(wrapper)
      .setName("Profile")

    profileSetting.addDropdown((dropdown) => {
      dropdown.addOption("", "— Select profile —")
      const profiles = this.plugin.settings.profiles
      for (const key of Object.keys(profiles).sort()) {
        const p = profiles[key]
        dropdown.addOption(key, `${p.display_name} (@${p.username})`)
      }
      dropdown.setValue(draft.profileId)
      dropdown.onChange((value) => {
        draft.profileId = value
      })
    })

    profileSetting.addButton((btn) =>
      btn.setButtonText("Manage Profiles").onClick(() => {
        this.openInlineProfileManager()
      }),
    )

    // Timestamp (date + time + timezone)
    const tsRow = wrapper.createDiv("discord-ts-row")
    tsRow.createEl("label", { text: "Timestamp", cls: "discord-ts-label" })
    const tsInputs = tsRow.createDiv("discord-ts-inputs")

    const dateInput = tsInputs.createEl("input", { type: "date", cls: "discord-ts-date" }) as HTMLInputElement
    dateInput.value = draft.dateVal
    dateInput.addEventListener("change", () => { draft.dateVal = dateInput.value })

    const timeInput = tsInputs.createEl("input", { type: "time", cls: "discord-ts-time" }) as HTMLInputElement
    timeInput.value = draft.timeVal
    timeInput.addEventListener("change", () => { draft.timeVal = timeInput.value })

    const tzInput = tsInputs.createEl("input", {
      type: "text",
      cls: "discord-ts-tz",
      placeholder: "Timezone",
      attr: { list: "discord-tz-list" },
    }) as HTMLInputElement
    tzInput.value = draft.timezone
    tzInput.addEventListener("change", () => { draft.timezone = tzInput.value })

    tsRow.createEl("small", { text: "Leave blank for current time.", cls: "discord-ts-hint" })

    // Content textarea — the important one!
    const contentLabel = wrapper.createEl("label", {
      text: "Message content",
    })
    contentLabel.style.display = "block"
    contentLabel.style.marginTop = "8px"
    contentLabel.style.marginBottom = "4px"
    contentLabel.style.fontWeight = "500"

    const textarea = wrapper.createEl("textarea")
    textarea.value = draft.content
    textarea.placeholder = "Type the message here… newlines are preserved!"
    textarea.rows = 4
    textarea.style.width = "100%"
    textarea.style.resize = "vertical"
    textarea.style.fontFamily =
      '"gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif'
    textarea.style.fontSize = "0.95em"
    textarea.style.padding = "8px"
    textarea.style.borderRadius = "6px"
    textarea.style.border = "1px solid var(--background-modifier-border)"
    textarea.style.backgroundColor = "var(--background-primary)"
    textarea.style.color = "var(--text-normal)"
    textarea.addEventListener("input", () => {
      draft.content = textarea.value
    })
  }

  /* ── Insertion ── */

  private doInsert() {
    // Validate
    const validMessages = this.messages.filter(
      (m) => m.profileId && m.content.trim(),
    )

    if (validMessages.length === 0) {
      new Notice("Add at least one message with a profile and content.")
      return
    }

    // Check all profiles exist
    for (const m of validMessages) {
      if (!this.plugin.settings.profiles[m.profileId]) {
        new Notice(`Profile "${m.profileId}" not found. Was it deleted?`)
        return
      }
    }

    const blocks: DiscordMessageBlock[] = validMessages.map((m) => {
      const block: DiscordMessageBlock = {
        profile: m.profileId,
        content: m.content, // Raw content with real newlines — JSON.stringify handles escaping
        timestamp: wallClockToISO(m.dateVal, m.timeVal, m.timezone || getLocalTimezone()),
      }
      return block
    })

    if (this.mode === "embed") {
      const json = JSON.stringify(blocks, null, 2)
      const block = "```discord\n" + json + "\n```"
      this.editor.replaceSelection(block)
    } else {
      const citationId = this.generateCitationId()
      const marker = `<!-- discord-cite:${citationId} -->`
      const callout = this.buildCitationCallout(citationId, blocks)
      this.editor.replaceSelection(marker)
      if (callout.trim().length > 0) {
        const cursor = this.editor.getCursor()
        const fenceBlock = `\n\n${callout}\n`
        this.editor.replaceRange(fenceBlock, cursor)
      }
    }

    new Notice(
      `Inserted ${validMessages.length} message${validMessages.length > 1 ? "s" : ""}.`,
    )
    this.close()
  }

  private buildCitationCallout(
    citationId: string,
    messages: DiscordMessageBlock[],
  ): string {
    if (messages.length === 0) return ""
    const countLabel =
      messages.length === 1 ? "1 message" : `${messages.length} messages`
    const payload = { id: citationId, messages }
    const jsonLines = JSON.stringify(payload, null, 2).split("\n")
    const lines: string[] = [
      `> [!discord-cite]- Discord citation (${countLabel})`,
      ">",
      "> ```json",
    ]
    jsonLines.forEach((line) => lines.push(`> ${line}`))
    lines.push("> ```")
    return lines.join("\n")
  }

  private generateCitationId(): string {
    const random = Math.random().toString(36).slice(2, 8)
    const timestamp = Date.now().toString(36)
    return `cite-${timestamp}-${random}`
  }

  private createEmptyDraft(): MessageDraft {
    // Default to first profile if there is one
    const keys = Object.keys(this.plugin.settings.profiles).sort()
    return {
      profileId: keys[0] ?? "",
      content: "",
      dateVal: "",
      timeVal: "",
      timezone: getLocalTimezone(),
    }
  }

  /* ── Inline Profile Manager ── */

  private openInlineProfileManager() {
    const { contentEl } = this
    // Remove existing manager if open
    contentEl.querySelector(".discord-inline-profile-mgr")?.remove()

    const mgr = contentEl.createDiv("discord-inline-profile-mgr")
    mgr.style.border = "2px solid var(--interactive-accent)"
    mgr.style.borderRadius = "10px"
    mgr.style.padding = "14px 18px"
    mgr.style.marginTop = "12px"
    mgr.style.backgroundColor = "var(--background-secondary)"

    mgr.createEl("h3", { text: "Manage Profiles" })

    // List existing
    const listDiv = mgr.createDiv()
    this.renderInlineProfileList(listDiv, mgr)

    // New profile form
    mgr.createEl("hr")
    mgr.createEl("h4", { text: "Add New Profile" })
    this.renderInlineProfileForm(mgr, listDiv)

    // Close button
    new Setting(mgr).addButton((btn) =>
      btn.setButtonText("Done").setCta().onClick(() => {
        mgr.remove()
        // Refresh the message dropdowns
        this.renderAllMessages()
      }),
    )
  }

  private renderInlineProfileList(
    container: HTMLElement,
    mgrRoot: HTMLElement,
  ) {
    container.empty()
    const profiles = this.plugin.settings.profiles
    const keys = Object.keys(profiles).sort()

    if (keys.length === 0) {
      container.createEl("p", { text: "No profiles yet." })
      return
    }

    for (const key of keys) {
      const p = profiles[key]
      const row = new Setting(container)

      const frag = document.createDocumentFragment()
      if (p.avatar_url) {
        const img = frag.createEl("img", {
          attr: {
            src: p.avatar_url,
            width: "20",
            height: "20",
            style:
              "border-radius:50%;vertical-align:middle;margin-right:6px;",
          },
        })
        img.onerror = () => {
          img.style.display = "none"
        }
      }
      const span = frag.createEl("span", { text: `${p.display_name} (${key})` })
      if (p.color) {
        span.style.color = p.color
        span.style.fontWeight = "600"
      }
      row.nameEl.replaceChildren(frag)

      row.addButton((btn) =>
        btn
          .setButtonText("Delete")
          .setWarning()
          .onClick(async () => {
            delete this.plugin.settings.profiles[key]
            await this.plugin.saveSettings()
            this.renderInlineProfileList(container, mgrRoot)
          }),
      )
    }
  }

  private renderInlineProfileForm(
    mgrRoot: HTMLElement,
    listContainer: HTMLElement,
  ) {
    const draft: Partial<DiscordProfile> = {}

    let idInput: TextComponent | null = null
    let displayNameInput: TextComponent | null = null
    let usernameInput: TextComponent | null = null
    let colourInput: TextComponent | null = null
    let avatarInput: TextComponent | null = null

    // ── Auto-fill from message URL ──
    new Setting(mgrRoot)
      .setName("Auto-fill from URL")
      .setDesc("Paste a Discord message URL from this user.")
      .addText((t) =>
        t.setPlaceholder("https://discord.com/channels/…"),
      )
      .addButton((btn) =>
        btn
          .setButtonText("Fetch")
          .setCta()
          .onClick(async () => {
            const urlInput = mgrRoot.querySelector<HTMLInputElement>(
              ".setting-item:nth-of-type(1) input[type=text]",
            )
            const url = urlInput?.value?.trim()
            if (!url || !/discord\.com\/channels\/\d+\/\d+\/\d+/i.test(url)) {
              new Notice("Paste a valid Discord message URL first.")
              return
            }
            const loading = new Notice("Fetching author info…", 0)
            try {
              const msg = await this.plugin.fetchDiscordMessage(url)
              const author = msg.author
              if (!author) {
                new Notice("No author info found.")
                return
              }
              const fetchedUsername = author.username?.trim() ?? ""
              const fetchedDisplay = author.display_name?.trim() ?? fetchedUsername
              const fetchedAvatar = author.avatar_url ?? ""
              const fetchedColour = normaliseColour(
                author.color ?? author.colour,
                author.colour_value,
              ) ?? ""

              draft.display_name = fetchedDisplay
              draft.username = fetchedUsername
              draft.avatar_url = fetchedAvatar
              draft.color = fetchedColour

              if (!draft.id && fetchedUsername) {
                draft.id = fetchedUsername.toLowerCase().replace(/[^a-z0-9_-]/g, "")
                idInput?.setValue(draft.id)
              }
              displayNameInput?.setValue(fetchedDisplay)
              usernameInput?.setValue(fetchedUsername)
              colourInput?.setValue(fetchedColour)
              avatarInput?.setValue(fetchedAvatar)

              new Notice(`Filled from @${fetchedUsername}`)
            } catch (e) {
              console.error(e)
              new Notice("Failed to fetch. Check the URL.")
            } finally {
              loading.hide()
            }
          }),
      )

    new Setting(mgrRoot)
      .setName("ID")
      .addText((t) => {
        idInput = t
        t.setPlaceholder("brorb").onChange((v) => {
          draft.id = v.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "")
        })
      })

    new Setting(mgrRoot)
      .setName("Display Name")
      .addText((t) => {
        displayNameInput = t
        t.setPlaceholder("brorb").onChange((v) => {
          draft.display_name = v.trim()
        })
      })

    new Setting(mgrRoot)
      .setName("Username")
      .addText((t) => {
        usernameInput = t
        t.setPlaceholder("brorb").onChange((v) => {
          draft.username = v.trim()
        })
      })

    new Setting(mgrRoot)
      .setName("Colour")
      .addText((t) => {
        colourInput = t
        t.setPlaceholder("#FFDA43").onChange((v) => {
          draft.color = v.trim()
        })
      })

    new Setting(mgrRoot)
      .setName("Avatar URL")
      .addText((t) => {
        avatarInput = t
        t
          .setPlaceholder(DEFAULT_AVATAR)
          .onChange((v) => {
            draft.avatar_url = v.trim()
          })
      })

    new Setting(mgrRoot).addButton((btn) =>
      btn
        .setButtonText("Add Profile")
        .setCta()
        .onClick(async () => {
          if (!draft.id) {
            new Notice("Profile ID is required.")
            return
          }
          if (this.plugin.settings.profiles[draft.id]) {
            new Notice(`Profile "${draft.id}" already exists.`)
            return
          }
          if (!draft.display_name && !draft.username) {
            new Notice("At least a display name or username is needed.")
            return
          }
          const profile: DiscordProfile = {
            id: draft.id,
            display_name: draft.display_name || draft.username || draft.id,
            username: draft.username || draft.display_name || draft.id,
            color: draft.color || undefined,
            avatar_url: draft.avatar_url || undefined,
          }
          this.plugin.settings.profiles[draft.id] = profile
          await this.plugin.saveSettings()
          new Notice(`Profile "${draft.id}" saved.`)
          this.renderInlineProfileList(listContainer, mgrRoot)
        }),
    )
  }

  /* ── Modal styles ── */

  private applyModalStyles() {
    const style = document.createElement("style")
    style.textContent = `
      .modal:has(.discord-manual-embed-modal) {
        width: 760px;
        max-width: 90vw;
      }
      .discord-manual-embed-modal .modal-content {
        padding: 16px 20px;
      }
      .discord-modal-bottom-bar {
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid var(--background-modifier-border);
      }
      .discord-ts-row { margin-top: 8px; margin-bottom: 4px; }
      .discord-ts-label { display: block; font-weight: 500; margin-bottom: 4px; }
      .discord-ts-inputs { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
      .discord-ts-date,
      .discord-ts-time,
      .discord-ts-tz {
        padding: 6px 8px; border-radius: 6px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary); color: var(--text-normal);
        font-size: 0.93em;
      }
      .discord-ts-date { width: 150px; }
      .discord-ts-time { width: 110px; }
      .discord-ts-tz { flex: 1; min-width: 180px; }
      .discord-ts-hint { display: block; margin-top: 4px; color: var(--text-muted); font-size: 0.82em; }
    `
    this.contentEl.prepend(style)
    this.modalEl.style.width = "760px"
    this.modalEl.style.maxWidth = "90vw"
    this.modalEl.style.maxHeight = "none"
  }
}
