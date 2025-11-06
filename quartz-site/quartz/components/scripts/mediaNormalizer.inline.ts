const MEDIA_SELECTOR = "audio, video"
const IFRAME_SELECTOR = "iframe"
const DEFAULT_VOLUME = 0.38
const DEFAULT_GAIN = 0.82
const DEFAULT_COMPRESSOR = {
  threshold: -26,
  knee: 22,
  ratio: 12,
  attack: 0.003,
  release: 0.25,
} as const

const YOUTUBE_EMBED_PATTERN = /(?:youtube-nocookie\.com|youtube\.com)\/embed\//i
const DRIVE_PREVIEW_PATTERN = /drive\.google\.com\/file\/.*\/preview/i
const YOUTUBE_API_SRC = "https://www.youtube.com/iframe_api"

type YTPlayer = {
  setVolume: (volume: number) => void
  destroy: () => void
}

type YTNamespace = {
  Player?: new (element: HTMLElement | string, options?: Record<string, unknown>) => YTPlayer
  PlayerState?: {
    PLAYING?: number
  }
}

type AugmentedWindow = Window & typeof globalThis & {
  YT?: YTNamespace
  onYouTubeIframeAPIReady?: () => void
}

const clampVolume = (value: number): number => {
  if (!Number.isFinite(value)) {
    return DEFAULT_VOLUME
  }
  return Math.min(Math.max(value, 0), 1)
}

const resolveRootSetting = (attr: string): number | undefined => {
  const raw = document.documentElement.getAttribute(attr)
  if (!raw) {
    return undefined
  }

  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : undefined
}

const resolveElementSetting = (el: HTMLElement, attr: string): number | undefined => {
  const raw = el.getAttribute(attr) ?? (el.dataset as Record<string, string | undefined>)[attr]
  if (!raw) {
    return undefined
  }

  const value = Number.parseFloat(raw)
  return Number.isFinite(value) ? value : undefined
}

const ensureAudioContext = (() => {
  let ctx: AudioContext | null = null
  return () => {
    if (ctx && ctx.state !== "closed") {
      return ctx
    }

    const AudioCtx = (window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext)
    if (typeof AudioCtx !== "function") {
      return null
    }

    ctx = new AudioCtx()
    return ctx
  }
})()

const compressorDefaults = {
  threshold: resolveRootSetting("data-media-normalize-threshold") ?? DEFAULT_COMPRESSOR.threshold,
  knee: resolveRootSetting("data-media-normalize-knee") ?? DEFAULT_COMPRESSOR.knee,
  ratio: resolveRootSetting("data-media-normalize-ratio") ?? DEFAULT_COMPRESSOR.ratio,
  attack: resolveRootSetting("data-media-normalize-attack") ?? DEFAULT_COMPRESSOR.attack,
  release: resolveRootSetting("data-media-normalize-release") ?? DEFAULT_COMPRESSOR.release,
}

const resolveVolumePreference = (element?: HTMLElement): number => {
  const elementVolume = element ? resolveElementSetting(element, "mediaNormalizeVolume") : undefined
  const rootVolume = resolveRootSetting("data-media-normalize-volume")
  return clampVolume(elementVolume ?? rootVolume ?? DEFAULT_VOLUME)
}

const youtubePlayers = new Map<HTMLIFrameElement, YTPlayer>()
let youtubeApiPromise: Promise<YTNamespace | null> | null = null

const loadYouTubeApi = (): Promise<YTNamespace | null> => {
  if (typeof window === "undefined") {
    return Promise.resolve(null)
  }

  const augmentedWindow = window as AugmentedWindow

  const existing = augmentedWindow.YT
  if (existing && typeof existing.Player === "function") {
    return Promise.resolve(existing)
  }

  if (youtubeApiPromise) {
    return youtubeApiPromise
  }

  youtubeApiPromise = new Promise((resolve) => {
    const previous = augmentedWindow.onYouTubeIframeAPIReady

    augmentedWindow.onYouTubeIframeAPIReady = () => {
      try {
        previous?.()
      } catch (error) {
        console.warn("Media normalizer: YouTube API ready handler error", error)
      }

      const namespace = augmentedWindow.YT
      if (namespace && typeof namespace.Player === "function") {
        resolve(namespace)
      } else {
        resolve(null)
      }

      augmentedWindow.onYouTubeIframeAPIReady = previous
    }

    const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${YOUTUBE_API_SRC}"]`)
    if (!existingScript) {
      const script = document.createElement("script")
      script.src = YOUTUBE_API_SRC
      script.async = true
      script.onerror = () => {
        youtubeApiPromise = null
        resolve(null)
      }
      document.head.appendChild(script)
    }
  })

  return youtubeApiPromise
}

const applyYoutubeVolume = (player: YTPlayer, iframe: HTMLIFrameElement) => {
  try {
    const volume = Math.round(resolveVolumePreference(iframe) * 100)
    player.setVolume(volume)
  } catch (error) {
    console.warn("Media normalizer: unable to set YouTube volume", error)
  }
}

const installYoutubeNormalizer = (iframe: HTMLIFrameElement): void => {
  const dataKey = "mediaNormalizeYoutube"
  const state = iframe.dataset[dataKey]

  if (state === "pending") {
    return
  }

  const existingPlayer = youtubePlayers.get(iframe)
  if (state === "ready" && existingPlayer) {
    applyYoutubeVolume(existingPlayer, iframe)
    return
  }

  iframe.dataset[dataKey] = "pending"

  loadYouTubeApi()
    .then((namespace) => {
      if (!namespace || typeof namespace.Player !== "function") {
        iframe.dataset[dataKey] = "failed"
        return
      }

      const options: Record<string, unknown> = {
        events: {
          onReady: (event: { target: YTPlayer }) => {
            applyYoutubeVolume(event.target, iframe)
          },
        },
        playerVars: {
          playsinline: 1,
        },
      }

      let player: YTPlayer | undefined
      try {
        player = new namespace.Player!(iframe, options)
      } catch (error) {
        console.warn("Media normalizer: failed to initialize YouTube player", error)
        iframe.dataset[dataKey] = "failed"
        return
      }

      youtubePlayers.set(iframe, player)
      iframe.dataset[dataKey] = "ready"
      window.addCleanup?.(() => {
        youtubePlayers.delete(iframe)
        try {
          player?.destroy()
        } catch (error) {
          console.warn("Media normalizer: error destroying YouTube player", error)
        }
      })
    })
    .catch((error) => {
      console.warn("Media normalizer: YouTube API load failed", error)
      iframe.dataset[dataKey] = "failed"
      youtubeApiPromise = null
    })
}

const installDriveIframeNormalizer = (iframe: HTMLIFrameElement): void => {
  const dataKey = "mediaNormalizeDrive"
  const state = iframe.dataset[dataKey]
  if (state === "processing" || state === "ready") {
    return
  }

  iframe.dataset[dataKey] = "processing"

  const handleLoad = () => {
    iframe.removeEventListener("load", handleLoad)
    try {
      const doc = iframe.contentDocument
      if (!doc) {
        iframe.dataset[dataKey] = "ready"
        return
      }

      doc.querySelectorAll<HTMLMediaElement>(MEDIA_SELECTOR).forEach((media) => installNormalizer(media))
    } finally {
      iframe.dataset[dataKey] = "ready"
    }
  }

  try {
    const doc = iframe.contentDocument
    if (doc) {
      doc.readyState === "complete" || doc.readyState === "interactive"
        ? handleLoad()
        : iframe.addEventListener("load", handleLoad, { once: true })
      window.addCleanup?.(() => iframe.removeEventListener("load", handleLoad))
      return
    }
  } catch {
    // Cross-origin iframe; nothing we can safely do here.
  }

  iframe.dataset[dataKey] = "ready"
}

const installIframeNormalizer = (iframe: HTMLIFrameElement): void => {
  const src = iframe.getAttribute("src") ?? iframe.src ?? ""
  if (!src) {
    return
  }

  if (YOUTUBE_EMBED_PATTERN.test(src) || iframe.classList.contains("youtube")) {
    installYoutubeNormalizer(iframe)
    return
  }

  if (DRIVE_PREVIEW_PATTERN.test(src) || iframe.classList.contains("drive")) {
    installDriveIframeNormalizer(iframe)
  }
}

const installNormalizer = (element: HTMLMediaElement): void => {
  if (element.dataset.mediaNormalizeBound === "true") {
    return
  }

  element.dataset.mediaNormalizeBound = "true"

  element.volume = resolveVolumePreference(element)

  const audioContext = ensureAudioContext()
  if (!audioContext) {
    return
  }

  let source: MediaElementAudioSourceNode | undefined
  try {
    source = audioContext.createMediaElementSource(element)
  } catch (error) {
    console.warn("Media normalizer: unable to attach audio source", error)
    return
  }

  const compressor = audioContext.createDynamicsCompressor()
  compressor.threshold.value = resolveElementSetting(element, "mediaNormalizeThreshold") ?? compressorDefaults.threshold
  compressor.knee.value = resolveElementSetting(element, "mediaNormalizeKnee") ?? compressorDefaults.knee
  compressor.ratio.value = resolveElementSetting(element, "mediaNormalizeRatio") ?? compressorDefaults.ratio
  compressor.attack.value = resolveElementSetting(element, "mediaNormalizeAttack") ?? compressorDefaults.attack
  compressor.release.value = resolveElementSetting(element, "mediaNormalizeRelease") ?? compressorDefaults.release

  const gainNode = audioContext.createGain()
  const elementGain = resolveElementSetting(element, "mediaNormalizeGain")
  const rootGain = resolveRootSetting("data-media-normalize-gain")
  gainNode.gain.value = clampVolume(elementGain ?? rootGain ?? DEFAULT_GAIN)

  source.connect(compressor)
  compressor.connect(gainNode)
  gainNode.connect(audioContext.destination)

  const resumeContext = () => {
    if (audioContext.state === "suspended") {
      audioContext.resume().catch(() => undefined)
    }
  }

  element.addEventListener("play", resumeContext, { once: true })

  window.addCleanup(() => {
    element.removeEventListener("play", resumeContext)
    try {
      source?.disconnect()
      compressor.disconnect()
      gainNode.disconnect()
    } catch (error) {
      console.warn("Media normalizer: cleanup error", error)
    }
  })
}

const normaliseExistingMedia = () => {
  document.querySelectorAll<HTMLMediaElement>(MEDIA_SELECTOR).forEach((media) => installNormalizer(media))
}

const normaliseExistingIframes = () => {
  document.querySelectorAll<HTMLIFrameElement>(IFRAME_SELECTOR).forEach((iframe) => installIframeNormalizer(iframe))
}

const observeNewMedia = () => {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLMediaElement) {
          installNormalizer(node)
        } else if (node instanceof HTMLIFrameElement) {
          installIframeNormalizer(node)
        } else if (node instanceof HTMLElement) {
          node.querySelectorAll<HTMLMediaElement>(MEDIA_SELECTOR).forEach((media) => installNormalizer(media))
          node.querySelectorAll<HTMLIFrameElement>(IFRAME_SELECTOR).forEach((iframe) => installIframeNormalizer(iframe))
        }
      })
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
  window.addCleanup(() => observer.disconnect())
}

const normaliseAllMedia = () => {
  normaliseExistingMedia()
  normaliseExistingIframes()
  youtubePlayers.forEach((player, iframe) => applyYoutubeVolume(player, iframe))
}

normaliseAllMedia()
observeNewMedia()
document.addEventListener("nav", normaliseAllMedia)
