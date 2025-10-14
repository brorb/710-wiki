"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
const obsidian_1 = require("obsidian");
const API_ENDPOINT = "https://discord-system-firebase-bot-production.up.railway.app/api/message?url=";
const DEFAULT_AVATAR = "https://cdn.discordapp.com/embed/avatars/0.png";
const normaliseColour = (input, numeric) => {
    const trimmed = input?.trim();
    if (trimmed) {
        return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    }
    if (typeof numeric === "number" && Number.isFinite(numeric)) {
        return `#${numeric.toString(16).padStart(6, "0")}`;
    }
    return undefined;
};
class DiscordMessageEmbedPlugin extends obsidian_1.Plugin {
    async onload() {
        this.addCommand({
            id: "insert-discord-message-embed",
            name: "Insert Discord message embed",
            editorCheckCallback: (checking, editor, view) => this.handleCommand(checking, editor, view, "embed"),
        });
        this.addCommand({
            id: "insert-discord-message-citation",
            name: "Insert Discord message citation",
            editorCheckCallback: (checking, editor, view) => this.handleCommand(checking, editor, view, "citation"),
        });
        this.registerEvent(this.app.workspace.on("editor-menu", (menu, editor, view) => {
            if (!(view instanceof obsidian_1.MarkdownView)) {
                return;
            }
            const selection = editor.getSelection();
            const urls = this.extractDiscordUrls(this.stripCitationMarker(selection));
            if (urls.length === 0) {
                return;
            }
            menu.addItem((item) => {
                item
                    .setTitle("Insert Discord message embed")
                    .setIcon("message-square")
                    .onClick(() => {
                    void this.insertEmbed(editor);
                });
            });
            menu.addItem((item) => {
                item
                    .setTitle("Insert Discord message citation")
                    .setIcon("superscript")
                    .onClick(() => {
                    void this.insertCitation(editor);
                });
            });
        }));
    }
    handleCommand(checking, editor, view, mode) {
        if (!(view instanceof obsidian_1.MarkdownView)) {
            return false;
        }
        const selection = editor.getSelection();
        const urls = this.extractDiscordUrls(mode === "citation" ? this.stripCitationMarker(selection) : selection);
        if (checking) {
            return urls.length > 0;
        }
        if (mode === "embed") {
            void this.insertEmbed(editor);
        }
        else {
            void this.insertCitation(editor);
        }
        return true;
    }
    extractDiscordUrls(source) {
        if (!source) {
            return [];
        }
        const regex = /https:\/\/(?:ptb\.|canary\.)?discord\.com\/channels\/\d+\/\d+\/\d+/gi;
        const seen = new Set();
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
            new obsidian_1.Notice("Highlight at least one Discord message URL first.");
            return;
        }
        const loading = new obsidian_1.Notice(`Fetching ${urls.length} Discord message${urls.length > 1 ? "s" : ""}...`, 0);
        try {
            const messages = await this.fetchMessages(urls);
            const json = JSON.stringify(messages, null, 2);
            const block = "```discord\n" + json + "\n```";
            editor.replaceSelection(block);
        }
        catch (error) {
            console.error(error);
            new obsidian_1.Notice("Unable to fetch one or more Discord messages.");
        }
        finally {
            loading.hide();
        }
    }
    async insertCitation(editor) {
        const selection = editor.getSelection();
        const urls = this.extractDiscordUrls(this.stripCitationMarker(selection));
        if (urls.length === 0) {
            new obsidian_1.Notice("Highlight at least one Discord message URL first.");
            return;
        }
        const loading = new obsidian_1.Notice(`Fetching ${urls.length} Discord citation...`, 0);
        try {
            const messages = await this.fetchMessages(urls);
            const citationId = this.generateCitationId();
            const marker = `<!-- discord-cite:${citationId} -->`;
            const callout = this.buildCitationCallout(citationId, messages);
            editor.replaceSelection(marker);
            if (callout.trim().length > 0) {
                const cursor = editor.getCursor();
                const block = `\n\n${callout}\n`;
                editor.replaceRange(block, cursor);
            }
        }
        catch (error) {
            console.error(error);
            new obsidian_1.Notice("Unable to fetch the Discord citation.");
        }
        finally {
            loading.hide();
        }
    }
    formatCitationTimestamp(source) {
        if (!source) {
            return undefined;
        }
        const date = new Date(source);
        if (Number.isNaN(date.getTime())) {
            return source;
        }
        const year = date.getFullYear().toString().padStart(4, "0");
        const month = (date.getMonth() + 1).toString().padStart(2, "0");
        const day = date.getDate().toString().padStart(2, "0");
        const hours = date.getHours().toString().padStart(2, "0");
        const minutes = date.getMinutes().toString().padStart(2, "0");
        return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
    buildCitationCallout(citationId, messages) {
        if (messages.length === 0) {
            return "";
        }
        const countLabel = messages.length === 1 ? "1 message" : `${messages.length} messages`;
        const payload = {
            id: citationId,
            messages,
        };
        const jsonLines = JSON.stringify(payload, null, 2).split("\n");
        const lines = [`> [!discord-cite]- Discord citation (${countLabel})`];
        messages.forEach((message, index) => {
            const authorName = message.author.display_name?.trim() || message.author.username?.trim() || "Unknown User";
            const timestamp = this.formatCitationTimestamp(message.timestamp);
            const summaryParts = [`${index + 1}. ${authorName}`];
            if (timestamp) {
                summaryParts.push(timestamp);
            }
            lines.push(`> ${summaryParts.join(" - ")}`);
            const content = message.content?.trim();
            if (content) {
                content.split(/\r?\n/).forEach((line) => {
                    const text = line.trimEnd();
                    lines.push(`>     ${text}`);
                });
            }
            if (message.url) {
                lines.push(`>     Link: ${message.url}`);
            }
        });
        lines.push(">");
        lines.push(`> \`\`\`json`);
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
        const response = await (0, obsidian_1.requestUrl)({
            url: `${API_ENDPOINT}${encodeURIComponent(url)}`,
        });
        if (response.status >= 400) {
            throw new Error(`Request failed with status ${response.status}`);
        }
        return response.json;
    }
    mapToMessageBlock(url, payload) {
        const authorUsername = payload.author?.username?.trim();
        const authorDisplay = payload.author?.display_name?.trim();
        const authorColourHex = normaliseColour(payload.author?.color ?? payload.author?.colour, payload.author?.colour_value);
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
        };
    }
}
exports.default = DiscordMessageEmbedPlugin;
module.exports = DiscordMessageEmbedPlugin;
module.exports.default = DiscordMessageEmbedPlugin;
