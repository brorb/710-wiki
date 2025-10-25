# Color Reference

This page lists every color token defined through `theme.colors.json` and how it shows up in the UI. Update the values in that file (and regenerate the site) to restyle the palette without hunting through individual components.

## Surface Layers
| Token | Hex (default) | Primary usage |
| --- | --- | --- |
| `color-primary-background` (`--light`) | `#080001` | Site body background, canvas overlay behind content, inactive graph nodes that represent tags |
| `color-surface-overlay` (`--lightgray`) | `#1a0507` | Explorer/backlink panels, graph canvas background, info box media backdrops |
| `color-panel-depth` (`--gray`) | `#240709` | Modal overlays (global graph popout), code block shells, comments widgets |
| `highlight-overlay` (`--highlight`) | `rgba(235, 28, 36, 0.18)` | Selection highlight, inline linked text emphasis |
| `textHighlight` | `#ff3a4066` | `.text-highlight` utility spans |

> The tokens in parentheses are legacy shorthands emitted alongside the scoped `color-*` variables. Either form will stay in sync.

## Tone & Copy
| Token | Hex (default) | Primary usage |
| --- | --- | --- |
| `color-tone-primary` (`--dark`) | `#c48a91` | Body copy, inline figcaptions, share feedback text, default icon fill |
| `color-tone-contrast` (`--darkgray`) | `#fbe2e6` | Article titles, headings, explorer/backlink headers, graph title label fills |
| `color-tone-muted` | `#b09598` | Inactive TOC/backlink entries, explorer tree links before hover |
| `color-tone-subtle` | `#8c4c52` | Article metadata rows, graph edge strokes, info box borders |

## Accents & Links
| Token | Hex (default) | Primary usage |
| --- | --- | --- |
| `color-accent-bright` (`--secondary`) | `#eb1c24` | Anchor text, focused buttons, active graph nodes |
| `color-accent-deep` (`--tertiary`) | `#b71000` | Accent hover states, tag node outlines inside the graph |
| `color-accent-shadow` | `#610700` | Accent shadow mixing for headings and callouts |
| `color-accent-shadow-light` | `#7a0600` | Low-degree graph node fill tier |
| `color-link` | `#ff5860` | External link color and comment hyperlinks |

## Interactive Elements
| Token | Hex (default) | Primary usage |
| --- | --- | --- |
| `color-button-text` | `#fff7f8` | Primary button label text (e.g., Utterances submit) |
| `color-button-background` | `#b71002` | Primary button backgrounds |
| `color-button-hover` | -> `color-accent-bright` | Hover + focus tone for buttons and header links |

## System Chrome
| Token | Hex (default) | Primary usage |
| --- | --- | --- |
| `color-scrollbar-thumb` | `#61070a` | Scrollbar groove thumb |
| `color-scrollbar-track` | -> `color-surface-overlay` | Scrollbar track background |

## Notes
- `color-tone-primary` now backs both the former `color-text-main` and `color-text-muted` uses. Any element previously pointing at the muted token will read the same hex value.
- `color-tone-subtle` is intentionally shared across text (article metadata) and structural accents (graph edges, info card borders); adjust the hex in one place if you need a different emphasis level.
- The build still emits `color-button-hover` and `color-scrollbar-track` CSS variables, but they now resolve to `color-accent-bright` and `color-surface-overlay` so downstream overrides keep working without extra palette entries.
- Button hover states lean on `color-accent-bright`, so there is no separate hover entry in the palette.
- When altering colors, make sure any dependent gradients or SVG assets are updated separately—those do not consume these tokens automatically.
