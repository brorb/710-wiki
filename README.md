# 7/10 Tone Sleuth Wiki

This is the information hub for everything related to the 7/10 Tone project and the custom Quartz build that powers https://www.710tone.wiki/.

## Graph view tuning

The local and global graph defaults live in `quartz-site/quartz/components/Graph.tsx`. You can tweak them without editing the Pixi renderer:

- `fontSize`: baseline text size (in `rem` units) for node labels.
- `opacityScale`: how quickly labels fade as you zoom out.
- `labelVisibility`: fine-grained control over when labels become readable. It accepts:
	- `minAlpha` / `maxAlpha`: lower/upper bounds for label opacity (0–1).
	- `startZoom` / `endZoom`: zoom factors where the fade starts and reaches full opacity.

The defaults are exposed in the `defaultOptions` object so you can copy/paste the block straight into `quartz.layout.ts` and override just the fields you care about, e.g.

```ts
Component.Graph({
	localGraph: {
		fontSize: 0.9,
		opacityScale: 1.8,
		labelVisibility: {
			minAlpha: 0.4,
			maxAlpha: 1,
			startZoom: 0.7,
			endZoom: 2.2,
		},
	},
})
```

## Media playback normalisation

An inline script (`quartz-site/quartz/components/scripts/mediaNormalizer.inline.ts`) now normalises every `<audio>` and `<video>` element. It applies a shared volume baseline, a gentle gain boost, and a dynamics compressor so loud clips stop spiking.

You can adjust the behaviour globally by adding attributes to `<html>` (or by editing the defaults in the script):

| Attribute | Purpose | Default |
| --- | --- | --- |
| `data-media-normalize-volume` | Initial media element volume (0–1) | `0.38` |
| `data-media-normalize-gain` | Post-compressor gain (0–1) | `0.82` |
| `data-media-normalize-threshold` | Compressor threshold (dB) | `-26` |
| `data-media-normalize-knee` | Compressor knee (dB) | `22` |
| `data-media-normalize-ratio` | Compression ratio | `12` |
| `data-media-normalize-attack` | Attack time (seconds) | `0.003` |
| `data-media-normalize-release` | Release time (seconds) | `0.25` |

Per-player overrides are available with matching `data-media-normalize-*` attributes on the individual `<audio>`/`<video>` tag.
