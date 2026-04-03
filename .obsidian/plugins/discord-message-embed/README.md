# Discord Message Embed (Obsidian Plugin)

Embed Discord messages in your vault and publish them as styled cards on Quartz. Supports linked server messages (fetched via API), manually-entered DM/private messages, reusable author profiles, in-editor rendering, and inline citations.

## Quick Start

### 1. Set Up Profiles

Before inserting messages you need at least one **profile** -- a saved author identity (name, avatar, colour).

**Settings > Discord Message Embed > Discord Profiles > + New Profile**

You can fill the fields manually, or -- much faster -- use the **Auto-fill from message URL** feature:

1. Paste any Discord message URL from the user you want to create a profile for.
2. Click **Fetch**.
3. The plugin pulls the avatar, username, display name, and role colour from the API and fills every field for you.
4. Give it an ID (auto-suggested from the username) and hit **Save**.

### 2. Insert Messages

There are two ways to insert discord blocks:

#### From a Discord Message URL (server messages)

1. Paste one or more Discord message URLs into a note (`https://discord.com/channels/<guild>/<channel>/<message>`).
2. Highlight the URL(s).
3. **Right-click > Insert Discord embed (from URL)** or run the command from the palette.
4. The highlighted text is replaced with a ` ```discord ` code fence containing the fetched message data.

If a matching profile exists, the block will use the slim `"profile"` key instead of repeating all the author info.

#### Manual Entry (DMs, private messages, any text)

1. Place your cursor in a note.
2. **Right-click > Insert Discord embed (manual)** -- or use the command palette.
3. A dialog opens where you select a profile, type the message content, and optionally set a timestamp.
4. Click **+ Add Message** to add more messages to the same block.
5. Hit **Insert Embed** -- done.

> Both the manual insert options are **always** visible in the editor right-click menu, so you can insert messages from anywhere without needing to select text first. The URL-based options appear only when Discord URLs are selected.

### 3. Citations

Citations work the same way as embeds but produce a hover-tooltip on the published site:

- **Right-click > Insert Discord citation (from URL)** -- for linked messages.
- **Right-click > Insert Discord citation (manual)** -- for manual entry.

The command inserts an invisible marker (`<!-- discord-cite:... -->`) at the cursor and appends a `[!discord-cite]` callout with the JSON payload.

### 4. In-Editor Preview

All ` ```discord ` blocks render inside Obsidian in Reading View and Live Preview with Discord-matching styling -- dark background, avatars, coloured names, timestamps, and a collapse/expand toggle for long threads.

## Profile Format

Blocks that use a profile look like this:

```json
[
  {
    "profile": "brorb",
    "content": "Hello world!",
    "timestamp": "2025-07-01T12:34:56Z"
  }
]
```

The renderer (both in Obsidian and on the published Quartz site) resolves `"profile": "brorb"` to the display name, avatar URL, and colour from the plugin settings. No need to repeat bulky author objects.

Legacy blocks with inline `"author"` / `"avatar_url"` fields still work.

## Attachments

Add an `"attachments"` array to show images, audio, video, or files inline with a message:

```json
{
  "profile": "brorb",
  "content": "Check this out",
  "attachments": [
    { "target": "![[Screenshot.png]]", "alt": "A screenshot", "typeHint": "image" },
    { "target": "https://example.com/clip.ogg", "title": "Audio clip", "typeHint": "audio" }
  ]
}
```

- `target` -- Obsidian embed (`![[...]]`), relative path, or URL.
- `typeHint` -- `image` | `audio` | `video` | `file` (inferred from extension when omitted).
- `alt` (images) / `title` (files) -- optional label.

## Settings

| Setting | Description |
|---------|-------------|
| **API endpoint** | The Railway URL used to fetch linked server messages. |
| **Discord Profiles** | Create, edit, and delete reusable author profiles. Each profile stores a display name, @username, hex colour, and avatar URL. Use **Auto-fill from message URL** to populate fields from any message by that user. |

## Commands & Context Menu

| Action | How to trigger |
|--------|---------------|
| Insert embed from URL | Right-click (when URLs selected) or Command Palette |
| Insert citation from URL | Right-click (when URLs selected) or Command Palette |
| Insert embed manually | Right-click (always visible) or Command Palette |
| Insert citation manually | Right-click (always visible) or Command Palette |

## Installation

1. Copy the `discord-message-embed` folder into your vault's `.obsidian/plugins/` directory.
2. Enable **Discord Message Embed** in Obsidian's **Settings > Community Plugins**.
3. (Optional) To rebuild from source: `npm install && npm run build` inside the plugin folder.

## Notes

- The API is called once per URL with no caching -- keep URL counts reasonable.
- If a fetch fails, the original text stays untouched and an Obsidian notice appears.
- Avatars fall back to Discord's default silhouette when not set.
- Citation markers (`<!-- discord-cite:... -->` or `{{discord-cite:...}}`) can be reused to cite the same message in multiple places.
