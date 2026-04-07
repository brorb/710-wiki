"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => DiscordMessageEmbedPlugin
});
module.exports = __toCommonJS(main_exports);
var import_obsidian5 = require("obsidian");

// src/types.ts
var DEFAULT_SETTINGS = {
  apiEndpoint: "https://discord-system-firebase-bot-production.up.railway.app/api/message?url=",
  defaultAvatarUrl: "https://cdn.discordapp.com/embed/avatars/0.png",
  profiles: {},
  youtubeChannels: {}
};
var DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";

// src/utils.ts
function normaliseColour(input, numeric) {
  const trimmed = input?.trim();
  if (trimmed) {
    return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
  }
  if (typeof numeric === "number" && Number.isFinite(numeric)) {
    return `#${numeric.toString(16).padStart(6, "0")}`;
  }
  return void 0;
}
function normalizeUsername(username) {
  return username.toLowerCase().replace(/[._\-]/g, "");
}
function extractAvatarId(url) {
  const match = url.match(/\/avatars\/\d+\/([a-f0-9]+)/);
  return match ? match[1] : null;
}

// src/settings.ts
var import_obsidian = require("obsidian");
var DiscordEmbedSettingTab = class extends import_obsidian.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl("h2", { text: "General" });
    new import_obsidian.Setting(containerEl).setName("API endpoint").setDesc("URL used to fetch Discord messages from server links.").addText(
      (text) => text.setPlaceholder("https://\u2026").setValue(this.plugin.settings.apiEndpoint).onChange(async (value) => {
        this.plugin.settings.apiEndpoint = value.trim();
        await this.plugin.saveSettings();
      })
    );
    new import_obsidian.Setting(containerEl).setName("Default Avatar URL/Path").setDesc("URL or Obsidian-relative/absolute local path to the default avatar (e.g. Content/Media/Avatars/default.png). Used when a profile lacks an avatar.").addText(
      (text) => text.setPlaceholder(DEFAULT_AVATAR).setValue(this.plugin.settings.defaultAvatarUrl ?? "").onChange(async (value) => {
        this.plugin.settings.defaultAvatarUrl = value.trim();
        await this.plugin.saveSettings();
      })
    );
    containerEl.createEl("h2", { text: "Discord Profiles" });
    containerEl.createEl("p", {
      text: "Manage reusable author profiles. Use the profile ID in your discord blocks instead of repeating avatar URLs and colours.",
      cls: "setting-item-description"
    });
    const addProfileSetting = new import_obsidian.Setting(containerEl).setName("Add new profile").addButton(
      (btn) => btn.setButtonText("+ New Profile").setCta().onClick(() => {
        this.openProfileEditor(containerEl, void 0, addProfileSetting.settingEl);
      })
    ).addButton(
      (btn) => btn.setButtonText("Merge Duplicates").onClick(() => {
        this.mergeDuplicateProfiles(containerEl);
      })
    );
    const profileContainer = containerEl.createDiv("discord-profiles-list");
    this.renderProfileList(profileContainer);
  }
  renderProfileList(container) {
    container.empty();
    const profiles = this.plugin.settings.profiles;
    const keys = Object.keys(profiles).sort(
      (a, b) => a.localeCompare(b, void 0, { sensitivity: "base" })
    );
    if (keys.length === 0) {
      container.createEl("p", {
        text: "No profiles yet. Click '+ New Profile' to create one.",
        cls: "setting-item-description"
      });
      return;
    }
    for (const key of keys) {
      const p = profiles[key];
      const row = new import_obsidian.Setting(container);
      const frag = document.createDocumentFragment();
      if (p.avatar_url) {
        const img = frag.createEl("img", {
          attr: {
            src: this.resolveAvatar(p.avatar_url),
            width: "24",
            height: "24",
            style: "border-radius:50%;vertical-align:middle;margin-right:8px;"
          }
        });
        img.onerror = () => {
          img.style.display = "none";
        };
      }
      const nameSpan = frag.createEl("span", {
        text: p.display_name || p.username
      });
      if (p.color) {
        nameSpan.style.color = p.color;
        nameSpan.style.fontWeight = "600";
      }
      frag.createEl("span", {
        text: `  (${key})`,
        cls: "setting-item-description",
        attr: { style: "margin-left:6px;font-size:0.85em;" }
      });
      row.settingEl.prepend(frag);
      row.setName("");
      row.addButton(
        (btn) => btn.setButtonText("Edit").onClick(() => {
          this.openProfileEditor(container.parentElement, p);
        })
      ).addButton(
        (btn) => btn.setButtonText("Delete").setWarning().onClick(async () => {
          delete this.plugin.settings.profiles[key];
          await this.plugin.saveSettings();
          this.renderProfileList(container);
          new import_obsidian.Notice(`Profile "${key}" deleted.`);
        })
      );
    }
  }
  /** Resolve a vault-relative avatar path to a displayable src. */
  resolveAvatar(urlOrPath) {
    if (!urlOrPath) return "";
    if (/^https?:\/\//.test(urlOrPath) || urlOrPath.startsWith("app://")) return urlOrPath;
    return this.app.vault.adapter.getResourcePath(urlOrPath);
  }
  /**
   * Scan all profiles and merge duplicates.
   * Groups by: 1) avatar hash, 2) normalized username.
   * Keeps the profile with the most complete data (most fields filled).
   */
  async mergeDuplicateProfiles(parentEl) {
    const profiles = this.plugin.settings.profiles;
    const keys = Object.keys(profiles);
    if (keys.length < 2) {
      new import_obsidian.Notice("Nothing to merge \u2014 fewer than 2 profiles.");
      return;
    }
    const groups = /* @__PURE__ */ new Map();
    const assigned = /* @__PURE__ */ new Set();
    for (let i = 0; i < keys.length; i++) {
      if (assigned.has(keys[i])) continue;
      const group = [keys[i]];
      assigned.add(keys[i]);
      const pi = profiles[keys[i]];
      const piAvatarHash = pi.avatar_url ? extractAvatarId(pi.avatar_url) : null;
      const piNormalized = normalizeUsername(pi.username);
      for (let j = i + 1; j < keys.length; j++) {
        if (assigned.has(keys[j])) continue;
        const pj = profiles[keys[j]];
        const pjAvatarHash = pj.avatar_url ? extractAvatarId(pj.avatar_url) : null;
        const pjNormalized = normalizeUsername(pj.username);
        const sameAvatar = piAvatarHash && pjAvatarHash && piAvatarHash === pjAvatarHash;
        const sameUsername = piNormalized.length >= 3 && piNormalized === pjNormalized;
        if (sameAvatar || sameUsername) {
          group.push(keys[j]);
          assigned.add(keys[j]);
        }
      }
      if (group.length > 1) {
        groups.set(keys[i], group);
      }
    }
    if (groups.size === 0) {
      new import_obsidian.Notice("No duplicate profiles found.");
      return;
    }
    let merged = 0;
    let removed = 0;
    for (const [, group] of groups) {
      const scored = group.map((key) => {
        const p = profiles[key];
        let score = 0;
        if (p.display_name) score++;
        if (p.username) score++;
        if (p.color) score++;
        if (p.avatar_url) score++;
        if (!/[-]\d+$/.test(key)) score++;
        return { key, score };
      });
      scored.sort((a, b) => b.score - a.score);
      const keeper = profiles[scored[0].key];
      for (let i = 1; i < scored.length; i++) {
        const dup = profiles[scored[i].key];
        if (!keeper.color && dup.color) keeper.color = dup.color;
        if (!keeper.avatar_url && dup.avatar_url) keeper.avatar_url = dup.avatar_url;
        if (!keeper.display_name && dup.display_name) keeper.display_name = dup.display_name;
        delete profiles[scored[i].key];
        removed++;
      }
      merged++;
    }
    await this.plugin.saveSettings();
    new import_obsidian.Notice(`Merged ${merged} group(s), removed ${removed} duplicate profile(s).`);
    this.display();
  }
  /**
   * Renders inline profile editor fields within the settings tab.
   * If `existing` is provided, it pre-fills the form for editing.
   */
  openProfileEditor(parentEl, existing, afterEl) {
    parentEl.querySelector(".discord-profile-editor")?.remove();
    const editor = parentEl.createDiv("discord-profile-editor");
    if (afterEl?.nextSibling) {
      parentEl.insertBefore(editor, afterEl.nextSibling);
    } else if (afterEl) {
      afterEl.after(editor);
    }
    editor.style.border = "1px solid var(--background-modifier-border)";
    editor.style.borderRadius = "8px";
    editor.style.padding = "12px 16px";
    editor.style.marginBottom = "12px";
    editor.style.backgroundColor = "var(--background-secondary)";
    editor.createEl("h3", {
      text: existing ? `Edit profile: ${existing.id}` : "New Profile"
    });
    const draft = existing ? { ...existing } : { id: "", display_name: "", username: "", color: "", avatar_url: "" };
    let idInput = null;
    let displayNameInput = null;
    let usernameInput = null;
    let colourInput = null;
    let avatarInput = null;
    new import_obsidian.Setting(editor).setName("Auto-fill from message URL").setDesc("Paste any Discord message URL from this user \u2014 the plugin will fetch their name, avatar, and colour automatically.").addText(
      (text) => text.setPlaceholder("https://discord.com/channels/\u2026")
    ).addButton(
      (btn) => btn.setButtonText("Fetch").setCta().onClick(async () => {
        const urlInput = editor.querySelector(
          ".setting-item:first-of-type input[type=text]"
        );
        const url = urlInput?.value?.trim();
        if (!url || !/discord\.com\/channels\/\d+\/\d+\/\d+/i.test(url)) {
          new import_obsidian.Notice("Paste a valid Discord message URL first.");
          return;
        }
        const loading = new import_obsidian.Notice("Fetching author info\u2026", 0);
        try {
          const msg = await this.plugin.fetchDiscordMessage(url);
          const author = msg.author;
          if (!author) {
            new import_obsidian.Notice("Message fetched but no author info found.");
            return;
          }
          const fetchedUsername = author.username?.trim() ?? "";
          const fetchedDisplay = author.display_name?.trim() ?? fetchedUsername;
          const fetchedAvatar = author.avatar_url ?? "";
          const fetchedColour = normaliseColour(
            author.color ?? author.colour,
            author.colour_value
          ) ?? "";
          draft.display_name = fetchedDisplay;
          draft.username = fetchedUsername;
          draft.avatar_url = fetchedAvatar;
          draft.color = fetchedColour;
          if (!existing && !draft.id && fetchedUsername) {
            draft.id = fetchedUsername.toLowerCase().replace(/[^a-z0-9_-]/g, "");
            idInput?.setValue(draft.id);
          }
          displayNameInput?.setValue(fetchedDisplay);
          usernameInput?.setValue(fetchedUsername);
          colourInput?.setValue(fetchedColour);
          avatarInput?.setValue(fetchedAvatar);
          new import_obsidian.Notice(`Filled profile from @${fetchedUsername}`);
        } catch (e) {
          console.error(e);
          new import_obsidian.Notice("Failed to fetch message. Check the URL and API endpoint.");
        } finally {
          loading.hide();
        }
      })
    );
    if (!existing) {
      new import_obsidian.Setting(editor).setName("Profile ID").setDesc(
        'Short unique key used in markdown, e.g. "brorb" or "system".'
      ).addText((text) => {
        idInput = text;
        text.setPlaceholder("brorb").setValue(draft.id ?? "").onChange((v) => {
          draft.id = v.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
        });
      });
    }
    new import_obsidian.Setting(editor).setName("Display name").setDesc("Shown as the author in the embed.").addText((text) => {
      displayNameInput = text;
      text.setPlaceholder("brorb").setValue(draft.display_name ?? "").onChange((v) => {
        draft.display_name = v.trim();
      });
    });
    new import_obsidian.Setting(editor).setName("Username").setDesc("The Discord @username.").addText((text) => {
      usernameInput = text;
      text.setPlaceholder("brorb").setValue(draft.username ?? "").onChange((v) => {
        draft.username = v.trim();
      });
    });
    new import_obsidian.Setting(editor).setName("Colour").setDesc("Hex colour for the author name, e.g. #FFDA43.").addText((text) => {
      colourInput = text;
      text.setPlaceholder("#FFDA43").setValue(draft.color ?? "").onChange((v) => {
        draft.color = v.trim();
      });
    });
    new import_obsidian.Setting(editor).setName("Avatar URL").setDesc("Direct link or vault path to the profile picture.").addText((text) => {
      avatarInput = text;
      text.setPlaceholder(this.plugin.settings.defaultAvatarUrl || DEFAULT_AVATAR).setValue(draft.avatar_url ?? "").onChange((v) => {
        draft.avatar_url = v.trim();
      });
    });
    const previewContainer = editor.createDiv();
    previewContainer.style.marginTop = "8px";
    new import_obsidian.Setting(editor).addButton(
      (btn) => btn.setButtonText("Save").setCta().onClick(async () => {
        const id = existing ? existing.id : draft.id;
        if (!id) {
          new import_obsidian.Notice("Profile ID is required.");
          return;
        }
        if (!existing && this.plugin.settings.profiles[id]) {
          new import_obsidian.Notice(`Profile "${id}" already exists. Pick a different ID.`);
          return;
        }
        if (!draft.display_name && !draft.username) {
          new import_obsidian.Notice("At least a display name or username is required.");
          return;
        }
        const profile = {
          id,
          display_name: draft.display_name || draft.username || id,
          username: draft.username || draft.display_name || id,
          color: draft.color || void 0,
          avatar_url: draft.avatar_url || void 0
        };
        this.plugin.settings.profiles[id] = profile;
        await this.plugin.saveSettings();
        if (profile.avatar_url && /^https?:\/\//.test(profile.avatar_url)) {
          const localPath = await this.plugin.downloadAvatar(profile.avatar_url, id);
          if (localPath) {
            profile.avatar_url = localPath;
            await this.plugin.saveSettings();
          }
        }
        editor.remove();
        new import_obsidian.Notice(`Profile "${id}" saved.`);
        this.display();
      })
    ).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => {
        editor.remove();
      })
    );
  }
};

// src/modal.ts
var import_obsidian2 = require("obsidian");
var COMMON_TIMEZONES = [
  { value: "Pacific/Auckland", label: "Auckland (NZST)" },
  { value: "Australia/Sydney", label: "Sydney (AEST)" },
  { value: "Asia/Tokyo", label: "Tokyo (JST)" },
  { value: "Asia/Shanghai", label: "Shanghai (CST)" },
  { value: "Asia/Kolkata", label: "India (IST)" },
  { value: "Asia/Dubai", label: "Dubai (GST)" },
  { value: "Europe/Moscow", label: "Moscow (MSK)" },
  { value: "Europe/Istanbul", label: "Istanbul (TRT)" },
  { value: "Europe/Helsinki", label: "Helsinki (EET)" },
  { value: "Europe/Berlin", label: "Berlin (CET)" },
  { value: "Europe/Paris", label: "Paris (CET)" },
  { value: "Europe/Oslo", label: "Oslo (CET)" },
  { value: "Europe/London", label: "London (GMT)" },
  { value: "Atlantic/Reykjavik", label: "Reykjavik (GMT)" },
  { value: "America/Sao_Paulo", label: "S\xE3o Paulo (BRT)" },
  { value: "America/New_York", label: "New York (ET)" },
  { value: "America/Chicago", label: "Chicago (CT)" },
  { value: "America/Denver", label: "Denver (MT)" },
  { value: "America/Los_Angeles", label: "Los Angeles (PT)" },
  { value: "America/Anchorage", label: "Anchorage (AKT)" },
  { value: "Pacific/Honolulu", label: "Honolulu (HST)" },
  { value: "UTC", label: "UTC" }
];
function getLocalTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return "UTC";
  }
}
function wallClockToISO(dateVal, timeVal, tz) {
  if (!dateVal) return (/* @__PURE__ */ new Date()).toISOString();
  const time = timeVal || "12:00";
  const [year, month, day] = dateVal.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const naiveUtcMs = Date.UTC(year, month - 1, day, hour, minute, 0);
  try {
    const probe = new Date(naiveUtcMs);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(probe);
    const g = (t) => parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
    const wallMs = Date.UTC(
      g("year"),
      g("month") - 1,
      g("day"),
      g("hour") % 24,
      g("minute"),
      g("second")
    );
    return new Date(naiveUtcMs - (wallMs - naiveUtcMs)).toISOString();
  } catch {
    return new Date(naiveUtcMs).toISOString();
  }
}
var ManualEmbedModal = class extends import_obsidian2.Modal {
  constructor(app, plugin, editor, mode) {
    super(app);
    this.messages = [];
    this.plugin = plugin;
    this.editor = editor;
    this.mode = mode;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("discord-manual-embed-modal");
    this.applyModalStyles();
    contentEl.createEl("h2", {
      text: this.mode === "embed" ? "Insert Manual Discord Messages" : "Insert Manual Discord Citation"
    });
    const profileKeys = Object.keys(this.plugin.settings.profiles);
    if (profileKeys.length === 0) {
      contentEl.createEl("p", {
        text: "No profiles found. Create one first!",
        cls: "mod-warning"
      });
    }
    if (this.messages.length === 0) {
      this.messages.push(this.createEmptyDraft());
    }
    this.messageContainer = contentEl.createDiv("discord-messages-list");
    this.renderAllMessages();
    const bottomBar = contentEl.createDiv("discord-modal-bottom-bar");
    new import_obsidian2.Setting(bottomBar).addButton(
      (btn) => btn.setButtonText("+ Add Message").onClick(() => {
        this.messages.push(this.createEmptyDraft());
        this.renderAllMessages();
      })
    );
    new import_obsidian2.Setting(bottomBar).addButton(
      (btn) => btn.setButtonText(this.mode === "embed" ? "Insert Embed" : "Insert Citation").setCta().onClick(() => {
        this.doInsert();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
  /* ── Rendering ── */
  renderAllMessages() {
    this.messageContainer.empty();
    this.messages.forEach((msg, index) => {
      this.renderMessageBlock(this.messageContainer, msg, index);
    });
  }
  renderMessageBlock(container, draft, index) {
    const wrapper = container.createDiv("discord-msg-block");
    wrapper.style.border = "1px solid var(--background-modifier-border)";
    wrapper.style.borderRadius = "8px";
    wrapper.style.padding = "10px 14px";
    wrapper.style.marginBottom = "10px";
    wrapper.style.backgroundColor = "var(--background-secondary)";
    const header = wrapper.createDiv();
    header.style.display = "flex";
    header.style.alignItems = "center";
    header.style.justifyContent = "space-between";
    header.style.marginBottom = "6px";
    header.createEl("strong", { text: `Message ${index + 1}` });
    if (this.messages.length > 1) {
      const removeBtn = header.createEl("button", { text: "\u2715" });
      removeBtn.style.cursor = "pointer";
      removeBtn.style.background = "none";
      removeBtn.style.border = "none";
      removeBtn.style.color = "var(--text-error)";
      removeBtn.style.fontSize = "1.1em";
      removeBtn.addEventListener("click", () => {
        this.messages.splice(index, 1);
        this.renderAllMessages();
      });
    }
    const profileSetting = new import_obsidian2.Setting(wrapper).setName("Profile");
    const avatarPreview = wrapper.createEl("img", {
      attr: {
        width: "32",
        height: "32",
        style: "border-radius:50%;margin-right:8px;vertical-align:middle;display:none;"
      }
    });
    avatarPreview.onerror = () => {
      avatarPreview.style.display = "none";
    };
    profileSetting.settingEl.querySelector(".setting-item-control")?.prepend(avatarPreview);
    const updateAvatarPreview = (profileId) => {
      const p = this.plugin.settings.profiles[profileId];
      if (p?.avatar_url) {
        avatarPreview.src = this.resolveAvatar(p.avatar_url);
        avatarPreview.style.display = "inline-block";
      } else {
        avatarPreview.style.display = "none";
      }
    };
    profileSetting.addDropdown((dropdown) => {
      dropdown.addOption("", "\u2014 Select profile \u2014");
      const profiles = this.plugin.settings.profiles;
      for (const key of Object.keys(profiles).sort()) {
        const p = profiles[key];
        dropdown.addOption(key, `${p.display_name} (@${p.username})`);
      }
      dropdown.setValue(draft.profileId);
      dropdown.onChange((value) => {
        draft.profileId = value;
        updateAvatarPreview(value);
      });
      updateAvatarPreview(draft.profileId);
    });
    profileSetting.addButton(
      (btn) => btn.setButtonText("Manage Profiles").onClick(() => {
        this.openInlineProfileManager();
      })
    );
    const tsRow = wrapper.createDiv("discord-ts-row");
    tsRow.createEl("label", { text: "Timestamp", cls: "discord-ts-label" });
    const tsInputs = tsRow.createDiv("discord-ts-inputs");
    const dateInput = tsInputs.createEl("input", { type: "date", cls: "discord-ts-date" });
    dateInput.value = draft.dateVal;
    dateInput.addEventListener("change", () => {
      draft.dateVal = dateInput.value;
    });
    const timeInput = tsInputs.createEl("input", { type: "time", cls: "discord-ts-time" });
    timeInput.value = draft.timeVal;
    timeInput.addEventListener("change", () => {
      draft.timeVal = timeInput.value;
    });
    const tzSelect = tsInputs.createEl("select", { cls: "discord-ts-tz" });
    for (const tz of COMMON_TIMEZONES) {
      const opt = tzSelect.createEl("option", { value: tz.value, text: tz.label });
      if (tz.value === draft.timezone) opt.selected = true;
    }
    if (!COMMON_TIMEZONES.some((t) => t.value === draft.timezone) && draft.timezone) {
      const opt = tzSelect.createEl("option", { value: draft.timezone, text: draft.timezone });
      opt.selected = true;
      tzSelect.prepend(opt);
    }
    tzSelect.addEventListener("change", () => {
      draft.timezone = tzSelect.value;
    });
    tsRow.createEl("small", { text: "Leave blank for current time.", cls: "discord-ts-hint" });
    const contentLabel = wrapper.createEl("label", {
      text: "Message content"
    });
    contentLabel.style.display = "block";
    contentLabel.style.marginTop = "8px";
    contentLabel.style.marginBottom = "4px";
    contentLabel.style.fontWeight = "500";
    const textarea = wrapper.createEl("textarea");
    textarea.value = draft.content;
    textarea.placeholder = "Type the message here\u2026 newlines are preserved!";
    textarea.rows = 4;
    textarea.style.width = "100%";
    textarea.style.resize = "vertical";
    textarea.style.fontFamily = '"gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif';
    textarea.style.fontSize = "0.95em";
    textarea.style.padding = "8px";
    textarea.style.borderRadius = "6px";
    textarea.style.border = "1px solid var(--background-modifier-border)";
    textarea.style.backgroundColor = "var(--background-primary)";
    textarea.style.color = "var(--text-normal)";
    textarea.addEventListener("input", () => {
      draft.content = textarea.value;
    });
  }
  /* ── Insertion ── */
  doInsert() {
    const validMessages = this.messages.filter(
      (m) => m.profileId && m.content.trim()
    );
    if (validMessages.length === 0) {
      new import_obsidian2.Notice("Add at least one message with a profile and content.");
      return;
    }
    for (const m of validMessages) {
      if (!this.plugin.settings.profiles[m.profileId]) {
        new import_obsidian2.Notice(`Profile "${m.profileId}" not found. Was it deleted?`);
        return;
      }
    }
    const blocks = validMessages.map((m) => {
      const block = {
        profile: m.profileId,
        content: m.content,
        // Raw content with real newlines — JSON.stringify handles escaping
        timestamp: wallClockToISO(m.dateVal, m.timeVal, m.timezone || getLocalTimezone())
      };
      return block;
    });
    if (this.mode === "embed") {
      const json = JSON.stringify(blocks, null, 2);
      const block = "```discord\n" + json + "\n```";
      this.editor.replaceSelection(block);
    } else {
      const citationId = this.generateCitationId();
      const marker = `<!-- discord-cite:${citationId} -->`;
      const callout = this.buildCitationCallout(citationId, blocks);
      this.editor.replaceSelection(marker);
      if (callout.trim().length > 0) {
        const cursor = this.editor.getCursor();
        const fenceBlock = `

${callout}
`;
        this.editor.replaceRange(fenceBlock, cursor);
      }
    }
    new import_obsidian2.Notice(
      `Inserted ${validMessages.length} message${validMessages.length > 1 ? "s" : ""}.`
    );
    this.close();
  }
  buildCitationCallout(citationId, messages) {
    if (messages.length === 0) return "";
    const countLabel = messages.length === 1 ? "1 message" : `${messages.length} messages`;
    const payload = { id: citationId, messages };
    const jsonLines = JSON.stringify(payload, null, 2).split("\n");
    const lines = [
      `> [!discord-cite]- Discord citation (${countLabel})`,
      ">",
      "> ```json"
    ];
    jsonLines.forEach((line) => lines.push(`> ${line}`));
    lines.push("> ```");
    return lines.join("\n");
  }
  /** Resolve a vault-relative avatar path to a displayable src. */
  resolveAvatar(urlOrPath) {
    if (!urlOrPath) return "";
    if (/^https?:\/\//.test(urlOrPath) || urlOrPath.startsWith("app://")) return urlOrPath;
    return this.app.vault.adapter.getResourcePath(urlOrPath);
  }
  generateCitationId() {
    const random = Math.random().toString(36).slice(2, 8);
    const timestamp = Date.now().toString(36);
    return `cite-${timestamp}-${random}`;
  }
  createEmptyDraft() {
    const keys = Object.keys(this.plugin.settings.profiles).sort();
    return {
      profileId: keys[0] ?? "",
      content: "",
      dateVal: "",
      timeVal: "",
      timezone: getLocalTimezone()
    };
  }
  /* ── Inline Profile Manager ── */
  openInlineProfileManager() {
    const { contentEl } = this;
    contentEl.querySelector(".discord-inline-profile-mgr")?.remove();
    const mgr = contentEl.createDiv("discord-inline-profile-mgr");
    mgr.style.border = "2px solid var(--interactive-accent)";
    mgr.style.borderRadius = "10px";
    mgr.style.padding = "14px 18px";
    mgr.style.marginTop = "12px";
    mgr.style.backgroundColor = "var(--background-secondary)";
    mgr.createEl("h3", { text: "Manage Profiles" });
    const listDiv = mgr.createDiv();
    this.renderInlineProfileList(listDiv, mgr);
    mgr.createEl("hr");
    mgr.createEl("h4", { text: "Add New Profile" });
    this.renderInlineProfileForm(mgr, listDiv);
    new import_obsidian2.Setting(mgr).addButton(
      (btn) => btn.setButtonText("Done").setCta().onClick(() => {
        mgr.remove();
        this.renderAllMessages();
      })
    );
  }
  renderInlineProfileList(container, mgrRoot) {
    container.empty();
    const profiles = this.plugin.settings.profiles;
    const keys = Object.keys(profiles).sort();
    if (keys.length === 0) {
      container.createEl("p", { text: "No profiles yet." });
      return;
    }
    for (const key of keys) {
      const p = profiles[key];
      const row = new import_obsidian2.Setting(container);
      const frag = document.createDocumentFragment();
      if (p.avatar_url) {
        const img = frag.createEl("img", {
          attr: {
            src: this.resolveAvatar(p.avatar_url),
            width: "20",
            height: "20",
            style: "border-radius:50%;vertical-align:middle;margin-right:6px;"
          }
        });
        img.onerror = () => {
          img.style.display = "none";
        };
      }
      const span = frag.createEl("span", { text: `${p.display_name} (${key})` });
      if (p.color) {
        span.style.color = p.color;
        span.style.fontWeight = "600";
      }
      row.nameEl.replaceChildren(frag);
      row.addButton(
        (btn) => btn.setButtonText("Delete").setWarning().onClick(async () => {
          delete this.plugin.settings.profiles[key];
          await this.plugin.saveSettings();
          this.renderInlineProfileList(container, mgrRoot);
        })
      );
    }
  }
  renderInlineProfileForm(mgrRoot, listContainer) {
    const draft = {};
    let idInput = null;
    let displayNameInput = null;
    let usernameInput = null;
    let colourInput = null;
    let avatarInput = null;
    new import_obsidian2.Setting(mgrRoot).setName("Auto-fill from URL").setDesc("Paste a Discord message URL from this user.").addText(
      (t) => t.setPlaceholder("https://discord.com/channels/\u2026")
    ).addButton(
      (btn) => btn.setButtonText("Fetch").setCta().onClick(async () => {
        const urlInput = mgrRoot.querySelector(
          ".setting-item:nth-of-type(1) input[type=text]"
        );
        const url = urlInput?.value?.trim();
        if (!url || !/discord\.com\/channels\/\d+\/\d+\/\d+/i.test(url)) {
          new import_obsidian2.Notice("Paste a valid Discord message URL first.");
          return;
        }
        const loading = new import_obsidian2.Notice("Fetching author info\u2026", 0);
        try {
          const msg = await this.plugin.fetchDiscordMessage(url);
          const author = msg.author;
          if (!author) {
            new import_obsidian2.Notice("No author info found.");
            return;
          }
          const fetchedUsername = author.username?.trim() ?? "";
          const fetchedDisplay = author.display_name?.trim() ?? fetchedUsername;
          const fetchedAvatar = author.avatar_url ?? "";
          const fetchedColour = normaliseColour(
            author.color ?? author.colour,
            author.colour_value
          ) ?? "";
          draft.display_name = fetchedDisplay;
          draft.username = fetchedUsername;
          draft.avatar_url = fetchedAvatar;
          draft.color = fetchedColour;
          if (!draft.id && fetchedUsername) {
            draft.id = fetchedUsername.toLowerCase().replace(/[^a-z0-9_-]/g, "");
            idInput?.setValue(draft.id);
          }
          displayNameInput?.setValue(fetchedDisplay);
          usernameInput?.setValue(fetchedUsername);
          colourInput?.setValue(fetchedColour);
          avatarInput?.setValue(fetchedAvatar);
          new import_obsidian2.Notice(`Filled from @${fetchedUsername}`);
        } catch (e) {
          console.error(e);
          new import_obsidian2.Notice("Failed to fetch. Check the URL.");
        } finally {
          loading.hide();
        }
      })
    );
    new import_obsidian2.Setting(mgrRoot).setName("ID").addText((t) => {
      idInput = t;
      t.setPlaceholder("brorb").onChange((v) => {
        draft.id = v.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
      });
    });
    new import_obsidian2.Setting(mgrRoot).setName("Display Name").addText((t) => {
      displayNameInput = t;
      t.setPlaceholder("brorb").onChange((v) => {
        draft.display_name = v.trim();
      });
    });
    new import_obsidian2.Setting(mgrRoot).setName("Username").addText((t) => {
      usernameInput = t;
      t.setPlaceholder("brorb").onChange((v) => {
        draft.username = v.trim();
      });
    });
    new import_obsidian2.Setting(mgrRoot).setName("Colour").addText((t) => {
      colourInput = t;
      t.setPlaceholder("#FFDA43").onChange((v) => {
        draft.color = v.trim();
      });
    });
    new import_obsidian2.Setting(mgrRoot).setName("Avatar URL").addText((t) => {
      avatarInput = t;
      t.setPlaceholder(DEFAULT_AVATAR).onChange((v) => {
        draft.avatar_url = v.trim();
      });
    });
    new import_obsidian2.Setting(mgrRoot).addButton(
      (btn) => btn.setButtonText("Add Profile").setCta().onClick(async () => {
        if (!draft.id) {
          new import_obsidian2.Notice("Profile ID is required.");
          return;
        }
        if (this.plugin.settings.profiles[draft.id]) {
          new import_obsidian2.Notice(`Profile "${draft.id}" already exists.`);
          return;
        }
        if (!draft.display_name && !draft.username) {
          new import_obsidian2.Notice("At least a display name or username is needed.");
          return;
        }
        const profile = {
          id: draft.id,
          display_name: draft.display_name || draft.username || draft.id,
          username: draft.username || draft.display_name || draft.id,
          color: draft.color || void 0,
          avatar_url: draft.avatar_url || void 0
        };
        this.plugin.settings.profiles[draft.id] = profile;
        await this.plugin.saveSettings();
        new import_obsidian2.Notice(`Profile "${draft.id}" saved.`);
        this.renderInlineProfileList(listContainer, mgrRoot);
      })
    );
  }
  /* ── Modal styles ── */
  applyModalStyles() {
    const style = document.createElement("style");
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
      .discord-ts-tz { flex: 1; min-width: 180px; padding: 6px 8px; border-radius: 6px;
        border: 1px solid var(--background-modifier-border);
        background: var(--background-primary); color: var(--text-normal); font-size: 0.93em; }
      .discord-ts-hint { display: block; margin-top: 4px; color: var(--text-muted); font-size: 0.82em; }
    `;
    this.contentEl.prepend(style);
    this.modalEl.style.width = "760px";
    this.modalEl.style.maxWidth = "90vw";
    this.modalEl.style.maxHeight = "none";
  }
};

// src/discord-thread.css
var discord_thread_default = '/* Discord thread styles for Obsidian reading view / live preview. \r\n   Mirrors the Quartz website rendering. */\r\n\r\n.discord-thread {\r\n  --discord-bg: #2b2d31;\r\n  --discord-border: #1f2024;\r\n  --discord-hover: rgba(78, 80, 88, 0.6);\r\n  --discord-text-primary: #f2f3f5;\r\n  --discord-text-muted: #b5bac1;\r\n  --discord-author: #f2f3f5;\r\n  --discord-accent: #5865f2;\r\n  background: var(--discord-bg);\r\n  border: 1px solid var(--discord-border);\r\n  border-radius: 12px;\r\n  padding: 14px 18px;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 0;\r\n  max-width: min(720px, 100%);\r\n  font-family: "gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;\r\n  position: relative;\r\n}\r\n\r\n.discord-thread-wrapper {\r\n  position: relative;\r\n  max-width: min(720px, 100%);\r\n  display: block;\r\n}\r\n\r\n.discord-thread-content {\r\n  position: relative;\r\n  overflow: hidden;\r\n  display: block;\r\n  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);\r\n}\r\n\r\n.discord-thread-content.collapsed {\r\n  max-height: 420px;\r\n}\r\n\r\n.discord-thread-fade {\r\n  position: absolute;\r\n  inset-inline: 0;\r\n  bottom: 0;\r\n  height: 120px;\r\n  pointer-events: none;\r\n  opacity: 0;\r\n  background: linear-gradient(\r\n    to bottom,\r\n    rgba(43, 45, 49, 0) 0%,\r\n    rgba(43, 45, 49, 0.72) 52%,\r\n    rgba(43, 45, 49, 0.92) 78%,\r\n    #2b2d31 100%\r\n  );\r\n  transition: opacity 0.28s ease;\r\n  z-index: 2;\r\n}\r\n\r\n.discord-thread-wrapper.collapsed .discord-thread-fade,\r\n.discord-thread-content.collapsed .discord-thread-fade {\r\n  opacity: 1;\r\n}\r\n\r\n.discord-collapse-toggle {\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  gap: 0.5rem;\r\n  padding: 0.65rem 1.25rem;\r\n  margin: 0 auto;\r\n  margin-top: -3rem;\r\n  background: var(--background-secondary);\r\n  border: 1px solid var(--background-modifier-border);\r\n  border-radius: 8px;\r\n  color: var(--text-normal);\r\n  font-family: var(--font-interface);\r\n  font-size: 0.85rem;\r\n  font-weight: 600;\r\n  cursor: pointer;\r\n  transition: all 0.2s ease;\r\n  position: relative;\r\n  z-index: 3;\r\n  width: fit-content;\r\n  min-width: 140px;\r\n}\r\n\r\n.discord-thread-content:not(.collapsed) + .discord-collapse-toggle {\r\n  margin-top: 0.75rem;\r\n}\r\n\r\n.discord-collapse-toggle:hover {\r\n  background: var(--background-modifier-hover);\r\n  border-color: var(--interactive-accent);\r\n}\r\n\r\n.discord-collapse-icon {\r\n  width: 16px;\r\n  height: 16px;\r\n  transform-origin: 50% 50%;\r\n  transition: transform 0.3s ease;\r\n}\r\n\r\n.discord-collapse-toggle[aria-expanded="false"] .discord-collapse-icon {\r\n  transform: rotate(0deg);\r\n}\r\n\r\n.discord-collapse-toggle[aria-expanded="true"] .discord-collapse-icon {\r\n  transform: rotate(180deg);\r\n}\r\n\r\n.discord-message {\r\n  position: relative;\r\n  border-radius: 8px;\r\n  padding: 6px 8px 4px;\r\n  color: var(--discord-text-primary);\r\n  --discord-author-color: var(--discord-author);\r\n  display: grid;\r\n  grid-template-columns: 48px 1fr;\r\n  gap: 12px;\r\n  text-decoration: none;\r\n  align-items: flex-start;\r\n  width: 100%;\r\n  font: inherit;\r\n  user-select: text;\r\n  cursor: default;\r\n  transition: background 0.18s ease;\r\n}\r\n\r\n.discord-message * {\r\n  font-weight: inherit;\r\n}\r\n\r\n.discord-message + .discord-message {\r\n  margin-top: 2px;\r\n}\r\n\r\n.discord-message:hover {\r\n  background: var(--discord-hover);\r\n}\r\n\r\n.discord-message--compact {\r\n  padding-top: 2px;\r\n}\r\n\r\n.discord-avatar {\r\n  width: 40px;\r\n  min-width: 40px;\r\n  height: 40px;\r\n  aspect-ratio: 1 / 1;\r\n  border-radius: 50%;\r\n  overflow: hidden;\r\n  background: #1f2125;\r\n  border: 1px solid rgba(0, 0, 0, 0.2);\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  margin-top: 6px;\r\n}\r\n\r\n.discord-avatar-spacer {\r\n  width: 40px;\r\n  min-width: 40px;\r\n  height: 10px;\r\n  display: block;\r\n  margin-top: 6px;\r\n}\r\n\r\n.discord-avatar img {\r\n  width: 100%;\r\n  height: 100%;\r\n  object-fit: cover;\r\n  display: block;\r\n}\r\n\r\n.discord-body {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 0.35rem;\r\n}\r\n\r\n.discord-message--compact .discord-body {\r\n  gap: 0.18rem;\r\n}\r\n\r\n.discord-header {\r\n  display: flex;\r\n  flex-wrap: nowrap;\r\n  align-items: baseline;\r\n  column-gap: 0.5rem;\r\n  row-gap: 0.15rem;\r\n  line-height: 1.25;\r\n  margin-bottom: 2px;\r\n  min-width: 0;\r\n}\r\n\r\n.discord-author {\r\n  font-weight: 600;\r\n  color: var(--discord-author-color, var(--discord-author));\r\n}\r\n\r\n.discord-header time {\r\n  font-size: 0.8125rem;\r\n  color: var(--discord-text-muted);\r\n  flex-shrink: 0;\r\n  white-space: nowrap;\r\n}\r\n\r\n.discord-content {\r\n  font-size: 0.95rem;\r\n  line-height: 1.4;\r\n  white-space: pre-wrap;\r\n  word-break: break-word;\r\n}\r\n\r\n.discord-content--compact {\r\n  margin-top: 2px;\r\n}\r\n\r\n.discord-attachments {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 8px;\r\n  margin-top: 6px;\r\n}\r\n\r\n.discord-attachment {\r\n  display: block;\r\n  max-width: min(420px, 100%);\r\n  border-radius: 10px;\r\n  overflow: hidden;\r\n  background: #1f2126;\r\n  border: 1px solid rgba(0, 0, 0, 0.35);\r\n  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.36);\r\n}\r\n\r\n.discord-attachment img {\r\n  display: block;\r\n  width: 100%;\r\n  height: auto;\r\n}\r\n';

// src/renderer.ts
function resolveAvatarSrc(urlOrPath, plugin) {
  if (!urlOrPath) return DEFAULT_AVATAR;
  if (/^https?:\/\//.test(urlOrPath) || urlOrPath.startsWith("app://")) return urlOrPath;
  return plugin.app.vault.adapter.getResourcePath(urlOrPath);
}
var formatTimestamp = (source) => {
  if (!source) return void 0;
  const date = new Date(source);
  if (Number.isNaN(date.getTime())) return { readable: source, iso: source };
  const dd = date.getDate().toString().padStart(2, "0");
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const yyyy = date.getFullYear().toString();
  const hh = date.getHours().toString().padStart(2, "0");
  const min = date.getMinutes().toString().padStart(2, "0");
  return { readable: `${dd}/${mm}/${yyyy} ${hh}:${min}`, iso: date.toISOString() };
};
function resolveAuthor(msg, profiles, defaultAvatarUrl) {
  if (msg.profile && profiles[msg.profile]) {
    const p = profiles[msg.profile];
    return {
      display_name: p.display_name,
      username: p.username,
      color: p.color,
      avatar_url: p.avatar_url || defaultAvatarUrl || DEFAULT_AVATAR
    };
  }
  return {
    display_name: msg.author?.display_name || msg.author?.username || "Unknown User",
    username: msg.author?.username || "unknown",
    color: msg.author?.color ?? msg.author?.colour,
    avatar_url: msg.avatar_url || msg.author?.avatar_url || defaultAvatarUrl || DEFAULT_AVATAR
  };
}
function getAuthorKey(msg, profiles) {
  if (msg.profile) return msg.profile;
  const a = msg.author;
  if (!a) return "";
  return `${a.username ?? ""}|${a.display_name ?? ""}`;
}
function renderDiscordThread(messages, profiles, collapsible = true, defaultAvatarUrl = DEFAULT_AVATAR, plugin) {
  const wrapper = document.createElement("div");
  wrapper.classList.add("discord-thread-wrapper");
  if (collapsible) wrapper.classList.add("collapsed");
  const content = document.createElement("div");
  content.classList.add("discord-thread-content");
  if (collapsible) content.classList.add("collapsed");
  const thread = document.createElement("section");
  thread.classList.add("discord-thread");
  thread.setAttribute("data-message-count", String(messages.length));
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const prev = i > 0 ? messages[i - 1] : void 0;
    const el = renderMessage(msg, prev, profiles, defaultAvatarUrl, plugin);
    thread.appendChild(el);
  }
  content.appendChild(thread);
  if (collapsible) {
    const fade = document.createElement("div");
    fade.classList.add("discord-thread-fade");
    fade.setAttribute("aria-hidden", "true");
    content.appendChild(fade);
  }
  wrapper.appendChild(content);
  if (collapsible) {
    const toggle = document.createElement("button");
    toggle.classList.add("discord-collapse-toggle");
    toggle.setAttribute("aria-expanded", "false");
    toggle.innerHTML = `<span>Show More</span>
      <svg class="discord-collapse-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>`;
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      if (expanded) {
        toggle.setAttribute("aria-expanded", "false");
        content.classList.add("collapsed");
        wrapper.classList.add("collapsed");
        toggle.querySelector("span").textContent = "Show More";
      } else {
        toggle.setAttribute("aria-expanded", "true");
        content.classList.remove("collapsed");
        wrapper.classList.remove("collapsed");
        toggle.querySelector("span").textContent = "Show Less";
      }
    });
    wrapper.appendChild(toggle);
  }
  return wrapper;
}
function renderMessage(msg, prev, profiles, defaultAvatarUrl, plugin) {
  const author = resolveAuthor(msg, profiles, defaultAvatarUrl);
  const prevKey = prev ? getAuthorKey(prev, profiles) : void 0;
  const currKey = getAuthorKey(msg, profiles);
  const sameAuthor = prevKey !== void 0 && prevKey === currKey && prevKey !== "";
  const timestamp = formatTimestamp(msg.timestamp);
  const article = document.createElement("article");
  article.classList.add("discord-message");
  if (sameAuthor) article.classList.add("discord-message--compact");
  if (author.color) {
    article.style.setProperty("--discord-author-color", author.color);
  }
  if (!sameAuthor) {
    const avatarDiv = document.createElement("div");
    avatarDiv.classList.add("discord-avatar");
    const img = document.createElement("img");
    img.src = plugin ? resolveAvatarSrc(author.avatar_url, plugin) : author.avatar_url;
    img.alt = `${author.display_name}'s avatar`;
    img.loading = "lazy";
    img.width = 40;
    img.height = 40;
    const fallbackSrc = plugin ? resolveAvatarSrc(defaultAvatarUrl, plugin) : defaultAvatarUrl;
    img.onerror = () => {
      img.onerror = null;
      img.src = fallbackSrc;
    };
    avatarDiv.appendChild(img);
    article.appendChild(avatarDiv);
  } else {
    const spacer = document.createElement("div");
    spacer.classList.add("discord-avatar-spacer");
    spacer.setAttribute("aria-hidden", "true");
    article.appendChild(spacer);
  }
  const body = document.createElement("div");
  body.classList.add("discord-body");
  if (!sameAuthor) {
    const header = document.createElement("div");
    header.classList.add("discord-header");
    const nameSpan = document.createElement("span");
    nameSpan.classList.add("discord-author");
    nameSpan.textContent = author.display_name;
    if (author.color) nameSpan.style.color = author.color;
    header.appendChild(nameSpan);
    if (timestamp) {
      const time = document.createElement("time");
      time.dateTime = timestamp.iso;
      time.textContent = timestamp.readable;
      header.appendChild(time);
    }
    body.appendChild(header);
  }
  const contentDiv = document.createElement("div");
  contentDiv.classList.add("discord-content");
  if (sameAuthor) contentDiv.classList.add("discord-content--compact");
  const contentText = msg.content ?? "";
  const lines = contentText.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) {
      contentDiv.appendChild(document.createElement("br"));
    }
    contentDiv.appendChild(document.createTextNode(lines[i]));
  }
  if (sameAuthor && timestamp) {
    const srTime = document.createElement("time");
    srTime.classList.add("discord-timestamp-sr");
    srTime.dateTime = timestamp.iso;
    srTime.textContent = timestamp.readable;
    srTime.style.cssText = "position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;";
    contentDiv.appendChild(srTime);
  }
  body.appendChild(contentDiv);
  article.appendChild(body);
  return article;
}
var styleInjected = false;
function injectStyle() {
  if (styleInjected) return;
  const style = document.createElement("style");
  style.textContent = discord_thread_default;
  document.head.appendChild(style);
  styleInjected = true;
}
function registerDiscordRenderer(plugin) {
  plugin.registerMarkdownCodeBlockProcessor("discord", (source, el, ctx) => {
    injectStyle();
    let messages;
    try {
      const parsed = JSON.parse(source.trim());
      messages = normaliseMessages(parsed);
    } catch {
      el.createEl("pre", { text: `Invalid discord JSON:
${source}` });
      return;
    }
    if (messages.length === 0) {
      el.createEl("p", { text: "(empty discord block)" });
      return;
    }
    const thread = renderDiscordThread(
      messages,
      plugin.settings.profiles,
      messages.length > 6,
      plugin.settings.defaultAvatarUrl,
      plugin
    );
    el.appendChild(thread);
  });
  plugin.registerMarkdownPostProcessor((el, ctx) => {
    const callouts = el.querySelectorAll(
      '.callout[data-callout="discord-cite"]'
    );
    if (callouts.length === 0) return;
    injectStyle();
    for (const callout of Array.from(callouts)) {
      const codeBlock = callout.querySelector("pre code");
      if (!codeBlock) continue;
      const jsonText = codeBlock.textContent?.trim();
      if (!jsonText) continue;
      let messages;
      try {
        const parsed = JSON.parse(jsonText);
        messages = normaliseMessages(parsed);
      } catch {
        continue;
      }
      if (messages.length === 0) continue;
      const thread = renderDiscordThread(
        messages,
        plugin.settings.profiles,
        true,
        plugin.settings.defaultAvatarUrl,
        plugin
      );
      const titleBar = callout.querySelector(
        ".callout-title"
      );
      const titleText = titleBar?.querySelector(
        ".callout-title-inner"
      );
      if (titleText) {
        const count = messages.length;
        titleText.textContent = `Discord citation (${count} message${count !== 1 ? "s" : ""})`;
      }
      if (titleBar) {
        const icon = titleBar.querySelector(".callout-icon");
        if (icon) {
          icon.innerHTML = `<svg viewBox="0 0 32 32" width="18" height="18" fill="currentColor" style="vertical-align: middle;">
            <path d="M26.963 0.875 C25.282 0.094 23.478-0.432 21.602-0.667a0.12 0.12 0 00-0.127 0.06c-0.258 0.459-0.543 1.058-0.743 1.529a23.584 23.584 0 00-7.074 0 16.326 16.326 0 00-0.754-1.53A0.125 0.125 0 0012.777-0.667C10.9-0.431 9.098 0.095 7.416 0.876a0.113 0.113 0 00-0.052 0.044C3.68 6.184 2.618 11.344 3.14 16.44a0.133 0.133 0 000.063 0.091c2.636 1.936 5.19 3.113 7.693 3.89a0.126 0.126 0 000.137-0.045c0.593-0.81 1.121-1.664 1.575-2.56a0.123 0.123 0 00-0.068-0.172c-0.839-0.318-1.639-0.707-2.407-1.15a0.125 0.125 0 01-0.012-0.207c0.162-0.121 0.323-0.248 0.478-0.375a0.12 0.12 0 010.128-0.017c5.05 2.306 10.515 2.306 15.51 0a0.12 0.12 0 010.13 0.015c0.155 0.128 0.316 0.256 0.479 0.377a0.125 0.125 0 01-0.011 0.207c-0.768 0.449-1.568 0.838-2.408 1.149a0.124 0.124 0 00-0.066 0.173c0.462 0.895 0.99 1.749 1.574 2.559a0.124 0.124 0 000.136 0.046c2.514-0.778 5.068-1.955 7.705-3.891a0.126 0.126 0 000.062-0.089c0.626-6.466-1.049-12.082-4.44-17.054a0.099 0.099 0 00-0.05-0.046zM11.44 13.532c-1.477 0-2.694-1.356-2.694-3.023s1.193-3.023 2.694-3.023c1.512 0 2.718 1.368 2.694 3.023 0 1.667-1.194 3.023-2.694 3.023zm9.96 0c-1.477 0-2.694-1.356-2.694-3.023s1.193-3.023 2.694-3.023c1.512 0 2.718 1.368 2.694 3.023 0 1.667-1.182 3.023-2.694 3.023z"/>
          </svg>`;
        }
      }
      const body = callout.querySelector(".callout-content");
      if (body) {
        body.empty();
        body.appendChild(thread);
        body.style.padding = "0";
      }
      callout.style.backgroundColor = "#2b2d31";
      callout.style.borderColor = "#1f2024";
      callout.style.borderRadius = "12px";
      callout.style.overflow = "hidden";
      if (titleBar) {
        titleBar.style.backgroundColor = "#1f2024";
        titleBar.style.color = "#b5bac1";
      }
    }
  });
}
function normaliseMessages(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.flatMap((e) => normaliseMessages(e));
  if (typeof raw === "object") {
    const obj = raw;
    if (Array.isArray(obj.messages)) return normaliseMessages(obj.messages);
    return [obj];
  }
  return [];
}

// src/community-post.css
var community_post_default = '.yt-community-post {\r\n  background: #202020;\r\n  border: 1px solid #2f2f2f;\r\n  border-radius: 16px;\r\n  padding: 13px 18px 16px;\r\n  color: #f1f1f1;\r\n  max-width: min(640px, 100%);\r\n  font-family: "Roboto", "Source Sans Pro", "Helvetica Neue", Helvetica, Arial, sans-serif;\r\n  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);\r\n  display: flex;\r\n  align-items: flex-start;\r\n  gap: 12px;\r\n  position: relative;\r\n}\r\n\r\n.yt-community-post + .yt-community-post {\r\n  margin-top: 20px;\r\n}\r\n\r\n.yt-community-post__header {\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: space-between;\r\n  gap: 8px;\r\n  row-gap: 4px;\r\n  flex-wrap: wrap;\r\n  width: 100%;\r\n}\r\n\r\n.yt-community-post__identity {\r\n  display: flex;\r\n  flex-wrap: wrap;\r\n  align-items: baseline;\r\n  gap: 6px;\r\n  line-height: 1;\r\n}\r\n\r\n.yt-community-post__avatar {\r\n  flex-shrink: 0;\r\n  width: 48px;\r\n  height: 48px;\r\n  border-radius: 50%;\r\n  overflow: hidden;\r\n  background-color: transparent;\r\n}\r\n\r\n.yt-community-post__avatar img {\r\n  width: 100%;\r\n  height: 100%;\r\n  object-fit: cover;\r\n  object-position: center;\r\n  display: block;\r\n  margin: 0;\r\n  padding: 0;\r\n}\r\n\r\n.yt-community-post__content {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 4px;\r\n  flex: 1;\r\n  min-width: 0;\r\n}\r\n\r\n.yt-community-post__channel {\r\n  font-weight: 600;\r\n  font-size: 0.95rem;\r\n  line-height: 1;\r\n}\r\n\r\n.yt-community-post__timestamp {\r\n  color: #a7a7a7;\r\n  font-size: 0.78rem;\r\n  line-height: 1;\r\n}\r\n\r\n.yt-community-post__body {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 4px;\r\n  font-size: 0.93rem;\r\n}\r\n\r\n.yt-community-post__text {\r\n  line-height: 1.48;\r\n  white-space: normal;\r\n  word-break: break-word;\r\n}\r\n\r\n.yt-community-post__embed {\r\n  margin: 0;\r\n  padding: 0;\r\n}\r\n\r\n.yt-community-post__embed img {\r\n  border-radius: 12px;\r\n  width: 100%;\r\n  height: auto;\r\n  display: block;\r\n  border: 1px solid rgba(255, 255, 255, 0.08);\r\n}\r\n\r\n.yt-community-post__footer {\r\n  margin-top: 4px;\r\n}\r\n\r\n.yt-community-post__actions {\r\n  display: flex;\r\n  gap: 16px;\r\n  color: #b0b0b0;\r\n  font-size: 0.82rem;\r\n  pointer-events: none;\r\n  user-select: none;\r\n}\r\n\r\n.yt-community-post__action {\r\n  display: inline-flex;\r\n  align-items: center;\r\n  gap: 6px;\r\n  opacity: 0.9;\r\n}\r\n\r\n.yt-community-post__action svg {\r\n  width: 20px;\r\n  height: 20px;\r\n  fill: currentColor;\r\n}\r\n\r\n.yt-community-post__count {\r\n  font-size: 0.78rem;\r\n  color: #cecece;\r\n}\r\n';

// src/communityPostRenderer.ts
var import_obsidian3 = require("obsidian");
var escapeHtml = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
var DEFAULT_CHANNEL_HANDLE = "7-10tone";
function parseSource(source) {
  const lines = source.split(/\r?\n/);
  const firstLine = (lines[0] ?? "").trim();
  if (!firstLine) return null;
  const metaLine = firstLine.replace(/^\s*community-post\s*,\s*/i, "");
  const parts = metaLine.split(",").map((p) => p.trim()).filter((p, i, a) => !(p.length === 0 && i >= a.length - 1));
  if (parts.length < 2) return null;
  let argIndex = 0;
  let channelHandle = DEFAULT_CHANNEL_HANDLE;
  if (parts[0] && parts[0].startsWith("@")) {
    channelHandle = parts[0].slice(1).toLowerCase();
    argIndex++;
  }
  if (parts.length < argIndex + 2) return null;
  const likes = Number.parseInt(parts[argIndex] ?? "", 10);
  const comments = Number.parseInt(parts[argIndex + 1] ?? "", 10);
  if (!Number.isFinite(likes) || !Number.isFinite(comments)) return null;
  let postedLabelRaw = parts[argIndex + 2] ?? "";
  const extra = parts.slice(argIndex + 3).filter((s) => s.length > 0);
  if (postedLabelRaw && extra.length > 0 && /[A-Za-z]/.test(postedLabelRaw) && !/\d{4}/.test(postedLabelRaw) && /^\d{4}$/.test(extra[0])) {
    postedLabelRaw = `${postedLabelRaw} ${extra.shift()}`.trim();
  }
  if ((!postedLabelRaw || /^\d+$/.test(postedLabelRaw)) && extra.length > 0 && /[A-Za-z]/.test(extra[0])) {
    postedLabelRaw = `${postedLabelRaw} ${extra.shift()}`.trim();
  }
  const body = lines.slice(1).join("\n").trim();
  return {
    channelHandle,
    likes,
    comments,
    postedLabel: postedLabelRaw,
    body
  };
}
function formatCount(n) {
  if (n <= 0) return void 0;
  if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
  return String(n);
}
var LIKE_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14 1 7.59 7.41C7.22 7.78 7 8.3 7 8.83V19c0 1.1.9 2 2 2h8c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z" /></svg>`;
var COMMENT_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 3H3c-1.1 0-2 .9-2 2v8c0 1.1.9 2 2 2h12l5 4V5c0-1.1-.9-2-2-2h-3z" /></svg>`;
var styleInjected2 = false;
function injectStyle2() {
  if (styleInjected2) return;
  const style = document.createElement("style");
  style.textContent = community_post_default;
  document.head.appendChild(style);
  styleInjected2 = true;
}
var inflightFetches = /* @__PURE__ */ new Map();
async function getChannelProfile(handle, plugin) {
  const key = handle.toLowerCase();
  const cached = plugin.settings.youtubeChannels[key];
  if (cached?.avatarUrl) return cached;
  if (inflightFetches.has(key)) return inflightFetches.get(key);
  const promise = fetchChannelProfile(handle).then(async (profile) => {
    plugin.settings.youtubeChannels[key] = profile;
    await plugin.saveSettings();
    inflightFetches.delete(key);
    return profile;
  }).catch(() => {
    inflightFetches.delete(key);
    return { name: `@${handle}`, avatarUrl: "" };
  });
  inflightFetches.set(key, promise);
  return promise;
}
async function fetchChannelProfile(handle) {
  const resp = await (0, import_obsidian3.requestUrl)({
    url: `https://www.youtube.com/@${handle}`,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    }
  });
  const html = resp.text;
  const titleMatch = html.match(/<meta property="og:title" content="([^"]+)"/);
  const imageMatch = html.match(/<meta property="og:image" content="([^"]+)"/);
  return {
    name: titleMatch?.[1] ?? `@${handle}`,
    avatarUrl: imageMatch?.[1] ?? ""
  };
}
function buildPostElement(post, channelProfile) {
  const article = document.createElement("article");
  article.classList.add("yt-community-post");
  const avatarSpan = document.createElement("span");
  avatarSpan.classList.add("yt-community-post__avatar");
  const avatarUrl = channelProfile?.avatarUrl;
  if (avatarUrl) {
    const img = document.createElement("img");
    img.src = avatarUrl;
    img.alt = channelProfile?.name ?? post.channelHandle;
    img.loading = "lazy";
    img.width = 48;
    img.height = 48;
    avatarSpan.appendChild(img);
  } else {
    const initial = document.createElement("span");
    initial.textContent = post.channelHandle.charAt(0).toUpperCase();
    initial.style.cssText = "display:flex;align-items:center;justify-content:center;width:100%;height:100%;background:#383838;color:#ccc;font-weight:600;font-size:1.2rem;border-radius:50%;";
    avatarSpan.appendChild(initial);
  }
  article.appendChild(avatarSpan);
  const content = document.createElement("div");
  content.classList.add("yt-community-post__content");
  const header = document.createElement("div");
  header.classList.add("yt-community-post__header");
  const identity = document.createElement("div");
  identity.classList.add("yt-community-post__identity");
  const channel = document.createElement("span");
  channel.classList.add("yt-community-post__channel");
  channel.textContent = channelProfile?.name ?? `@${post.channelHandle}`;
  identity.appendChild(channel);
  if (post.postedLabel) {
    const ts = document.createElement("span");
    ts.classList.add("yt-community-post__timestamp");
    ts.textContent = `Posted ${escapeHtml(post.postedLabel)}`;
    identity.appendChild(ts);
  }
  header.appendChild(identity);
  content.appendChild(header);
  if (post.body) {
    const body = document.createElement("div");
    body.classList.add("yt-community-post__body");
    const textDiv = document.createElement("div");
    textDiv.classList.add("yt-community-post__text");
    const lines = post.body.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      if (i > 0) textDiv.appendChild(document.createElement("br"));
      textDiv.appendChild(document.createTextNode(lines[i]));
    }
    body.appendChild(textDiv);
    content.appendChild(body);
  }
  const footer = document.createElement("footer");
  footer.classList.add("yt-community-post__footer");
  const actions = document.createElement("div");
  actions.classList.add("yt-community-post__actions");
  actions.setAttribute("aria-hidden", "true");
  const likeAction = document.createElement("span");
  likeAction.classList.add("yt-community-post__action");
  likeAction.innerHTML = LIKE_SVG;
  const likeCount = formatCount(post.likes);
  if (likeCount) {
    const countSpan = document.createElement("span");
    countSpan.classList.add("yt-community-post__count");
    countSpan.textContent = likeCount;
    likeAction.appendChild(countSpan);
  }
  actions.appendChild(likeAction);
  const commentAction = document.createElement("span");
  commentAction.classList.add("yt-community-post__action");
  commentAction.innerHTML = COMMENT_SVG;
  const commentCount = formatCount(post.comments);
  if (commentCount) {
    const countSpan = document.createElement("span");
    countSpan.classList.add("yt-community-post__count");
    countSpan.textContent = commentCount;
    commentAction.appendChild(countSpan);
  }
  actions.appendChild(commentAction);
  footer.appendChild(actions);
  content.appendChild(footer);
  article.appendChild(content);
  return article;
}
function registerCommunityPostRenderer(plugin) {
  plugin.registerMarkdownCodeBlockProcessor("community-post", (source, el, _ctx) => {
    injectStyle2();
    const post = parseSource(source);
    if (!post) {
      el.createEl("pre", { text: `Invalid community post:
${source}` });
      return;
    }
    const cached = plugin.settings.youtubeChannels[post.channelHandle.toLowerCase()];
    const article = buildPostElement(post, cached);
    el.appendChild(article);
    if (!cached?.avatarUrl) {
      getChannelProfile(post.channelHandle, plugin).then((profile) => {
        const updated = buildPostElement(post, profile);
        article.replaceWith(updated);
      });
    }
  });
}

// src/communityPostModal.ts
var import_obsidian4 = require("obsidian");
var DEFAULT_CHANNEL_URL = "https://www.youtube.com/@7-10tone";
function extractHandle(input) {
  const trimmed = input.trim();
  if (/^@[\w-]+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/@([\w-]+)/);
  if (match) return `@${match[1]}`;
  if (/^[\w-]+$/.test(trimmed)) return `@${trimmed}`;
  return "@7-10tone";
}
function formatDate(dateStr) {
  if (!dateStr) return "";
  if (/^\d{1,2}\s+\w+\s+\d{4}$/.test(dateStr.trim())) return dateStr.trim();
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr.trim();
  const day = d.getDate();
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec"
  ];
  const mon = months[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${mon} ${year}`;
}
function todayISO() {
  const d = /* @__PURE__ */ new Date();
  const yyyy = d.getFullYear();
  const mm = (d.getMonth() + 1).toString().padStart(2, "0");
  const dd = d.getDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
var CommunityPostModal = class extends import_obsidian4.Modal {
  constructor(app, editor) {
    super(app);
    this.channelUrl = DEFAULT_CHANNEL_URL;
    this.likes = "0";
    this.comments = "0";
    this.date = todayISO();
    this.content = "";
    this.editor = editor;
  }
  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("community-post-modal");
    this.applyModalStyles();
    contentEl.createEl("h2", { text: "Insert Community Post" });
    new import_obsidian4.Setting(contentEl).setName("Channel").setDesc("YouTube channel URL or @handle. Default: @7-10tone").addText(
      (text) => text.setPlaceholder(DEFAULT_CHANNEL_URL).setValue(this.channelUrl).onChange((v) => {
        this.channelUrl = v.trim() || DEFAULT_CHANNEL_URL;
      })
    );
    const dateRow = contentEl.createDiv("community-date-row");
    dateRow.createEl("label", { text: "Date" });
    const dateDesc = dateRow.createEl("small", {
      text: "Pick a date or type a label like '12 Jun 2025'."
    });
    dateDesc.style.cssText = "display:block;color:var(--text-muted);margin-bottom:4px;font-size:0.82em;";
    const dateInputs = dateRow.createDiv("community-date-inputs");
    const datePicker = dateInputs.createEl("input", { type: "date" });
    datePicker.value = this.date;
    dateInputs.createEl("span", { text: "or" }).style.cssText = "color:var(--text-muted);font-size:0.85em;";
    const dateText = dateInputs.createEl("input", {
      type: "text",
      placeholder: "e.g. 12 Jun 2025"
    });
    dateText.value = formatDate(this.date);
    datePicker.addEventListener("change", () => {
      this.date = datePicker.value;
      dateText.value = formatDate(datePicker.value);
    });
    dateText.addEventListener("input", () => {
      this.date = dateText.value;
    });
    const statsRow = contentEl.createDiv("community-stats-row");
    const likesGroup = statsRow.createDiv("community-stat-group");
    likesGroup.createEl("label", { text: "Likes" });
    const likesInput = likesGroup.createEl("input", {
      type: "number",
      value: this.likes,
      attr: { min: "0" }
    });
    likesInput.addEventListener("input", () => {
      this.likes = likesInput.value;
    });
    const commentsGroup = statsRow.createDiv("community-stat-group");
    commentsGroup.createEl("label", { text: "Comments" });
    const commentsInput = commentsGroup.createEl("input", {
      type: "number",
      value: this.comments,
      attr: { min: "0" }
    });
    commentsInput.addEventListener("input", () => {
      this.comments = commentsInput.value;
    });
    const contentLabel = contentEl.createEl("label", { text: "Post content" });
    contentLabel.style.display = "block";
    contentLabel.style.marginTop = "8px";
    contentLabel.style.marginBottom = "4px";
    contentLabel.style.fontWeight = "500";
    const textarea = contentEl.createEl("textarea");
    textarea.value = this.content;
    textarea.placeholder = "Type the community post content here\u2026";
    textarea.rows = 8;
    textarea.style.width = "100%";
    textarea.style.resize = "vertical";
    textarea.style.fontSize = "0.95em";
    textarea.style.padding = "8px";
    textarea.style.borderRadius = "6px";
    textarea.style.border = "1px solid var(--background-modifier-border)";
    textarea.style.backgroundColor = "var(--background-primary)";
    textarea.style.color = "var(--text-normal)";
    textarea.style.fontFamily = "var(--font-monospace)";
    textarea.addEventListener("input", () => {
      this.content = textarea.value;
    });
    new import_obsidian4.Setting(contentEl).addButton(
      (btn) => btn.setButtonText("Insert Post").setCta().onClick(() => {
        this.doInsert();
      })
    ).addButton(
      (btn) => btn.setButtonText("Cancel").onClick(() => {
        this.close();
      })
    );
  }
  onClose() {
    this.contentEl.empty();
  }
  doInsert() {
    if (!this.content.trim()) {
      new import_obsidian4.Notice("Post content cannot be empty.");
      return;
    }
    const handle = extractHandle(this.channelUrl);
    const likes = parseInt(this.likes, 10) || 0;
    const comments = parseInt(this.comments, 10) || 0;
    const dateLabel = formatDate(this.date) || formatDate(todayISO());
    const metaLine = `${handle},${likes},${comments},${dateLabel}`;
    const block = "```community-post\n" + metaLine + "\n" + this.content.trimEnd() + "\n```";
    this.editor.replaceSelection(block);
    new import_obsidian4.Notice("Community post inserted.");
    this.close();
  }
  applyModalStyles() {
    const style = document.createElement("style");
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
    `;
    this.contentEl.prepend(style);
    this.modalEl.style.width = "700px";
    this.modalEl.style.maxWidth = "90vw";
    this.modalEl.style.maxHeight = "none";
  }
};

// src/main.ts
var DiscordMessageEmbedPlugin = class extends import_obsidian5.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new DiscordEmbedSettingTab(this.app, this));
    registerDiscordRenderer(this);
    registerCommunityPostRenderer(this);
    void this.downloadAllRemoteAvatars();
    this.addCommand({
      id: "insert-discord-message-embed",
      name: "Insert Discord message embed (from URL)",
      editorCheckCallback: (checking, editor, view) => this.handleCommand(checking, editor, view, "embed")
    });
    this.addCommand({
      id: "insert-discord-message-citation",
      name: "Insert Discord message citation (from URL)",
      editorCheckCallback: (checking, editor, view) => this.handleCommand(checking, editor, view, "citation")
    });
    this.addCommand({
      id: "insert-manual-discord-embed",
      name: "Insert manual Discord messages",
      editorCallback: (editor, view) => {
        new ManualEmbedModal(this.app, this, editor, "embed").open();
      }
    });
    this.addCommand({
      id: "insert-manual-discord-citation",
      name: "Insert manual Discord citation",
      editorCallback: (editor, view) => {
        new ManualEmbedModal(this.app, this, editor, "citation").open();
      }
    });
    this.registerEvent(
      this.app.workspace.on("editor-menu", (menu, editor, view) => {
        if (!(view instanceof import_obsidian5.MarkdownView)) {
          return;
        }
        const selection = editor.getSelection();
        const urls = this.extractDiscordUrls(this.stripCitationMarker(selection));
        if (urls.length > 0) {
          menu.addItem((item) => {
            item.setTitle("Insert Discord embed (from URL)").setIcon("message-square").onClick(() => {
              void this.insertEmbed(editor);
            });
          });
          menu.addItem((item) => {
            item.setTitle("Insert Discord citation (from URL)").setIcon("superscript").onClick(() => {
              void this.insertCitation(editor);
            });
          });
        }
        menu.addSeparator();
        menu.addItem((item) => {
          item.setTitle("Insert Discord embed (manual)").setIcon("message-square-plus").onClick(() => {
            new ManualEmbedModal(this.app, this, editor, "embed").open();
          });
        });
        menu.addItem((item) => {
          item.setTitle("Insert Discord citation (manual)").setIcon("quote").onClick(() => {
            new ManualEmbedModal(this.app, this, editor, "citation").open();
          });
        });
        menu.addSeparator();
        menu.addItem((item) => {
          item.setTitle("Insert YouTube community post").setIcon("youtube").onClick(() => {
            new CommunityPostModal(this.app, editor).open();
          });
        });
      })
    );
    this.addCommand({
      id: "insert-community-post",
      name: "Insert YouTube community post",
      editorCallback: (editor) => {
        new CommunityPostModal(this.app, editor).open();
      }
    });
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  handleCommand(checking, editor, view, mode) {
    if (!(view instanceof import_obsidian5.MarkdownView)) {
      return false;
    }
    const selection = editor.getSelection();
    const urls = this.extractDiscordUrls(
      mode === "citation" ? this.stripCitationMarker(selection) : selection
    );
    if (checking) {
      return urls.length > 0;
    }
    if (mode === "embed") {
      void this.insertEmbed(editor);
    } else {
      void this.insertCitation(editor);
    }
    return true;
  }
  extractDiscordUrls(source) {
    if (!source) {
      return [];
    }
    const regex = /https:\/\/(?:ptb\.|canary\.)?discord\.com\/channels\/\d+\/\d+\/\d+/gi;
    const seen = /* @__PURE__ */ new Set();
    const ordered = [];
    let match;
    while ((match = regex.exec(source)) !== null) {
      const url = match[0];
      if (!seen.has(url)) {
        seen.add(url);
        ordered.push(url);
      }
    }
    return ordered;
  }
  stripCitationMarker(selection) {
    const caretIndex = selection.indexOf("^");
    if (caretIndex === -1) {
      return selection;
    }
    return selection.slice(0, caretIndex) + selection.slice(caretIndex + 1);
  }
  async insertEmbed(editor) {
    const selection = editor.getSelection();
    const urls = this.extractDiscordUrls(selection);
    if (urls.length === 0) {
      new import_obsidian5.Notice("Highlight at least one Discord message URL first.");
      return;
    }
    const loading = new import_obsidian5.Notice(
      `Fetching ${urls.length} Discord message${urls.length > 1 ? "s" : ""}...`,
      0
    );
    try {
      const messages = await this.fetchMessages(urls);
      const json = JSON.stringify(messages, null, 2);
      const block = "```discord\n" + json + "\n```";
      editor.replaceSelection(block);
    } catch (error) {
      console.error(error);
      new import_obsidian5.Notice("Unable to fetch one or more Discord messages.");
    } finally {
      loading.hide();
    }
  }
  async insertCitation(editor) {
    const selection = editor.getSelection();
    const urls = this.extractDiscordUrls(this.stripCitationMarker(selection));
    if (urls.length === 0) {
      new import_obsidian5.Notice("Highlight at least one Discord message URL first.");
      return;
    }
    const loading = new import_obsidian5.Notice(`Fetching ${urls.length} Discord citation...`, 0);
    try {
      const messages = await this.fetchMessages(urls);
      const citationId = this.generateCitationId();
      const marker = `<!-- discord-cite:${citationId} -->`;
      const callout = this.buildCitationCallout(citationId, messages);
      editor.replaceSelection(marker);
      if (callout.trim().length > 0) {
        const cursor = editor.getCursor();
        const block = `

${callout}
`;
        editor.replaceRange(block, cursor);
      }
    } catch (error) {
      console.error(error);
      new import_obsidian5.Notice("Unable to fetch the Discord citation.");
    } finally {
      loading.hide();
    }
  }
  buildCitationCallout(citationId, messages) {
    if (messages.length === 0) {
      return "";
    }
    const countLabel = messages.length === 1 ? "1 message" : `${messages.length} messages`;
    const payload = {
      id: citationId,
      messages
    };
    const jsonLines = JSON.stringify(payload, null, 2).split("\n");
    const lines = [
      `> [!discord-cite]- Discord citation (${countLabel})`,
      ">",
      `> \`\`\`json`
    ];
    jsonLines.forEach((line) => {
      lines.push(`> ${line}`);
    });
    lines.push(`> \`\`\``);
    return lines.join("\n");
  }
  async fetchMessages(urls) {
    const messages = [];
    for (const url of urls) {
      const apiPayload = await this.fetchDiscordMessage(url);
      messages.push(this.mapToMessageBlock(url, apiPayload));
    }
    return messages;
  }
  generateCitationId() {
    const random = Math.random().toString(36).slice(2, 8);
    const timestamp = Date.now().toString(36);
    return `cite-${timestamp}-${random}`;
  }
  /** Fetch a single Discord message from the API. Public so settings/modals can use it. */
  async fetchDiscordMessage(url) {
    const response = await (0, import_obsidian5.requestUrl)({
      url: `${this.settings.apiEndpoint}${encodeURIComponent(url)}`
    });
    if (response.status >= 400) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return response.json;
  }
  mapToMessageBlock(url, payload) {
    const authorUsername = payload.author?.username?.trim();
    const authorDisplay = payload.author?.display_name?.trim();
    const authorAvatar = payload.author?.avatar_url?.trim() || payload.author?.avatar?.trim();
    const authorColourHex = normaliseColour(
      payload.author?.color ?? payload.author?.colour,
      payload.author?.colour_value
    );
    const matchedProfile = this.findMatchingProfile(authorUsername, authorDisplay, authorAvatar);
    if (matchedProfile) {
      this.maybeUpdateProfile(matchedProfile, authorDisplay, authorAvatar, authorColourHex);
      return {
        profile: matchedProfile.id,
        content: payload.content ?? "",
        timestamp: payload.timestamp,
        url
      };
    }
    if (authorUsername) {
      const created = this.autoCreateProfile(authorUsername, authorDisplay, authorAvatar, authorColourHex);
      if (created) {
        return {
          profile: created.id,
          content: payload.content ?? "",
          timestamp: payload.timestamp,
          url
        };
      }
    }
    return {
      id: payload.id,
      author: {
        display_name: authorDisplay || void 0,
        username: authorUsername || authorDisplay || "Unknown User",
        color: authorColourHex,
        colour: payload.author?.colour?.trim() || void 0,
        colour_value: payload.author?.colour_value
      },
      content: payload.content ?? "",
      timestamp: payload.timestamp,
      avatar_url: authorAvatar || this.settings.defaultAvatarUrl || DEFAULT_AVATAR,
      url
    };
  }
  /**
   * Smart multi-signal profile matching.
   * Priority: 1) exact username  2) avatar hash  3) normalized username
   * For a small user population this is safe and eliminates duplicates.
   */
  findMatchingProfile(username, displayName, avatarUrl) {
    if (!username && !displayName && !avatarUrl) return null;
    const profiles = this.settings.profiles;
    for (const key of Object.keys(profiles)) {
      const p = profiles[key];
      if (username && p.username.toLowerCase() === username.toLowerCase() || username && p.id.toLowerCase() === username.toLowerCase()) {
        return p;
      }
    }
    if (avatarUrl) {
      const incomingHash = extractAvatarId(avatarUrl);
      if (incomingHash) {
        for (const key of Object.keys(profiles)) {
          const p = profiles[key];
          if (p.avatar_url) {
            const profileHash = extractAvatarId(p.avatar_url);
            if (profileHash && profileHash === incomingHash) {
              return p;
            }
          }
        }
      }
    }
    if (username) {
      const normalizedIncoming = normalizeUsername(username);
      if (normalizedIncoming.length >= 3) {
        for (const key of Object.keys(profiles)) {
          const p = profiles[key];
          if (normalizeUsername(p.username) === normalizedIncoming) {
            return p;
          }
        }
      }
    }
    if (displayName) {
      for (const key of Object.keys(profiles)) {
        const p = profiles[key];
        if (p.display_name.toLowerCase() === displayName.toLowerCase()) {
          return p;
        }
      }
    }
    return null;
  }
  /**
   * Auto-create a profile from API response data.
   * Generates a clean profile ID from the username.
   */
  autoCreateProfile(username, displayName, avatarUrl, color) {
    const id = username.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!id) return null;
    let finalId = id;
    if (this.settings.profiles[finalId]) {
      return this.settings.profiles[finalId];
    }
    const profile = {
      id: finalId,
      display_name: displayName || username,
      username,
      color: color || void 0,
      avatar_url: avatarUrl || void 0
    };
    this.settings.profiles[finalId] = profile;
    void this.saveSettings();
    if (avatarUrl && /^https?:\/\//.test(avatarUrl)) {
      void this.downloadAvatar(avatarUrl, finalId).then((localPath) => {
        if (localPath) {
          profile.avatar_url = localPath;
          void this.saveSettings();
        }
      });
    }
    new import_obsidian5.Notice(`Auto-created profile "${finalId}" for @${username}`);
    return profile;
  }
  /**
   * Update an existing profile if the API returned newer/better info.
   * Only overwrites empty fields or updates the avatar (users change these).
   */
  maybeUpdateProfile(profile, displayName, avatarUrl, color) {
    let changed = false;
    if (avatarUrl && avatarUrl !== profile.avatar_url) {
      const newHash = extractAvatarId(avatarUrl);
      const oldHash = profile.avatar_url ? extractAvatarId(profile.avatar_url) : null;
      if (newHash && newHash !== oldHash) {
        profile.avatar_url = avatarUrl;
        changed = true;
        if (/^https?:\/\//.test(avatarUrl)) {
          void this.downloadAvatar(avatarUrl, profile.id).then((localPath) => {
            if (localPath) {
              profile.avatar_url = localPath;
              void this.saveSettings();
            }
          });
        }
      }
    }
    if (displayName && !profile.display_name) {
      profile.display_name = displayName;
      changed = true;
    }
    if (color && !profile.color) {
      profile.color = color;
      changed = true;
    }
    if (changed) {
      void this.saveSettings();
    }
  }
  /** Download a remote avatar image into the vault and return the vault-relative path. */
  async downloadAvatar(remoteUrl, profileId) {
    if (!remoteUrl || !/^https?:\/\//.test(remoteUrl)) return null;
    try {
      const resp = await (0, import_obsidian5.requestUrl)({ url: remoteUrl });
      if (resp.status >= 400) return null;
      const ct = (resp.headers["content-type"] ?? "image/png").toLowerCase();
      let ext = "png";
      if (ct.includes("jpeg") || ct.includes("jpg")) ext = "jpg";
      else if (ct.includes("gif")) ext = "gif";
      else if (ct.includes("webp")) ext = "webp";
      const dir = (0, import_obsidian5.normalizePath)("Content/Media/Avatars");
      if (!await this.app.vault.adapter.exists(dir)) {
        await this.app.vault.adapter.mkdir(dir);
      }
      const safeName = profileId.replace(/[^a-z0-9_-]/gi, "_");
      const filePath = (0, import_obsidian5.normalizePath)(`${dir}/${safeName}.${ext}`);
      await this.app.vault.adapter.writeBinary(filePath, resp.arrayBuffer);
      return filePath;
    } catch (e) {
      console.warn("[710-content-embeds] Failed to download avatar:", e);
      return null;
    }
  }
  /** One-time migration: download all profiles' remote avatars to local vault. */
  async downloadAllRemoteAvatars() {
    let changed = false;
    for (const [id, profile] of Object.entries(this.settings.profiles)) {
      if (profile.avatar_url && /^https?:\/\//.test(profile.avatar_url)) {
        const localPath = await this.downloadAvatar(profile.avatar_url, id);
        if (localPath) {
          profile.avatar_url = localPath;
          changed = true;
        }
      }
    }
    if (changed) {
      await this.saveSettings();
    }
  }
};
