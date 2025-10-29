const MEDIA_SELECTOR = "audio, video"
const DEFAULT_VOLUME = 0.38
const DEFAULT_GAIN = 0.82
const DEFAULT_COMPRESSOR = {
  threshold: -26,
  knee: 22,
  ratio: 12,
  attack: 0.003,
  release: 0.25,
} as const

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

const installNormalizer = (element: HTMLMediaElement): void => {
  if (element.dataset.mediaNormalizeBound === "true") {
    return
  }

  element.dataset.mediaNormalizeBound = "true"

  const elementVolume = resolveElementSetting(element, "mediaNormalizeVolume")
  const rootVolume = resolveRootSetting("data-media-normalize-volume")
  const resolvedVolume = clampVolume(elementVolume ?? rootVolume ?? DEFAULT_VOLUME)
  element.volume = resolvedVolume

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

const observeNewMedia = () => {
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node instanceof HTMLMediaElement) {
          installNormalizer(node)
        } else if (node instanceof HTMLElement) {
          node.querySelectorAll<HTMLMediaElement>(MEDIA_SELECTOR).forEach((media) => installNormalizer(media))
        }
      })
    }
  })

  observer.observe(document.body, { childList: true, subtree: true })
  window.addCleanup(() => observer.disconnect())
}

normaliseExistingMedia()
observeNewMedia()
document.addEventListener("nav", normaliseExistingMedia)
