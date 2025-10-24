# Discord Message Embed (Obsidian Plugin)

Convert highlighted Discord message links into Quartz-compatible blocks and inline citations. The plugin fetches message metadata from your Railway API and writes it directly into the note, ready for Quartz to render the faux Discord card you set up.

## Usage

### Embeds

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
          "username": "...",
          "color": "#FF0000"
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

### Citations

1. Place your cursor (or highlight placeholder text) where the inline citation marker should go.
2. Run **Insert Discord message citation**.
3. The selection is replaced with an HTML comment marker such as:

  ```html
  <!-- discord-cite:cite-xxxxxx-xxxxxx -->
  ```

  Quartz reads this marker (or the moustache form `{{discord-cite:...}}`) and swaps it for the hoverable Discord icon in the rendered article.
4. A `[!discord-cite]` callout containing just the JSON payload is appended underneath so the site has the full message data:

  ```markdown
  > [!discord-cite]- Discord citation (2 messages)
  >
  > ```json
  > {
  >   "id": "cite-xxxxxx-xxxxxx",
  >   "messages": [
  >     {
  >       "id": "...",
  >       "content": "...",
  >       "image": "![[optional-image.png]]"
  >     }
  >   ]
  > }
  > ```
  ```

If you prefer a visible inline trigger instead of a hidden HTML comment, change the marker to the moustache syntax (`{{discord-cite:cite-xxxxxx-xxxxxx}}`) after the command runs—the JSON stays the same.

## Installation

1. Copy the `discord-message-embed` folder into your vault’s `.obsidian/plugins/` directory.
2. (Optional) Run `npm install` inside the plugin folder if you want to rebuild `main.js` from the TypeScript source. Use `npm run build` to regenerate.
3. Enable **Discord Message Embed** in Obsidian’s **Community Plugins** view.

## Notes

- The plugin calls `https://discord-system-firebase-bot-production.up.railway.app/api/message` for each URL. There is no caching; highlight fewer URLs at once if you notice delays.
- If the API fails, the original text stays untouched and you’ll see an Obsidian notice.
- Empty avatars fall back to Discord’s default silhouette, and usernames default to the display name (or “Unknown User”) so the Quartz renderer always shows a believable card.
- To show images in a rendered citation, add an `"image"` field to the relevant message inside the JSON payload, for example `"image": "![[path/to/image.png]]"`. The transformer resolves Obsidian embeds and renders them beneath the matching message in Quartz.
- The hover preview on the published site will appear wherever you place the `<!-- discord-cite:... -->` (or `{{discord-cite:...}}`) marker, so you can cite multiple times with the same ID by reusing that marker.
