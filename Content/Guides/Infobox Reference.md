---
title: Infobox Reference
tags:
  - documentation
---

# Infobox Reference

Use the new `infobox` frontmatter block to display a fixed, Wikipedia-style panel in the right-hand column on desktop. When present, it sticks to the top of the viewport so core facts stay visible while scrolling. Think of the block as a fill-in-the-blank form that Quartz reads when it builds the page.

## Quick Start

```yaml
---
title: Harrow Parish
infobox:
  title: Harrow Parish
  image:
    src: ![[710 Media/Images/harrow.png]]
    alt: Harrow parish crest
    caption: Field sketch recovered from the chapel wall.
  items:
    - label: Region
      value: Ferkland County
    - label: Population
      value: ~1,200 (est. 1993)
    - label: Known For
      value:
        - Ritual bells
        - Stained glass reliquary
---
```

Place this block above the page heading in the Markdown file. Delete the `infobox` section to remove the panel entirely.

## Field Reference

- `infobox.title` — Optional heading shown at the top of the panel. Defaults to the page title if omitted.
- `infobox.image.src` — Optional image. Accepts standard URLs, paths in the repository, or Obsidian-style embeds such as `![[710 Media/Images/harrow.png]]`. Quartz now quotes these automatically, so you can paste them exactly as Obsidian shows them—no extra quotation marks needed.
- `infobox.image.alt` — Plain-text alt description for screen readers.
- `infobox.image.caption` — Small caption rendered under the image.
- `infobox.items` — List of key facts. Each item needs a `label` and `value`.
  - `label` should be short (e.g., `Status`, `Affiliations`).
  - `value` can be a single string, a number, or a list. Lists are rendered as comma-separated values (for example, `value:
        - Ritual bells
        - Stained glass reliquary` becomes `Ritual bells, Stained glass reliquary` inside the panel).

## Step-by-Step: Adding One From Scratch

1. Open the note in Obsidian or your editor of choice.
2. Make sure the first lines of the file are wrapped in triple-dashed lines (`---`). That section is the “frontmatter”. In Obsidian, switch the Properties dropdown to **Source** so you can edit the raw text.
3. Paste the example block from the Quick Start and update each field with the information you want to show.
4. Save the file. Quartz will pick up the new frontmatter the next time the site builds and the infobox will appear automatically.

If the frontmatter area is missing, add it manually like so:

```yaml
---
title: Page Title Here
infobox:
  title: Panel Heading Here
  items:
    - label: First Fact
      value: Details go here
---

# Rest of your note starts after this line
```

## Tips

- The panel is designed for concise, high-value details. Keep labels brief and values under a sentence when possible.
- Images larger than the available width are auto-scaled. Use PNG or JPG when possible to keep builds light.
- Avoid more than 8 items; consider splitting long lists into separate pages or sections instead.
- On small screens the infobox drops into the main flow to keep the layout readable.
