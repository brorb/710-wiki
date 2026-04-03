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
var import_obsidian3 = require("obsidian");

// src/types.ts
var DEFAULT_SETTINGS = {
  apiEndpoint: "https://discord-system-firebase-bot-production.up.railway.app/api/message?url=",
  profiles: {}
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
    containerEl.createEl("h2", { text: "Discord Profiles" });
    containerEl.createEl("p", {
      text: "Manage reusable author profiles. Use the profile ID in your discord blocks instead of repeating avatar URLs and colours.",
      cls: "setting-item-description"
    });
    new import_obsidian.Setting(containerEl).setName("Add new profile").addButton(
      (btn) => btn.setButtonText("+ New Profile").setCta().onClick(() => {
        this.openProfileEditor(containerEl);
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
            src: p.avatar_url,
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
  /**
   * Renders inline profile editor fields within the settings tab.
   * If `existing` is provided, it pre-fills the form for editing.
   */
  openProfileEditor(parentEl, existing) {
    parentEl.querySelector(".discord-profile-editor")?.remove();
    const editor = parentEl.createDiv("discord-profile-editor");
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
    new import_obsidian.Setting(editor).setName("Display name").setDesc("Shown as the author in the embed.").addText(
      (text) => text.setPlaceholder("brorb").setValue(draft.display_name ?? "").onChange((v) => {
        draft.display_name = v.trim();
      })
    );
    new import_obsidian.Setting(editor).setName("Username").setDesc("The Discord @username.").addText(
      (text) => text.setPlaceholder("brorb").setValue(draft.username ?? "").onChange((v) => {
        draft.username = v.trim();
      })
    );
    new import_obsidian.Setting(editor).setName("Colour").setDesc("Hex colour for the author name, e.g. #FFDA43.").addText(
      (text) => text.setPlaceholder("#FFDA43").setValue(draft.color ?? "").onChange((v) => {
        draft.color = v.trim();
      })
    );
    new import_obsidian.Setting(editor).setName("Avatar URL").setDesc("Direct link to the profile picture.").addText(
      (text) => text.setPlaceholder(DEFAULT_AVATAR).setValue(draft.avatar_url ?? "").onChange((v) => {
        draft.avatar_url = v.trim();
      })
    );
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
    ).addButton(
      (btn) => btn.setButtonText("Manage Profiles").onClick(() => {
        this.openInlineProfileManager();
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
      });
    });
    new import_obsidian2.Setting(wrapper).setName("Timestamp").setDesc("ISO 8601 format. Leave blank for current time.").addText(
      (text) => text.setPlaceholder((/* @__PURE__ */ new Date()).toISOString()).setValue(draft.timestamp).onChange((v) => {
        draft.timestamp = v.trim();
      })
    );
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
        timestamp: m.timestamp || (/* @__PURE__ */ new Date()).toISOString()
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
      timestamp: ""
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
            src: p.avatar_url,
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
    new import_obsidian2.Setting(mgrRoot).setName("ID").addText(
      (t) => t.setPlaceholder("brorb").onChange((v) => {
        draft.id = v.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
      })
    );
    new import_obsidian2.Setting(mgrRoot).setName("Display Name").addText(
      (t) => t.setPlaceholder("brorb").onChange((v) => {
        draft.display_name = v.trim();
      })
    );
    new import_obsidian2.Setting(mgrRoot).setName("Username").addText(
      (t) => t.setPlaceholder("brorb").onChange((v) => {
        draft.username = v.trim();
      })
    );
    new import_obsidian2.Setting(mgrRoot).setName("Colour").addText(
      (t) => t.setPlaceholder("#FFDA43").onChange((v) => {
        draft.color = v.trim();
      })
    );
    new import_obsidian2.Setting(mgrRoot).setName("Avatar URL").addText(
      (t) => t.setPlaceholder(DEFAULT_AVATAR).onChange((v) => {
        draft.avatar_url = v.trim();
      })
    );
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
      .discord-manual-embed-modal {
        max-width: 640px;
        width: 640px;
      }
      .discord-manual-embed-modal .modal-content {
        padding: 16px 20px;
      }
      .discord-modal-bottom-bar {
        margin-top: 12px;
        padding-top: 10px;
        border-top: 1px solid var(--background-modifier-border);
      }
    `;
    this.contentEl.prepend(style);
  }
};

// src/discord-thread.css
var discord_thread_default = '/* Discord thread styles for Obsidian reading view / live preview. \r\n   Mirrors the Quartz website rendering. */\r\n\r\n.discord-thread {\r\n  --discord-bg: #2b2d31;\r\n  --discord-border: #1f2024;\r\n  --discord-hover: rgba(78, 80, 88, 0.6);\r\n  --discord-text-primary: #f2f3f5;\r\n  --discord-text-muted: #b5bac1;\r\n  --discord-author: #f2f3f5;\r\n  --discord-accent: #5865f2;\r\n  background: var(--discord-bg);\r\n  border: 1px solid var(--discord-border);\r\n  border-radius: 12px;\r\n  padding: 14px 18px;\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 0;\r\n  max-width: min(720px, 100%);\r\n  font-family: "gg sans", "Noto Sans", "Helvetica Neue", Helvetica, Arial, sans-serif;\r\n  position: relative;\r\n}\r\n\r\n.discord-thread-wrapper {\r\n  position: relative;\r\n  max-width: min(720px, 100%);\r\n  display: block;\r\n}\r\n\r\n.discord-thread-content {\r\n  position: relative;\r\n  overflow: hidden;\r\n  display: block;\r\n  transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);\r\n}\r\n\r\n.discord-thread-content.collapsed {\r\n  max-height: 420px;\r\n}\r\n\r\n.discord-thread-fade {\r\n  position: absolute;\r\n  inset-inline: 0;\r\n  bottom: 0;\r\n  height: 120px;\r\n  pointer-events: none;\r\n  opacity: 0;\r\n  background: linear-gradient(\r\n    to bottom,\r\n    rgba(43, 45, 49, 0) 0%,\r\n    rgba(43, 45, 49, 0.72) 52%,\r\n    rgba(43, 45, 49, 0.92) 78%,\r\n    #2b2d31 100%\r\n  );\r\n  transition: opacity 0.28s ease;\r\n  z-index: 2;\r\n}\r\n\r\n.discord-thread-wrapper.collapsed .discord-thread-fade,\r\n.discord-thread-content.collapsed .discord-thread-fade {\r\n  opacity: 1;\r\n}\r\n\r\n.discord-collapse-toggle {\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  gap: 0.5rem;\r\n  padding: 0.65rem 1.25rem;\r\n  margin: 0 auto;\r\n  margin-top: -3rem;\r\n  background: var(--background-secondary);\r\n  border: 1px solid var(--background-modifier-border);\r\n  border-radius: 8px;\r\n  color: var(--text-normal);\r\n  font-family: var(--font-interface);\r\n  font-size: 0.85rem;\r\n  font-weight: 600;\r\n  cursor: pointer;\r\n  transition: all 0.2s ease;\r\n  position: relative;\r\n  z-index: 3;\r\n  width: fit-content;\r\n  min-width: 140px;\r\n}\r\n\r\n.discord-thread-content:not(.collapsed) + .discord-collapse-toggle {\r\n  margin-top: 0.75rem;\r\n}\r\n\r\n.discord-collapse-toggle:hover {\r\n  background: var(--background-modifier-hover);\r\n  border-color: var(--interactive-accent);\r\n}\r\n\r\n.discord-collapse-icon {\r\n  width: 16px;\r\n  height: 16px;\r\n  transform-origin: 50% 50%;\r\n  transition: transform 0.3s ease;\r\n}\r\n\r\n.discord-collapse-toggle[aria-expanded="false"] .discord-collapse-icon {\r\n  transform: rotate(0deg);\r\n}\r\n\r\n.discord-collapse-toggle[aria-expanded="true"] .discord-collapse-icon {\r\n  transform: rotate(180deg);\r\n}\r\n\r\n.discord-message {\r\n  position: relative;\r\n  border-radius: 8px;\r\n  padding: 6px 8px 4px;\r\n  color: var(--discord-text-primary);\r\n  --discord-author-color: var(--discord-author);\r\n  display: grid;\r\n  grid-template-columns: 48px 1fr;\r\n  gap: 12px;\r\n  text-decoration: none;\r\n  align-items: flex-start;\r\n  width: 100%;\r\n  font: inherit;\r\n  user-select: text;\r\n  cursor: default;\r\n  transition: background 0.18s ease;\r\n}\r\n\r\n.discord-message * {\r\n  font-weight: inherit;\r\n}\r\n\r\n.discord-message + .discord-message {\r\n  margin-top: 2px;\r\n}\r\n\r\n.discord-message:hover {\r\n  background: var(--discord-hover);\r\n}\r\n\r\n.discord-message--compact {\r\n  padding-top: 2px;\r\n}\r\n\r\n.discord-avatar {\r\n  width: 40px;\r\n  min-width: 40px;\r\n  height: 40px;\r\n  aspect-ratio: 1 / 1;\r\n  border-radius: 50%;\r\n  overflow: hidden;\r\n  background: #1f2125;\r\n  border: 1px solid rgba(0, 0, 0, 0.2);\r\n  display: flex;\r\n  align-items: center;\r\n  justify-content: center;\r\n  margin-top: 6px;\r\n}\r\n\r\n.discord-avatar-spacer {\r\n  width: 40px;\r\n  min-width: 40px;\r\n  height: 10px;\r\n  display: block;\r\n  margin-top: 6px;\r\n}\r\n\r\n.discord-avatar img {\r\n  width: 100%;\r\n  height: 100%;\r\n  object-fit: cover;\r\n  display: block;\r\n}\r\n\r\n.discord-body {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 0.35rem;\r\n}\r\n\r\n.discord-message--compact .discord-body {\r\n  gap: 0.18rem;\r\n}\r\n\r\n.discord-header {\r\n  display: flex;\r\n  flex-wrap: nowrap;\r\n  align-items: baseline;\r\n  column-gap: 0.5rem;\r\n  row-gap: 0.15rem;\r\n  line-height: 1.25;\r\n  margin-bottom: 2px;\r\n  min-width: 0;\r\n}\r\n\r\n.discord-author {\r\n  font-weight: 600;\r\n  color: var(--discord-author-color, var(--discord-author));\r\n}\r\n\r\n.discord-header time {\r\n  font-size: 0.8125rem;\r\n  color: var(--discord-text-muted);\r\n  flex-shrink: 0;\r\n  white-space: nowrap;\r\n}\r\n\r\n.discord-content {\r\n  font-size: 0.95rem;\r\n  line-height: 1.4;\r\n  white-space: pre-wrap;\r\n  word-break: break-word;\r\n}\r\n\r\n.discord-content--compact {\r\n  margin-top: 2px;\r\n}\r\n\r\n.discord-attachments {\r\n  display: flex;\r\n  flex-direction: column;\r\n  gap: 8px;\r\n  margin-top: 6px;\r\n}\r\n\r\n.discord-attachment {\r\n  display: block;\r\n  max-width: min(420px, 100%);\r\n  border-radius: 10px;\r\n  overflow: hidden;\r\n  background: #1f2126;\r\n  border: 1px solid rgba(0, 0, 0, 0.35);\r\n  box-shadow: 0 8px 18px rgba(0, 0, 0, 0.36);\r\n}\r\n\r\n.discord-attachment img {\r\n  display: block;\r\n  width: 100%;\r\n  height: auto;\r\n}\r\n';

// src/renderer.ts
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
function resolveAuthor(msg, profiles) {
  if (msg.profile && profiles[msg.profile]) {
    const p = profiles[msg.profile];
    return {
      display_name: p.display_name,
      username: p.username,
      color: p.color,
      avatar_url: p.avatar_url || DEFAULT_AVATAR
    };
  }
  return {
    display_name: msg.author?.display_name || msg.author?.username || "Unknown User",
    username: msg.author?.username || "unknown",
    color: msg.author?.color ?? msg.author?.colour,
    avatar_url: msg.avatar_url || DEFAULT_AVATAR
  };
}
function getAuthorKey(msg, profiles) {
  if (msg.profile) return msg.profile;
  const a = msg.author;
  if (!a) return "";
  return `${a.username ?? ""}|${a.display_name ?? ""}`;
}
function renderDiscordThread(messages, profiles, collapsible = true) {
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
    const el = renderMessage(msg, prev, profiles);
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
function renderMessage(msg, prev, profiles) {
  const author = resolveAuthor(msg, profiles);
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
    img.src = author.avatar_url;
    img.alt = `${author.display_name}'s avatar`;
    img.loading = "lazy";
    img.width = 40;
    img.height = 40;
    img.onerror = () => {
      img.onerror = null;
      img.src = DEFAULT_AVATAR;
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
function registerDiscordRenderer(plugin) {
  plugin.registerMarkdownCodeBlockProcessor("discord", (source, el, ctx) => {
    if (!styleInjected) {
      const style = document.createElement("style");
      style.textContent = discord_thread_default;
      document.head.appendChild(style);
      styleInjected = true;
    }
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
      messages.length > 6
    );
    el.appendChild(thread);
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

// src/main.ts
var DiscordMessageEmbedPlugin = class extends import_obsidian3.Plugin {
  constructor() {
    super(...arguments);
    this.settings = DEFAULT_SETTINGS;
  }
  async onload() {
    await this.loadSettings();
    this.addSettingTab(new DiscordEmbedSettingTab(this.app, this));
    registerDiscordRenderer(this);
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
        if (!(view instanceof import_obsidian3.MarkdownView)) {
          return;
        }
        const selection = editor.getSelection();
        const urls = this.extractDiscordUrls(this.stripCitationMarker(selection));
        if (urls.length === 0) {
          return;
        }
        menu.addItem((item) => {
          item.setTitle("Insert Discord message embed").setIcon("message-square").onClick(() => {
            void this.insertEmbed(editor);
          });
        });
        menu.addItem((item) => {
          item.setTitle("Insert Discord message citation").setIcon("superscript").onClick(() => {
            void this.insertCitation(editor);
          });
        });
      })
    );
  }
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }
  async saveSettings() {
    await this.saveData(this.settings);
  }
  handleCommand(checking, editor, view, mode) {
    if (!(view instanceof import_obsidian3.MarkdownView)) {
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
      new import_obsidian3.Notice("Highlight at least one Discord message URL first.");
      return;
    }
    const loading = new import_obsidian3.Notice(
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
      new import_obsidian3.Notice("Unable to fetch one or more Discord messages.");
    } finally {
      loading.hide();
    }
  }
  async insertCitation(editor) {
    const selection = editor.getSelection();
    const urls = this.extractDiscordUrls(this.stripCitationMarker(selection));
    if (urls.length === 0) {
      new import_obsidian3.Notice("Highlight at least one Discord message URL first.");
      return;
    }
    const loading = new import_obsidian3.Notice(`Fetching ${urls.length} Discord citation...`, 0);
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
      new import_obsidian3.Notice("Unable to fetch the Discord citation.");
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
  async fetchDiscordMessage(url) {
    const response = await (0, import_obsidian3.requestUrl)({
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
    const authorColourHex = normaliseColour(
      payload.author?.color ?? payload.author?.colour,
      payload.author?.colour_value
    );
    const matchedProfile = this.findMatchingProfile(authorUsername, authorDisplay);
    if (matchedProfile) {
      return {
        profile: matchedProfile.id,
        content: payload.content ?? "",
        timestamp: payload.timestamp,
        url
      };
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
      avatar_url: payload.author?.avatar_url || DEFAULT_AVATAR,
      url
    };
  }
  /** Try to match an API response author to a saved profile by username. */
  findMatchingProfile(username, displayName) {
    if (!username && !displayName) return null;
    const profiles = this.settings.profiles;
    for (const key of Object.keys(profiles)) {
      const p = profiles[key];
      if (username && p.username.toLowerCase() === username.toLowerCase() || username && p.id.toLowerCase() === username.toLowerCase() || displayName && p.display_name.toLowerCase() === displayName.toLowerCase()) {
        return p;
      }
    }
    return null;
  }
};
