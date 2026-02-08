---
title: Custom Formatting Reference
tags:
  - documentation
---

# Custom Formatting Reference

Quartz ships several bespoke Markdown transformers so you can drop rich, reusable building blocks straight into articles. This guide consolidates every custom element—media boxes, infoboxes, Discord transcripts, and YouTube community posts—into one place with live examples.

## Media boxes (` ```media-box` )

Use a `media-box` fence whenever you want a framed figure that can contain images, video, or audio without writing raw HTML. Drop the block anywhere in the note; Quartz swaps it for a styled `<figure>` with optional heading, caption, and credit.

````markdown
```media-box
Title: Station Array Blueprint
Media: /static/oracle-pfp.png
Alt: Placeholder blueprint artwork
Caption: Use `Wrap: false` when you want the figure to stand alone.
Align: center
Wrap: false
Width: clamp(220px, 32vw, 360px)
```
````

### Supported fields

| Field | Required | Notes |
| --- | --- | --- |
| `Media:` / `Src:` / `Image:` | ✅ | Accepts external URLs, repo-relative paths (`Media/710 Media/Images/710 Tone pfp.jpg`), or Obsidian embeds (`![[Media/710 Media/Images/710 Tone pfp.jpg]]`). |
| `Alt:` | ✅ for images/audio | Used for `<img>` alt text or the `aria-label` on media players. Falls back to "Media illustration". |
| `Title:` | optional | Renders above the media in uppercase microcopy. |
| `Caption:` | optional | Rich text below the media. Indented lines continue the previous field so multi-line captions are easy. |
| `Credit:` | optional | Small uppercase attribution rendered under the caption. |
| `Align:` | optional | `left`, `center`, or `right`. Defaults to `center`. |
| `Wrap:` | optional | `true` lets paragraphs flow around the card (default for left/right). Use `false` to make it stand alone. |
| `Width:` | optional | Constrains the maximum width (`260px`, `22rem`, `clamp(220px, 28vw, 360px)`, etc.). |
| `Link:` | optional | Wraps images in an anchor (not applied to audio/video). Supports external URLs and `[[wiki-links]]`. |
| `Type:` | optional | Force `image`, `video`, or `audio`. When omitted the transformer infers from the file extension/URL. |
| `Poster:` | optional | Poster frame for videos (URL or embed). |
| `Autoplay:` / `Loop:` / `Muted:` | optional | Boolean flags for video/audio playback. (`Autoplay` automatically implies `Muted`.) |

### Video and audio examples

````markdown
```media-box
Title: Elevator Camera
Type: video
Media: https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4
Poster: https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.jpg
Caption: External MP4 embed with a poster frame. Controls are enabled by default.
Align: center
Wrap: false
Width: 480px
```

```media-box
Title: SIGNAL849 Broadcast
Type: audio
Media: [[Media/710 Media/Audio/SIGNAL849 (1).mp3]]
Caption: Audio clips inherit the common chrome but drop the box shadow for clarity.
Credit: Source: Sleuth archive rip
Align: left
Wrap: true
Width: 320px
```
````

### Gallery rows

Place two or more non-wrapping boxes directly back-to-back to create a responsive gallery. Quartz groups them into a flex row on desktop and stacks them vertically below 900 px.

````markdown
```media-box
Title: North Tower Array
Media: /static/oracle-pfp.png
Alt: Stylised tower blueprint
Caption: Keep `Wrap: false` so the cluster stays in its own lane.
Align: center
Wrap: false
Width: clamp(220px, 28vw, 340px)
```
```media-box
Title: Control Bay Wiring
Media: /static/oracle-pfp.png
Alt: Wiring diagram placeholder
Caption: Consecutive blocks join the same row automatically.
Align: center
Wrap: false
Width: clamp(220px, 28vw, 340px)
```
```media-box
Title: Signal Booster
Media: /static/oracle-pfp.png
Alt: Placeholder booster artwork
Caption: On small screens they stack vertically.
Align: center
Wrap: false
Width: clamp(220px, 28vw, 340px)
```
````

**Tips**
- Floated boxes (`Wrap: true`) drop back into the normal flow on screens narrower than 900 px.
- Consecutive boxes only cluster when every block has `Wrap: false`.
- Video/audio inherit the same frame so magazine layouts stay consistent.

## Infobox blocks (` ```infobox` )

The infobox transformer renders a persistent, Wikipedia-style panel in the right-hand column on desktop. Place the block immediately after frontmatter.

````markdown
---
title: Harrow Parish
---

```infobox
Title: Harrow Parish
Image: ![[Media/710 Media/Images/harrow.png]]
Alt: Harrow parish crest
Caption: Field sketch recovered from the chapel wall.
Region: Ferkland County
Population: ~1,200 (est. 1993)
Known For:
- Ritual bells
- Stained glass reliquary
```
````

- `Title` defaults to the page title if omitted.
- `Image` accepts URLs, repo paths, or Obsidian embeds. Newlines under a key extend the value, which is perfect for bullet lists.
- Every extra `Label: Value` pair becomes a detail row; multi-value lists render as comma-separated entries.
- On narrow screens the panel drops into the main article flow.

## Discord transcripts (` ```discord` )

Use the `discord` fence to embed message transcripts with the faux Discord UI. Paste valid JSON—Obsidian’s Discord embed plugin already outputs the correct shape.

````markdown
```discord
[
  {
    "id": "1399746099903860807",
    "timestamp": "2025-07-29T13:31:16.242000+00:00",
    "content": "<OUTPRINT>!:(I could try at a \"gag\".)",
    "url": "https://discord.com/channels/1389902002737250314/1391009839261552712/1399746099903860807",
    "author": {
      "display_name": "SYSTEM",
      "username": "system000008",
      "color": "#FF0000"
    },
    "avatar_url": "https://cdn.discordapp.com/avatars/1396134967091793992/8842f7241caf01fab110863d1545e52d.png?size=1024"
  },
  {
    "id": "1399746553018847292",
    "timestamp": "2025-07-29T13:33:04.273000+00:00",
    "content": "<OUTPRINT>!:(█)",
    "url": "https://discord.com/channels/1389902002737250314/1391009839261552712/1399746553018847292",
    "author": {
      "display_name": "SYSTEM",
      "username": "system000008",
      "color": "#FF0000"
    },
    "avatar_url": "https://cdn.discordapp.com/avatars/1396134967091793992/8842f7241caf01fab110863d1545e52d.png?size=1024"
  }
]
```
````

**Notes**
- The transformer expects an array of message objects. Escape literal newlines as `\n` within `content`.
- Attachments and embeds go into a `"attachments": [...]` array per message (the Obsidian helper handles this automatically).
- Long transcripts collapse by default; Quartz injects a “Show more” button.

### Discord citations

Inline callouts tie prose to the primary sources. Drop one of these beneath a paragraph and Quartz swaps it for the Discord icon with hoverable metadata:

````markdown
<!-- discord-cite:cite-abcdef-ghijkl -->
> [!discord-cite]- Discord citation (2 messages)
> ```json
> [
>   { "id": "...", "content": "First message" },
>   { "id": "...", "content": "Second message" }
> ]
> ```
````

The hidden HTML comment (or moustache form `{{discord-cite:...}}`) becomes the hover trigger, while the JSON inside the callout feeds the renderer.

## YouTube community posts (` ```community-post` )

Convert raw community posts into the rich embed used on the wiki with a dedicated fence. The opening line encodes metadata as comma-separated values: `community-post,<likes>,<comments>,<posted label>`. The body accepts normal Markdown and Obsidian image embeds.

````markdown
```community-post,@7-10tone,4,1,28 July 2025, Channel poll: Sleeper status
Sleeper status report. [[Image Embed|![[Media/710 Media/Images/710 Tone pfp.jpg]]]]

**Options**
- ✅ All systems stable
- ⚠️ Watching the timers
- ❌ Something feels off
```
````

- Likes and comment counts must be integers. The posted label is freeform text (e.g. `28 July 2025` or `2 days ago`).
- Embed assets with `![[...]]` and they will be resolved relative to the current page.
- When placed on any page other than `YouTube/Community Posts`, the transformer automatically links to the canonical community post entry.

---

Need another formatting widget? Drop a TODO in this note and the build will flag it during review.
