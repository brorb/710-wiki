---
title: Infobox Reference
tags:
  - documentation
---

# Infobox Reference

Use the ` ```infobox` code block to display a fixed, Wikipedia-style panel in the right-hand column on desktop. When present, it sticks to the top of the viewport so core facts stay visible while scrolling. Think of the block as a fill-in-the-blank form that Quartz reads when it builds the page.

## Quick Start

````markdown
---
title: Harrow Parish
---

```infobox
Title: Harrow Parish
Image: ![[710 Media/Images/harrow.png]]
Alt: Harrow parish crest
Caption: Field sketch recovered from the chapel wall.
Region: Ferkland County
Population: ~1,200 (est. 1993)
Known For:
- Ritual bells
- Stained glass reliquary
```
````

Place the code block immediately after the frontmatter. Delete the block to remove the panel entirely.

## Field Reference

- `Title:` — Optional heading shown at the top of the panel. Defaults to the page title if omitted.
- `Image:` — Optional image. Accepts standard URLs, repository paths, or Obsidian-style embeds such as `![[710 Media/Images/harrow.png]]`. Paste them exactly as Obsidian shows them—no extra quotation marks needed.
- `Alt:` — Plain-text alt description for screen readers.
- `Caption:` — Small caption rendered under the image.
- Any other `Label:` line turns into a fact row. Keep the label short (e.g., `Status`, `Affiliations`).
- Multi-value rows can be written either as semicolon-separated values (`Appearances: [[LOG-62.mp4]]; [[30]]`) or as a bullet list, as shown in the example above.
- Start list items with `-` or `*` on their own lines. They will render as comma-separated values inside the infobox.

## Step-by-Step: Adding One From Scratch

1. Open the note in Obsidian or your editor of choice.
2. Make sure the first lines of the file are wrapped in triple-dashed lines (`---`). That section is the frontmatter. In Obsidian, switch the Properties dropdown to **Source** so you can edit the raw text.
3. Paste the Quick Start sample under the frontmatter and update each field with the information you want to show.
4. Save the file. Quartz will pick up the code block the next time the site builds and the infobox will appear automatically.

If a note is missing frontmatter, add it manually like so:

````markdown
---
title: Page Title Here
---

```infobox
Title: Panel Heading Here
Fact Label: Details go here
```

# Rest of your note starts after this line
````

## Tips

- The panel is designed for concise, high-value details. Keep labels brief and values under a sentence when possible.
- Images larger than the available width are auto-scaled. Use PNG or JPG when possible to keep builds light.
- Avoid more than eight items; consider splitting long lists into separate pages or sections instead.
- On small screens the infobox drops into the main flow to keep the layout readable.
