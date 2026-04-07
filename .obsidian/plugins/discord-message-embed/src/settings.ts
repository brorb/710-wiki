import { App, PluginSettingTab, Setting, Notice, TextComponent } from "obsidian"
import type DiscordMessageEmbedPlugin from "./main"
import type { DiscordProfile } from "./types"
import { DEFAULT_AVATAR } from "./types"
import { normaliseColour, normalizeUsername, extractAvatarId } from "./utils"

export class DiscordEmbedSettingTab extends PluginSettingTab {
  plugin: DiscordMessageEmbedPlugin

  constructor(app: App, plugin: DiscordMessageEmbedPlugin) {
    super(app, plugin)
    this.plugin = plugin
  }

  display(): void {
    const { containerEl } = this
    containerEl.empty()

    /* ── API ── */
    containerEl.createEl("h2", { text: "General" })

    new Setting(containerEl)
      .setName("API endpoint")
      .setDesc("URL used to fetch Discord messages from server links.")
      .addText((text) =>
        text
          .setPlaceholder("https://…")
          .setValue(this.plugin.settings.apiEndpoint)
          .onChange(async (value) => {
            this.plugin.settings.apiEndpoint = value.trim()
            await this.plugin.saveSettings()
          }),
      )

    new Setting(containerEl)
      .setName("Default Avatar URL/Path")
      .setDesc("URL or Obsidian-relative/absolute local path to the default avatar (e.g. Content/Media/Avatars/default.png). Used when a profile lacks an avatar.")
      .addText((text) =>
        text
          .setPlaceholder(DEFAULT_AVATAR)
          .setValue(this.plugin.settings.defaultAvatarUrl ?? "")
          .onChange(async (value) => {
            this.plugin.settings.defaultAvatarUrl = value.trim()
            await this.plugin.saveSettings()
          }),
      )

    /* ── Profiles ── */
    containerEl.createEl("h2", { text: "Discord Profiles" })
    containerEl.createEl("p", {
      text: "Manage reusable author profiles. Use the profile ID in your discord blocks instead of repeating avatar URLs and colours.",
      cls: "setting-item-description",
    })

    // "Add profile" button
    const addProfileSetting = new Setting(containerEl)
      .setName("Add new profile")
      .addButton((btn) =>
        btn
          .setButtonText("+ New Profile")
          .setCta()
          .onClick(() => {
            this.openProfileEditor(containerEl, undefined, addProfileSetting.settingEl)
          }),
      )
      .addButton((btn) =>
        btn
          .setButtonText("Merge Duplicates")
          .onClick(() => {
            this.mergeDuplicateProfiles(containerEl)
          }),
      )

    // List existing profiles
    const profileContainer = containerEl.createDiv("discord-profiles-list")
    this.renderProfileList(profileContainer)
  }

  private renderProfileList(container: HTMLElement): void {
    container.empty()

    const profiles = this.plugin.settings.profiles
    const keys = Object.keys(profiles).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" }),
    )

    if (keys.length === 0) {
      container.createEl("p", {
        text: "No profiles yet. Click '+ New Profile' to create one.",
        cls: "setting-item-description",
      })
      return
    }

    for (const key of keys) {
      const p = profiles[key]
      const row = new Setting(container)

      // Build a nice visual label
      const frag = document.createDocumentFragment()
      if (p.avatar_url) {
        const img = frag.createEl("img", {
          attr: {
            src: this.resolveAvatar(p.avatar_url),
            width: "24",
            height: "24",
            style: "border-radius:50%;vertical-align:middle;margin-right:8px;",
          },
        })
        // Fallback if avatar fails
        img.onerror = () => {
          img.style.display = "none"
        }
      }
      const nameSpan = frag.createEl("span", {
        text: p.display_name || p.username,
      })
      if (p.color) {
        nameSpan.style.color = p.color
        nameSpan.style.fontWeight = "600"
      }
      frag.createEl("span", {
        text: `  (${key})`,
        cls: "setting-item-description",
        attr: { style: "margin-left:6px;font-size:0.85em;" },
      })

      row.settingEl.prepend(frag)
      row.setName("") // clear default name since we use the fragment

      row
        .addButton((btn) =>
          btn
            .setButtonText("Edit")
            .onClick(() => {
              this.openProfileEditor(container.parentElement!, p)
            }),
        )
        .addButton((btn) =>
          btn
            .setButtonText("Delete")
            .setWarning()
            .onClick(async () => {
              delete this.plugin.settings.profiles[key]
              await this.plugin.saveSettings()
              this.renderProfileList(container)
              new Notice(`Profile "${key}" deleted.`)
            }),
        )
    }
  }

  /** Resolve a vault-relative avatar path to a displayable src. */
  private resolveAvatar(urlOrPath: string): string {
    if (!urlOrPath) return ""
    if (/^https?:\/\//.test(urlOrPath) || urlOrPath.startsWith("app://")) return urlOrPath
    return this.app.vault.adapter.getResourcePath(urlOrPath)
  }

  /**
   * Scan all profiles and merge duplicates.
   * Groups by: 1) avatar hash, 2) normalized username.
   * Keeps the profile with the most complete data (most fields filled).
   */
  private async mergeDuplicateProfiles(parentEl: HTMLElement): Promise<void> {
    const profiles = this.plugin.settings.profiles
    const keys = Object.keys(profiles)
    if (keys.length < 2) {
      new Notice("Nothing to merge — fewer than 2 profiles.")
      return
    }

    // Build groups of duplicate profile keys
    const groups: Map<string, string[]> = new Map()
    const assigned = new Set<string>()

    for (let i = 0; i < keys.length; i++) {
      if (assigned.has(keys[i])) continue
      const group = [keys[i]]
      assigned.add(keys[i])
      const pi = profiles[keys[i]]
      const piAvatarHash = pi.avatar_url ? extractAvatarId(pi.avatar_url) : null
      const piNormalized = normalizeUsername(pi.username)

      for (let j = i + 1; j < keys.length; j++) {
        if (assigned.has(keys[j])) continue
        const pj = profiles[keys[j]]
        const pjAvatarHash = pj.avatar_url ? extractAvatarId(pj.avatar_url) : null
        const pjNormalized = normalizeUsername(pj.username)

        const sameAvatar = piAvatarHash && pjAvatarHash && piAvatarHash === pjAvatarHash
        const sameUsername = piNormalized.length >= 3 && piNormalized === pjNormalized

        if (sameAvatar || sameUsername) {
          group.push(keys[j])
          assigned.add(keys[j])
        }
      }

      if (group.length > 1) {
        groups.set(keys[i], group)
      }
    }

    if (groups.size === 0) {
      new Notice("No duplicate profiles found.")
      return
    }

    // Merge each group: keep the profile with the most data, delete the rest
    let merged = 0
    let removed = 0
    for (const [, group] of groups) {
      // Score each profile by data completeness
      const scored = group.map((key) => {
        const p = profiles[key]
        let score = 0
        if (p.display_name) score++
        if (p.username) score++
        if (p.color) score++
        if (p.avatar_url) score++
        // Prefer shorter/cleaner IDs
        if (!/[-]\d+$/.test(key)) score++
        return { key, score }
      })
      scored.sort((a, b) => b.score - a.score)

      const keeper = profiles[scored[0].key]

      // Merge missing fields from duplicates into the keeper
      for (let i = 1; i < scored.length; i++) {
        const dup = profiles[scored[i].key]
        if (!keeper.color && dup.color) keeper.color = dup.color
        if (!keeper.avatar_url && dup.avatar_url) keeper.avatar_url = dup.avatar_url
        if (!keeper.display_name && dup.display_name) keeper.display_name = dup.display_name
        delete profiles[scored[i].key]
        removed++
      }
      merged++
    }

    await this.plugin.saveSettings()
    new Notice(`Merged ${merged} group(s), removed ${removed} duplicate profile(s).`)
    this.display()
  }

  /**
   * Renders inline profile editor fields within the settings tab.
   * If `existing` is provided, it pre-fills the form for editing.
   */
  private openProfileEditor(
    parentEl: HTMLElement,
    existing?: DiscordProfile,
    afterEl?: HTMLElement,
  ): void {
    // Remove any existing editor panel first
    parentEl.querySelector(".discord-profile-editor")?.remove()

    const editor = parentEl.createDiv("discord-profile-editor")
    // Insert right after the trigger element if provided
    if (afterEl?.nextSibling) {
      parentEl.insertBefore(editor, afterEl.nextSibling)
    } else if (afterEl) {
      afterEl.after(editor)
    }
    editor.style.border = "1px solid var(--background-modifier-border)"
    editor.style.borderRadius = "8px"
    editor.style.padding = "12px 16px"
    editor.style.marginBottom = "12px"
    editor.style.backgroundColor = "var(--background-secondary)"

    editor.createEl("h3", {
      text: existing ? `Edit profile: ${existing.id}` : "New Profile",
    })

    const draft: Partial<DiscordProfile> = existing
      ? { ...existing }
      : { id: "", display_name: "", username: "", color: "", avatar_url: "" }

    // Keep references to text inputs so auto-fill can update them
    let idInput: TextComponent | null = null
    let displayNameInput: TextComponent | null = null
    let usernameInput: TextComponent | null = null
    let colourInput: TextComponent | null = null
    let avatarInput: TextComponent | null = null

    // ── Auto-fill from Discord message URL ──
    new Setting(editor)
      .setName("Auto-fill from message URL")
      .setDesc("Paste any Discord message URL from this user — the plugin will fetch their name, avatar, and colour automatically.")
      .addText((text) =>
        text.setPlaceholder("https://discord.com/channels/…"),
      )
      .addButton((btn) =>
        btn
          .setButtonText("Fetch")
          .setCta()
          .onClick(async () => {
            const urlInput = editor.querySelector<HTMLInputElement>(
              ".setting-item:first-of-type input[type=text]",
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
                new Notice("Message fetched but no author info found.")
                return
              }
              const fetchedUsername = author.username?.trim() ?? ""
              const fetchedDisplay = author.display_name?.trim() ?? fetchedUsername
              const fetchedAvatar = author.avatar_url ?? ""
              const fetchedColour = normaliseColour(
                author.color ?? author.colour,
                author.colour_value,
              ) ?? ""

              // Update draft + input fields
              draft.display_name = fetchedDisplay
              draft.username = fetchedUsername
              draft.avatar_url = fetchedAvatar
              draft.color = fetchedColour

              if (!existing && !draft.id && fetchedUsername) {
                draft.id = fetchedUsername.toLowerCase().replace(/[^a-z0-9_-]/g, "")
                idInput?.setValue(draft.id)
              }
              displayNameInput?.setValue(fetchedDisplay)
              usernameInput?.setValue(fetchedUsername)
              colourInput?.setValue(fetchedColour)
              avatarInput?.setValue(fetchedAvatar)

              new Notice(`Filled profile from @${fetchedUsername}`)
            } catch (e) {
              console.error(e)
              new Notice("Failed to fetch message. Check the URL and API endpoint.")
            } finally {
              loading.hide()
            }
          }),
      )

    // Profile ID (only editable for new profiles)
    if (!existing) {
      new Setting(editor)
        .setName("Profile ID")
        .setDesc(
          'Short unique key used in markdown, e.g. "brorb" or "system".',
        )
        .addText((text) => {
          idInput = text
          text
            .setPlaceholder("brorb")
            .setValue(draft.id ?? "")
            .onChange((v) => {
              draft.id = v
                .trim()
                .toLowerCase()
                .replace(/[^a-z0-9_-]/g, "")
            })
        })
    }

    new Setting(editor)
      .setName("Display name")
      .setDesc("Shown as the author in the embed.")
      .addText((text) => {
        displayNameInput = text
        text
          .setPlaceholder("brorb")
          .setValue(draft.display_name ?? "")
          .onChange((v) => {
            draft.display_name = v.trim()
          })
      })

    new Setting(editor)
      .setName("Username")
      .setDesc("The Discord @username.")
      .addText((text) => {
        usernameInput = text
        text
          .setPlaceholder("brorb")
          .setValue(draft.username ?? "")
          .onChange((v) => {
            draft.username = v.trim()
          })
      })

    new Setting(editor)
      .setName("Colour")
      .setDesc("Hex colour for the author name, e.g. #FFDA43.")
      .addText((text) => {
        colourInput = text
        text
          .setPlaceholder("#FFDA43")
          .setValue(draft.color ?? "")
          .onChange((v) => {
            draft.color = v.trim()
          })
      })

    new Setting(editor)
      .setName("Avatar URL")
      .setDesc("Direct link or vault path to the profile picture.")
      .addText((text) => {
        avatarInput = text
        text
          .setPlaceholder(this.plugin.settings.defaultAvatarUrl || DEFAULT_AVATAR)
          .setValue(draft.avatar_url ?? "")
          .onChange((v) => {
            draft.avatar_url = v.trim()
          })
      })

    // Preview
    const previewContainer = editor.createDiv()
    previewContainer.style.marginTop = "8px"

    new Setting(editor)
      .addButton((btn) =>
        btn
          .setButtonText("Save")
          .setCta()
          .onClick(async () => {
            const id = existing ? existing.id : draft.id
            if (!id) {
              new Notice("Profile ID is required.")
              return
            }
            if (!existing && this.plugin.settings.profiles[id]) {
              new Notice(`Profile "${id}" already exists. Pick a different ID.`)
              return
            }
            if (!draft.display_name && !draft.username) {
              new Notice("At least a display name or username is required.")
              return
            }

            const profile: DiscordProfile = {
              id,
              display_name: draft.display_name || draft.username || id,
              username: draft.username || draft.display_name || id,
              color: draft.color || undefined,
              avatar_url: draft.avatar_url || undefined,
            }

            this.plugin.settings.profiles[id] = profile
            await this.plugin.saveSettings()

            // Download avatar locally if it's a remote URL
            if (profile.avatar_url && /^https?:\/\//.test(profile.avatar_url)) {
              const localPath = await this.plugin.downloadAvatar(profile.avatar_url, id)
              if (localPath) {
                profile.avatar_url = localPath
                await this.plugin.saveSettings()
              }
            }

            editor.remove()
            new Notice(`Profile "${id}" saved.`)
            // Re-render the whole tab to reflect the new profile
            this.display()
          }),
      )
      .addButton((btn) =>
        btn.setButtonText("Cancel").onClick(() => {
          editor.remove()
        }),
      )
  }
}
