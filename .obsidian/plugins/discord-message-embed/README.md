# Discord Message Embed (Obsidian Plugin)

Convert highlighted Discord message links into a Quartz-compatible ```discord code block. The plugin fetches message metadata from your Railway API and writes it directly into the note, ready for Quartz to render the faux Discord card you set up.

## Usage

1. Paste one or more Discord message URLs into a note (each URL must be of the form `https://discord.com/channels/<guild>/<channel>/<message>` — `ptb.` and `canary.` subdomains also work).
2. Highlight the URL(s).
3. Right-click the selection and choose **Insert Discord message embed** (also available via the command palette with the same name).
4. The selection is replaced with a code fence:

    ```
    ```discord
    [
      {
        "id": "...",
        "author": {
          "display_name": "...",
          "username": "..."
        },
        "content": "...",
        "timestamp": "...",
        "avatar_url": "...",
        "url": "..."
      }
    ]
    ```
    ```

Quartz will now turn that block into your stylised message card. Multiple highlighted URLs become a single array so they display as a stacked conversation.

## Installation

1. Copy the `discord-message-embed` folder into your vault’s `.obsidian/plugins/` directory.
2. (Optional) Run `npm install` inside the plugin folder if you want to rebuild `main.js` from the TypeScript source. Use `npm run build` to regenerate.
3. Enable **Discord Message Embed** in Obsidian’s **Community Plugins** view.

## Notes

- The plugin calls `https://discord-system-firebase-bot-production.up.railway.app/api/message` for each URL. There is no caching; highlight fewer URLs at once if you notice delays.
- If the API fails, the original text stays untouched and you’ll see an Obsidian notice.
- Empty avatars fall back to Discord’s default silhouette, and usernames default to the display name (or “Unknown User”) so the Quartz renderer always shows a believable card.
