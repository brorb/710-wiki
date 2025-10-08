import { pathToRoot } from "../util/path"
import { classNames } from "../util/lang"
import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"

type CanvasOptions = {
  /** Relative path from the Quartz output root to the exported canvas HTML files */
  canvasPath?: string
}

const DEFAULT_CANVAS_PATH = "Canvas/html"

const normalizeCanvasPath = (path: string | undefined): string | null => {
  if (!path) {
    return null
  }

  const trimmed = path.trim()
  if (trimmed.length === 0) {
    return null
  }

  return trimmed.replace(/^\/+/, "").replace(/\/+$/, "")
}

const joinUrl = (...segments: string[]): string => {
  if (segments.length === 0) {
    return ""
  }

  return segments
    .filter((segment) => typeof segment === "string" && segment.length > 0)
    .map((segment, index) => {
      if (index === 0) {
        return segment.replace(/\/+$/g, "")
      }

      return segment.replace(/^\/+|\/+$/g, "")
    })
    .join("/")
}

const isCanvasPage = (slug: string | undefined): boolean => {
  if (!slug) {
    return false
  }

  return slug.startsWith("canvases/")
}

const normalizeHandle = (handle: string | undefined): string | null => {
  if (!handle) {
    return null
  }

  const trimmed = handle.trim()
  if (trimmed.length === 0) {
    return null
  }

  return trimmed.replace(/\.html?$/i, "")
}

export default ((options?: CanvasOptions) => {
  const normalizedCanvasPath = normalizeCanvasPath(options?.canvasPath) ?? DEFAULT_CANVAS_PATH

  const Canvas: QuartzComponent = (props: QuartzComponentProps) => {
    const { fileData, displayClass } = props

    if (!isCanvasPage(fileData.slug) || fileData.frontmatter?.draft) {
      return null
    }

    const override =
      typeof fileData.frontmatter?.canvas === "string"
        ? fileData.frontmatter?.canvas
        : typeof fileData.frontmatter?.canvasSlug === "string"
          ? fileData.frontmatter?.canvasSlug
          : typeof fileData.frontmatter?.canvasFile === "string"
            ? fileData.frontmatter?.canvasFile
            : undefined

    const slugSegments = fileData.slug?.split("/") ?? []
    const fallbackHandle = slugSegments[slugSegments.length - 1]
    const canvasHandle = normalizeHandle(override) ?? normalizeHandle(fallbackHandle)

    if (!canvasHandle) {
      return null
    }

    const rootPath = pathToRoot(fileData.slug!)
    const prefix = rootPath === "." ? "." : rootPath
    const iframeSrc = encodeURI(joinUrl(prefix, normalizedCanvasPath, `${canvasHandle}.html`))
    const description =
      typeof fileData.frontmatter?.canvasDescription === "string"
        ? fileData.frontmatter?.canvasDescription
        : typeof fileData.frontmatter?.description === "string"
          ? fileData.frontmatter?.description
          : null
    const title =
      fileData.frontmatter?.title ??
      canvasHandle
        .split("-")
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join(" ")

    return (
      <section class={classNames(displayClass, "canvas-container")} data-canvas={canvasHandle}>
        <div class="canvas-frame">
          <iframe src={iframeSrc} title={`Canvas visualization: ${title}`} loading="lazy" allow="fullscreen" />
          <div class="canvas-loading" role="status" aria-live="polite">
            <span class="canvas-spinner" aria-hidden="true" />
            <span class="canvas-loading__text">Loading canvas…</span>
          </div>
        </div>
        {description ? <p class="canvas-caption">{description}</p> : null}
      </section>
    )
  }

  Canvas.css = `
.canvas-container {
  margin: 2rem 0 1.5rem;
}

.canvas-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: var(--lightgray);
  border-radius: 0.75rem;
  overflow: hidden;
  box-shadow: 0 1.25rem 2.5rem rgba(0, 0, 0, 0.15);
  transition: box-shadow 150ms ease, transform 150ms ease;
}

.canvas-frame:hover {
  transform: translateY(-2px);
  box-shadow: 0 1.4rem 2.6rem rgba(0, 0, 0, 0.18);
}

.canvas-frame iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.canvas-loading {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.95), rgba(245, 245, 245, 0.9));
  color: var(--darkgray);
  transition: opacity 200ms ease, visibility 200ms ease;
  z-index: 1;
}

.canvas-loading.is-hidden {
  opacity: 0;
  visibility: hidden;
}

.canvas-loading.is-error {
  background: rgba(255, 232, 230, 0.95);
  color: #a13a28;
}

.canvas-spinner {
  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  border: 0.35rem solid rgba(0, 0, 0, 0.1);
  border-top-color: var(--secondary);
  animation: canvas-spin 1s linear infinite;
}

.canvas-caption {
  margin: 0.75rem auto 0;
  max-width: 48rem;
  text-align: center;
  color: var(--darkgray);
  font-size: 0.95rem;
}

@keyframes canvas-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 768px) {
  .canvas-frame {
    aspect-ratio: 3 / 4;
  }
}
`

  Canvas.afterDOMLoaded = `
  document.querySelectorAll('.canvas-frame').forEach((wrapper) => {
    if (wrapper.dataset.initialized === 'true') {
      return
    }

    const iframe = wrapper.querySelector('iframe')
    const loader = wrapper.querySelector('.canvas-loading')
    const text = loader?.querySelector('.canvas-loading__text')

    if (!iframe || !loader) {
      return
    }

    const markInitialized = () => {
      wrapper.dataset.initialized = 'true'
    }

    const hideLoader = () => {
      loader.classList.add('is-hidden')
      loader.classList.remove('is-error')
      markInitialized()
    }

    const showError = () => {
      loader.classList.remove('is-hidden')
      loader.classList.add('is-error')
      if (text) {
        text.textContent = 'Canvas failed to load. Check your exported files.'
      }
      markInitialized()
    }

    iframe.addEventListener('load', hideLoader, { once: true })
    iframe.addEventListener('error', showError, { once: true })

    if (iframe.complete) {
      hideLoader()
    }
  })
`

  return Canvas
}) satisfies QuartzComponentConstructor<CanvasOptions>
