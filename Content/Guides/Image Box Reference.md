---
title: Image Box Reference
tags:
  - documentation
---

# Image Box Reference

Use the ` ```image-box` code block whenever you want an inline illustration that behaves like a mini-infobox. Quartz replaces the block with a styled `<figure>` that can float to either side of the article or sit centered in the flow.

> 📌 **When to use it**: character portraits, archival photos, diagrams, or any single image that deserves a caption and consistent framing without committing to a full sidebar infobox.

## Quick Start

Paste the block anywhere in your note (it does not have to live under the frontmatter):

````markdown
```image-box
Title: Oracle Avatar
Image: /static/oracle-pfp.png
Alt: The ORA_CLE profile emblem
Caption: The standard avatar bundled with the ORA_CLE widget.
Credit: Source: Internal design handoff
Align: right
Wrap: true
Width: 260px
```
````

That block renders like this:

```image-box
Title: Oracle Avatar
Image: /static/oracle-pfp.png
Alt: The ORA_CLE profile emblem
Caption: The standard avatar bundled with the ORA_CLE widget.
Credit: Source: Internal design handoff
Align: right
Wrap: true
Width: 260px
```

## Field Reference

| Field | Required | Notes |
| --- | --- | --- |
| `Image:` / `Src:` | ✅ | Accepts regular URLs, repo-relative paths (`Media/710 Media/Photos/array.png`), or Obsidian embeds (`![[Media/710 Media/Photos/array.png]]`). |
| `Alt:` | ✅ | Plain-text alt description for screen readers. Falls back to "Image illustration" if omitted. |
| `Title:` | optional | Small heading shown above the image. Useful for naming the subject. |
| `Caption:` | optional | Rich text (line breaks allowed) below the image. Newlines turn into `<br>` tags automatically. |
| `Credit:` | optional | Rendered beneath the caption in uppercase microcopy—perfect for attribution. |
| `Align:` | optional | `left`, `center`, or `right`. Defaults to `center`. |
| `Wrap:` | optional | `true` (default for left/right) makes surrounding paragraphs flow around the figure. Set `false` to keep it on its own line. |
| `Width:` | optional | Constrains the box (`260px`, `22rem`, `clamp(220px, 28vw, 360px)`, etc.). If omitted, Quartz uses `max-width: 380px` (320 px when floated). |
| `Link:` | optional | Wraps the image in an anchor. Supports external URLs, repo paths, and `[[Wiki Links]]`. |

### Line continuations

Indent subsequent lines to keep adding to the previous field:

````markdown
```image-box
Caption: First sentence.
  Second sentence continues the caption
  without needing another key.
```
````

## Layout Recipes

### Float an image on the left

```image-box
Title: Field Recorder Notes
Image: /static/oracle-pfp.png
Alt: Placeholder avatar artwork
Caption: When `Wrap` is left at `true`, paragraphs flow snugly around the card.
Align: left
Wrap: true
Width: 240px
```

### Center an image with no wrapping

```image-box
Title: Station Array Blueprint
Image: /static/oracle-pfp.png
Alt: Placeholder blueprint artwork
Caption: Use `Wrap: false` when you want the figure to stand alone.
Align: center
Wrap: false
Width: clamp(220px, 32vw, 360px)
```

## Tips

- Keep captions short—two or three sentences at most—so the box stays compact.
- On screens narrower than 900 px, floated boxes drop back into the normal flow so mobile layouts stay readable.
- You can place multiple image boxes in a single article; Quartz handles the floats independently.
- Pair with the main infobox for long-form entries: use the sidebar panel for structured facts and image boxes for supporting art inline.
