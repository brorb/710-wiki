import type { SerializedContentDetails } from "../../plugins/emitters/contentIndex"
import {
  SimulationNodeDatum,
  SimulationLinkDatum,
  Simulation,
  forceSimulation,
  forceManyBody,
  forceCenter,
  forceLink,
  forceCollide,
  forceRadial,
  zoomIdentity,
  ZoomTransform,
  select,
  drag,
  zoom,
} from "d3"
import { Text, Graphics, Application, Container, Circle } from "pixi.js"
import { Group as TweenGroup, Tween as Tweened } from "@tweenjs/tween.js"
import { registerEscapeHandler, removeAllChildren } from "./util"
import { FullSlug, SimpleSlug, getFullSlug, resolveRelative, simplifySlug } from "../../util/path"
import { D3Config } from "../Graph"

type GraphicsInfo = {
  color: string
  gfx: Graphics
  alpha: number
  active: boolean
}

type NodeData = {
  id: SimpleSlug
  text: string
  tags: string[]
} & SimulationNodeDatum

type SimpleLinkData = {
  source: SimpleSlug
  target: SimpleSlug
}

type LinkData = {
  source: NodeData
  target: NodeData
} & SimulationLinkDatum<NodeData>

type LinkRenderData = GraphicsInfo & {
  simulationData: LinkData
  visible: boolean
}

type NodeRenderData = GraphicsInfo & {
  simulationData: NodeData
  label: Text
  visible: boolean
  singlet: boolean
}

type GraphForceSettings = {
  repelForce: number
  centerForce: number
  linkDistance: number
}

type GraphBooleanOptions = {
  showSinglets: boolean
  highlightVisited: boolean
  focusOnHover: boolean
}

type GraphRuntimeHandle = {
  getForceSettings: () => GraphForceSettings
  getDefaultForceSettings: () => GraphForceSettings
  updateForceSettings: (settings: Partial<GraphForceSettings>) => GraphForceSettings
  resetForceSettings: () => GraphForceSettings
  getBooleanOptions: () => GraphBooleanOptions
  updateBooleanOptions: (settings: Partial<GraphBooleanOptions>) => GraphBooleanOptions
  resetBooleanOptions: () => GraphBooleanOptions
  zoomBy: (direction: "in" | "out") => void
}

type GraphElement = HTMLElement & {
  __graphHandle?: GraphRuntimeHandle
}

type GraphControlKey = keyof GraphForceSettings

const DEFAULT_FORCE_SETTINGS: GraphForceSettings = {
  repelForce: 0.5,
  centerForce: 0.2,
  linkDistance: 30,
}

const FORCE_LIMITS: Record<GraphControlKey, { min: number; max: number }> = {
  repelForce: { min: 0.1, max: 2 },
  centerForce: { min: 0, max: 2 },
  linkDistance: { min: 12, max: 160 },
}

const DEFAULT_BOOLEAN_OPTIONS: GraphBooleanOptions = {
  showSinglets: true,
  highlightVisited: true,
  focusOnHover: true,
}

const localStorageKey = "graph-visited"
function getVisited(): Set<SimpleSlug> {
  return new Set(JSON.parse(localStorage.getItem(localStorageKey) ?? "[]"))
}

function addToVisited(slug: SimpleSlug) {
  const visited = getVisited()
  visited.add(slug)
  localStorage.setItem(localStorageKey, JSON.stringify([...visited]))
}

type TweenNode = {
  update: (time: number) => void
  stop: () => void
}

async function renderGraph(graph: HTMLElement, fullSlug: FullSlug) {
  const slug = simplifySlug(fullSlug)
  const visited = getVisited()
  removeAllChildren(graph)
  const graphElement = graph as GraphElement
  graphElement.__graphHandle = undefined

  let {
    drag: enableDrag,
    zoom: enableZoom,
    depth,
    scale,
    autoZoom,
    repelForce,
    centerForce,
    linkDistance,
    fontSize,
  opacityScale,
    labelVisibility,
    removeTags,
    showTags,
    focusOnHover,
    enableRadial,
  } = JSON.parse(graph.dataset["cfg"]!) as D3Config

  opacityScale = Number.isFinite(opacityScale) && opacityScale > 0 ? opacityScale : 1
  fontSize = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 0.6

  const resolvedLabelVisibility = (() => {
    const defaults = {
      minAlpha: 0,
      maxAlpha: 1,
      startZoom: 1,
      endZoom: 3.75,
    }

    if (!labelVisibility) {
      return defaults
    }

    const minAlpha = Number.isFinite(labelVisibility.minAlpha) ? labelVisibility.minAlpha : defaults.minAlpha
    const maxAlpha = Number.isFinite(labelVisibility.maxAlpha) ? labelVisibility.maxAlpha : defaults.maxAlpha
    const startZoom = Number.isFinite(labelVisibility.startZoom)
      ? labelVisibility.startZoom
      : defaults.startZoom
    const endZoom = Number.isFinite(labelVisibility.endZoom) ? labelVisibility.endZoom : defaults.endZoom

    const orderedMin = Math.max(0, Math.min(1, minAlpha))
    const orderedMax = Math.max(orderedMin, Math.min(1, maxAlpha))
    const orderedStart = Math.max(0.01, startZoom)
    const orderedEnd = Math.max(orderedStart + 0.01, endZoom)

    return {
      minAlpha: orderedMin,
      maxAlpha: orderedMax,
      startZoom: orderedStart,
      endZoom: orderedEnd,
    }
  })()

  const data: Map<SimpleSlug, SerializedContentDetails> = new Map(
    Object.entries<SerializedContentDetails>(await fetchData).map(([k, v]) => [
      simplifySlug(k as FullSlug),
      v,
    ]),
  )
  const links: SimpleLinkData[] = []
  const tags: SimpleSlug[] = []
  const validLinks = new Set(data.keys())

  const tweens = new Map<string, TweenNode>()
  for (const [source, details] of data.entries()) {
    const outgoing = details.links ?? []

    for (const dest of outgoing) {
      if (validLinks.has(dest)) {
        links.push({ source: source, target: dest })
      }
    }

    if (showTags) {
      const localTags = details.tags
        .filter((tag) => !removeTags.includes(tag))
        .map((tag) => simplifySlug(("tags/" + tag) as FullSlug))

      tags.push(...localTags.filter((tag) => !tags.includes(tag)))

      for (const tag of localTags) {
        links.push({ source: source, target: tag })
      }
    }
  }

  const neighbourhood = new Set<SimpleSlug>()
  const wl: (SimpleSlug | "__SENTINEL")[] = [slug, "__SENTINEL"]
  if (depth >= 0) {
    while (depth >= 0 && wl.length > 0) {
      // compute neighbours
      const cur = wl.shift()!
      if (cur === "__SENTINEL") {
        depth--
        wl.push("__SENTINEL")
      } else {
        neighbourhood.add(cur)
        const outgoing = links.filter((l) => l.source === cur)
        const incoming = links.filter((l) => l.target === cur)
        wl.push(...outgoing.map((l) => l.target), ...incoming.map((l) => l.source))
      }
    }
  } else {
    validLinks.forEach((id) => neighbourhood.add(id))
    if (showTags) tags.forEach((tag) => neighbourhood.add(tag))
  }

  const nodes = [...neighbourhood].map((url) => {
    const text = url.startsWith("tags/") ? "#" + url.substring(5) : (data.get(url)?.title ?? url)
    return {
      id: url,
      text,
      tags: data.get(url)?.tags ?? [],
    }
  })
  const graphData: { nodes: NodeData[]; links: LinkData[] } = {
    nodes,
    links: links
      .filter((l) => neighbourhood.has(l.source) && neighbourhood.has(l.target))
      .map((l) => ({
        source: nodes.find((n) => n.id === l.source)!,
        target: nodes.find((n) => n.id === l.target)!,
      })),
  }

  if (autoZoom?.enabled) {
    const levels = autoZoom.zoomLevels ?? {}
    const nodeCount = graphData.nodes.length

    const resolvedScale = (() => {
      if (nodeCount <= 1 && levels.nodes1 !== undefined) return levels.nodes1
      if (nodeCount <= 2 && levels.nodes2 !== undefined) return levels.nodes2
      if (nodeCount <= 3 && levels.nodes3 !== undefined) return levels.nodes3
      if (nodeCount <= 4 && levels.nodes4 !== undefined) return levels.nodes4
      if (nodeCount <= 5 && levels.nodes5 !== undefined) return levels.nodes5
      if (nodeCount <= 6 && levels.nodes6 !== undefined) return levels.nodes6
      if (nodeCount <= 9 && levels.nodes7to9 !== undefined) return levels.nodes7to9
      if (nodeCount <= 15 && levels.nodes10to15 !== undefined) return levels.nodes10to15
      if (nodeCount <= 25 && levels.nodes15to25 !== undefined) return levels.nodes15to25
      if (levels.nodesAbove25 !== undefined) return levels.nodesAbove25
      return undefined
    })()

    if (resolvedScale !== undefined) {
      scale = resolvedScale
    }
  }

  const width = graph.offsetWidth
  const height = Math.max(graph.offsetHeight, 250)

  const computeCanvasCenterFromNodes = (nodes: NodeData[]) => {
    const positions = nodes
      .map((node) => {
        if (typeof node.x !== "number" || typeof node.y !== "number") {
          return undefined
        }

        return {
          x: node.x + width / 2,
          y: node.y + height / 2,
        }
      })
      .filter((pos): pos is { x: number; y: number } => pos !== undefined)

    if (positions.length === 0) {
      return {
        x: width / 2,
        y: height / 2,
      }
    }

    const minX = Math.min(...positions.map((p) => p.x))
    const maxX = Math.max(...positions.map((p) => p.x))
    const minY = Math.min(...positions.map((p) => p.y))
    const maxY = Math.max(...positions.map((p) => p.y))
    return {
      x: (minX + maxX) / 2,
      y: (minY + maxY) / 2,
    }
  }

  const linkCountMap = new Map<SimpleSlug, number>()
  for (const node of graphData.nodes) {
    linkCountMap.set(node.id, 0)
  }

  for (const link of graphData.links) {
    linkCountMap.set(link.source.id, (linkCountMap.get(link.source.id) ?? 0) + 1)
    linkCountMap.set(link.target.id, (linkCountMap.get(link.target.id) ?? 0) + 1)
  }

  const nodeRadius = (d: NodeData) => 2 + Math.sqrt(linkCountMap.get(d.id) ?? 0)

  // we virtualize the simulation and use pixi to actually render it
  const clampForceValue = (key: GraphControlKey, value: number, fallback: number): number => {
    if (!Number.isFinite(value)) {
      return fallback
    }

    const limits = FORCE_LIMITS[key]
    if (!limits) {
      return value
    }

    const { min, max } = limits
    return Math.min(Math.max(value, min), max)
  }

  const defaultForceSettings: GraphForceSettings = {
    repelForce: clampForceValue("repelForce", repelForce, DEFAULT_FORCE_SETTINGS.repelForce),
    centerForce: clampForceValue("centerForce", centerForce, DEFAULT_FORCE_SETTINGS.centerForce),
    linkDistance: Number.isFinite(linkDistance)
      ? clampForceValue("linkDistance", linkDistance, DEFAULT_FORCE_SETTINGS.linkDistance)
      : DEFAULT_FORCE_SETTINGS.linkDistance,
  }

  const currentForceSettings: GraphForceSettings = { ...defaultForceSettings }

  const chargeForce = forceManyBody<NodeData>().strength(-100 * currentForceSettings.repelForce)
  const centerForceInstance = forceCenter().strength(currentForceSettings.centerForce)
  const linkForce = forceLink<NodeData, LinkData>(graphData.links).distance(currentForceSettings.linkDistance)

  const applyForceSettings = () => {
    chargeForce.strength(-100 * currentForceSettings.repelForce)
    centerForceInstance.strength(currentForceSettings.centerForce)
    linkForce.distance(currentForceSettings.linkDistance)
    simulation.alpha(0.85).restart()
  }

  const updateForceSettings = (settings: Partial<GraphForceSettings>) => {
    (Object.entries(settings) as [GraphControlKey, number | undefined][]).forEach(([key, value]) => {
      if (typeof value !== "number") {
        return
      }

      currentForceSettings[key] = clampForceValue(key, value, currentForceSettings[key])
    })

    applyForceSettings()
    return { ...currentForceSettings }
  }

  const resetForceSettings = () => {
    currentForceSettings.repelForce = defaultForceSettings.repelForce
    currentForceSettings.centerForce = defaultForceSettings.centerForce
    currentForceSettings.linkDistance = defaultForceSettings.linkDistance
    applyForceSettings()
    return { ...currentForceSettings }
  }

  const updateBooleanOptions = (settings: Partial<GraphBooleanOptions>) => {
    Object.entries(settings).forEach(([key, value]) => {
      if (typeof value !== "boolean") {
        return
      }

      const typedKey = key as keyof GraphBooleanOptions
      booleanOptions[typedKey] = value
    })

    applyBooleanOptions()
    return { ...booleanOptions }
  }

  const resetBooleanOptions = () => {
    booleanOptions.showSinglets = defaultBooleanOptions.showSinglets
    booleanOptions.highlightVisited = defaultBooleanOptions.highlightVisited
    booleanOptions.focusOnHover = defaultBooleanOptions.focusOnHover
    applyBooleanOptions()
    return { ...booleanOptions }
  }

  const getBooleanOptions = () => ({ ...booleanOptions })

  const simulation: Simulation<NodeData, LinkData> = forceSimulation<NodeData>(graphData.nodes)
    .force("charge", chargeForce)
    .force("center", centerForceInstance)
    .force("link", linkForce)
    .force("collide", forceCollide<NodeData>((n) => nodeRadius(n)).iterations(3))

  const warmupIterations = autoZoom?.enabled
    ? Math.min(120, Math.max(24, graphData.nodes.length * 8))
    : 24
  for (let i = 0; i < warmupIterations; i++) {
    simulation.tick()
  }
  simulation.alpha(0.8).restart()

  const radius = (Math.min(width, height) / 2) * 0.8
  if (enableRadial) simulation.force("radial", forceRadial(radius).strength(0.2))

  // precompute style prop strings as pixi doesn't support css variables
  const cssVars = [
    "--light",
    "--color-accent-bright",
    "--color-accent-deep",
    "--color-accent-shadow",
    "--color-accent-shadow-light",
    "--color-tone-subtle",
    "--color-tone-contrast",
    "--color-tone-primary",
    "--color-tone-muted",
    "--bodyFont",
  ] as const
  const computedStyleMap = cssVars.reduce(
    (acc, key) => {
      acc[key] = getComputedStyle(document.documentElement).getPropertyValue(key)
      return acc
    },
    {} as Record<(typeof cssVars)[number], string>,
  )

  const parseColorToNumber = (value: string): number => {
    const trimmed = value.trim()
    if (!trimmed) {
      return 0xffffff
    }

    if (trimmed.startsWith("#")) {
      const hex = trimmed.slice(1).replace(/[^0-9a-fA-F]/g, "")
      const normalized = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.padEnd(6, "0")
      return Number.parseInt(normalized.slice(0, 6), 16)
    }

    const rgbMatch = trimmed.match(/rgba?\(([^)]+)\)/)
    if (rgbMatch) {
      const [r, g, b] = rgbMatch[1]
        .split(/,\s*/)
        .slice(0, 3)
        .map((segment) => Number.parseInt(segment, 10))
      const safe = (component: number) => Math.max(0, Math.min(255, Number.isFinite(component) ? component : 255))
      return (safe(r) << 16) + (safe(g) << 8) + safe(b)
    }

    return 0xffffff
  }

  const defaultBooleanOptions: GraphBooleanOptions = {
    ...DEFAULT_BOOLEAN_OPTIONS,
    focusOnHover: focusOnHover !== false,
  }

  const booleanOptions: GraphBooleanOptions = { ...defaultBooleanOptions }

  const getNodeTone = (degree: number) => {
    if (degree >= 6) {
      return computedStyleMap["--color-accent-bright"]
    }

    if (degree >= 3) {
      return computedStyleMap["--color-accent-deep"]
    }

    return computedStyleMap["--color-accent-shadow-light"]
  }

  const color = (d: NodeData) => {
    if (d.id === slug) {
      return computedStyleMap["--color-accent-bright"]
    }

    if (booleanOptions.highlightVisited && visited.has(d.id)) {
      return computedStyleMap["--color-accent-deep"]
    }

    const degree = linkCountMap.get(d.id) ?? 0
    return getNodeTone(degree)
  }

  const nodeRenderMap = new Map<SimpleSlug, NodeRenderData>()

  const drawNodeGraphic = (node: NodeRenderData) => {
    const tone = parseColorToNumber(color(node.simulationData))
    const radiusSize = nodeRadius(node.simulationData)
    const isTagNode = node.simulationData.id.startsWith("tags/")

    node.gfx.clear()
    node.gfx.circle(0, 0, radiusSize).fill({ color: tone })
    if (isTagNode) {
      node.gfx.stroke({ width: 2, color: parseColorToNumber(computedStyleMap["--color-accent-deep"]) })
    }

    node.gfx.alpha = node.visible ? 1 : 0
    node.gfx.visible = node.visible
    node.gfx.eventMode = node.visible ? "static" : "none"
    node.label.visible = node.visible
    if (!node.visible) {
      node.label.alpha = 0
    }
  }

  const applyBooleanOptions = () => {
    const showSinglets = booleanOptions.showSinglets

    nodeRenderData.forEach((node) => {
      node.visible = showSinglets || !node.singlet
      if (!node.visible && hoveredNodeId === node.simulationData.id) {
        updateHoverInfo(null)
      }
      drawNodeGraphic(node)
    })

    linkRenderData.forEach((link) => {
      const sourceNode = nodeRenderMap.get(link.simulationData.source.id)
      const targetNode = nodeRenderMap.get(link.simulationData.target.id)
      const bothVisible = Boolean(sourceNode?.visible && targetNode?.visible)
      link.visible = bothVisible
      link.gfx.visible = bothVisible
    })

    renderPixiFromD3()
  }

  let hoveredNodeId: string | null = null
  let hoveredNeighbours: Set<string> = new Set()
  const linkRenderData: LinkRenderData[] = []
  const nodeRenderData: NodeRenderData[] = []
  function updateHoverInfo(newHoveredId: string | null) {
    const hoveredNode = newHoveredId ? nodeRenderMap.get(newHoveredId as SimpleSlug) : undefined
    if (newHoveredId && !hoveredNode?.visible) {
      newHoveredId = null
    }

    hoveredNodeId = newHoveredId

    if (newHoveredId === null) {
      hoveredNeighbours = new Set()
      for (const n of nodeRenderData) {
        n.active = false
      }

      for (const l of linkRenderData) {
        l.active = false
      }
    } else {
      hoveredNeighbours = new Set()
      for (const l of linkRenderData) {
        const linkData = l.simulationData
        if (linkData.source.id === newHoveredId || linkData.target.id === newHoveredId) {
          hoveredNeighbours.add(linkData.source.id)
          hoveredNeighbours.add(linkData.target.id)
        }

        l.active = linkData.source.id === newHoveredId || linkData.target.id === newHoveredId
      }

      for (const n of nodeRenderData) {
        n.active = hoveredNeighbours.has(n.simulationData.id)
      }
    }
  }

  let dragStartTime = 0
  let dragging = false
  let remainingAutoRecenters = autoZoom?.enabled
    ? graphData.nodes.length <= 6
      ? 5
      : 2
    : 0

  function renderLinks() {
    tweens.get("link")?.stop()
    const tweenGroup = new TweenGroup()

    for (const l of linkRenderData) {
      if (!l.visible) {
        l.gfx.visible = false
        continue
      }

      l.gfx.visible = true
      let alpha = 1

      // if we are hovering over a node, we want to highlight the immediate neighbours
      // with full alpha and the rest with default alpha
      if (hoveredNodeId) {
        alpha = l.active ? 1 : 0.2
      }

  const edgeColor = computedStyleMap["--color-tone-subtle"]
  l.color = edgeColor
      tweenGroup.add(new Tweened<LinkRenderData>(l).to({ alpha }, 200))
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("link", {
      update: tweenGroup.update.bind(tweenGroup),
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
      },
    })
  }

  function renderLabels() {
    tweens.get("label")?.stop()
    const tweenGroup = new TweenGroup()

    const defaultScale = 1 / scale
    const activeScale = defaultScale * 1.1
    for (const n of nodeRenderData) {
      if (!n.visible) {
        n.label.visible = false
        continue
      }

      n.label.visible = true
      const nodeId = n.simulationData.id

      if (hoveredNodeId === nodeId) {
        tweenGroup.add(
          new Tweened<Text>(n.label).to(
            {
              alpha: 1,
              scale: { x: activeScale, y: activeScale },
            },
            100,
          ),
        )
      } else {
        tweenGroup.add(
          new Tweened<Text>(n.label).to(
            {
              alpha: n.label.alpha,
              scale: { x: defaultScale, y: defaultScale },
            },
            100,
          ),
        )
      }
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("label", {
      update: tweenGroup.update.bind(tweenGroup),
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
      },
    })
  }

  function renderNodes() {
    tweens.get("hover")?.stop()

    const tweenGroup = new TweenGroup()
    for (const n of nodeRenderData) {
      if (!n.visible) {
        n.gfx.visible = false
        n.gfx.alpha = 0
        continue
      }

      n.gfx.visible = true
      let alpha = 1

      // if we are hovering over a node, we want to highlight the immediate neighbours
      if (hoveredNodeId !== null && booleanOptions.focusOnHover) {
        alpha = n.active ? 1 : 0.2
      }

      tweenGroup.add(new Tweened<Graphics>(n.gfx, tweenGroup).to({ alpha }, 200))
    }

    tweenGroup.getAll().forEach((tw) => tw.start())
    tweens.set("hover", {
      update: tweenGroup.update.bind(tweenGroup),
      stop() {
        tweenGroup.getAll().forEach((tw) => tw.stop())
      },
    })
  }

  function renderPixiFromD3() {
    renderNodes()
    renderLinks()
    renderLabels()
  }

  tweens.forEach((tween) => tween.stop())
  tweens.clear()

  const app = new Application()
  await app.init({
    width,
    height,
    antialias: true,
    autoStart: false,
    autoDensity: true,
    backgroundAlpha: 0,
    preference: "webgpu",
    resolution: window.devicePixelRatio,
    eventMode: "static",
  })
  graph.appendChild(app.canvas)

  const stage = app.stage
  stage.interactive = false

  const labelsContainer = new Container<Text>({ zIndex: 3, isRenderGroup: true })
  const nodesContainer = new Container<Graphics>({ zIndex: 2, isRenderGroup: true })
  const linkContainer = new Container<Graphics>({ zIndex: 1, isRenderGroup: true })
  stage.addChild(nodesContainer, labelsContainer, linkContainer)

  const clamp01 = (value: number) => Math.min(Math.max(value, 0), 1)

  const updateLabelVisibility = (transform: ZoomTransform) => {
    const scaleValue = transform.k * opacityScale
    const { minAlpha, maxAlpha, startZoom, endZoom } = resolvedLabelVisibility
    const span = Math.max(endZoom - startZoom, 0.01)
    const normalized = clamp01((scaleValue - startZoom) / span)
    const targetAlpha = minAlpha + (maxAlpha - minAlpha) * normalized
    const activeNodes = nodeRenderData.filter((n) => n.active).flatMap((n) => n.label)

    for (const label of labelsContainer.children) {
      if (!activeNodes.includes(label)) {
        label.alpha = targetAlpha
      }
    }
  }

  const baseZoom = Math.max(scale ?? 1, 0.1)
  const zoomPadding = autoZoom?.enabled ? autoZoom.padding ?? 1.25 : 1.25
  const initialZoom = baseZoom * zoomPadding
  const createTransformForCenter = (scaleValue: number) => {
    const center = computeCanvasCenterFromNodes(graphData.nodes)
    return zoomIdentity
      .translate(width / 2 - scaleValue * center.x, height / 2 - scaleValue * center.y)
      .scale(scaleValue)
  }

  let currentTransform: ZoomTransform = createTransformForCenter(initialZoom)

  const applyTransform = (transform: ZoomTransform) => {
    currentTransform = transform
    stage.scale.set(transform.k, transform.k)
    stage.position.set(transform.x, transform.y)
  }

  applyTransform(currentTransform)

  let zoomBehavior: ReturnType<typeof zoom<HTMLCanvasElement, NodeData>> | undefined
  let canvasSelection: ReturnType<typeof select<HTMLCanvasElement, NodeData>> | undefined
  let suppressZoomHandler = false
  let pendingTransform: ZoomTransform | null = null

  const zoomStep = (direction: "in" | "out") => {
    if (!enableZoom || !canvasSelection || !zoomBehavior) {
      return
    }

    const factor = direction === "in" ? 1.2 : 1 / 1.2
    canvasSelection.call(zoomBehavior.scaleBy, factor)
  }

  const syncTransform = (transform: ZoomTransform) => {
    applyTransform(transform)
    updateLabelVisibility(transform)
    if (!enableZoom) {
      return
    }

    if (!canvasSelection || !zoomBehavior) {
      pendingTransform = transform
      return
    }

    suppressZoomHandler = true
    canvasSelection.call(zoomBehavior.transform, transform)
    suppressZoomHandler = false
  }

  for (const n of graphData.nodes) {
    const nodeId = n.id

    const label = new Text({
      interactive: false,
      eventMode: "none",
      text: n.text,
      alpha: resolvedLabelVisibility.minAlpha,
      anchor: { x: 0.5, y: 1.2 },
      style: {
        fontSize: fontSize * 15,
  fill: computedStyleMap["--color-tone-contrast"],
        fontFamily: computedStyleMap["--bodyFont"],
      },
      resolution: window.devicePixelRatio * 4,
    })
    label.scale.set(1 / scale)

    let oldLabelOpacity = 0
    const isTagNode = nodeId.startsWith("tags/")
    const degree = linkCountMap.get(nodeId) ?? 0
    const isSinglet = degree <= 1
    const initiallyVisible = booleanOptions.showSinglets || !isSinglet
    const gfx = new Graphics({
      interactive: true,
      label: nodeId,
      eventMode: "static",
      hitArea: new Circle(0, 0, nodeRadius(n)),
      cursor: "pointer",
    })
      .on("pointerover", (e) => {
        updateHoverInfo(e.target.label)
        oldLabelOpacity = label.alpha
        if (!dragging) {
          renderPixiFromD3()
        }
      })
      .on("pointerleave", () => {
        updateHoverInfo(null)
        label.alpha = oldLabelOpacity
        if (!dragging) {
          renderPixiFromD3()
        }
      })

    if (isTagNode) {
      gfx.stroke({ width: 2, color: computedStyleMap["--color-accent-deep"] })
    }

    nodesContainer.addChild(gfx)
    labelsContainer.addChild(label)

    const nodeRenderDatum: NodeRenderData = {
      simulationData: n,
      gfx,
      label,
      color: color(n),
      alpha: 1,
      active: false,
      visible: initiallyVisible,
      singlet: isSinglet,
    }

    drawNodeGraphic(nodeRenderDatum)
    nodeRenderDatum.gfx.eventMode = initiallyVisible ? "static" : "none"
    nodeRenderDatum.label.visible = initiallyVisible
    label.alpha = initiallyVisible ? label.alpha : 0

    nodeRenderMap.set(nodeId, nodeRenderDatum)
    nodeRenderData.push(nodeRenderDatum)
  }

  for (const l of graphData.links) {
    const gfx = new Graphics({ interactive: false, eventMode: "none" })
    linkContainer.addChild(gfx)
    const sourceNode = nodeRenderMap.get(l.source.id)
    const targetNode = nodeRenderMap.get(l.target.id)
    const linkVisible = Boolean(sourceNode?.visible && targetNode?.visible)

    const linkRenderDatum: LinkRenderData = {
      simulationData: l,
      gfx,
      color: computedStyleMap["--color-tone-subtle"],
      alpha: 1,
      active: false,
      visible: linkVisible,
    }

    linkRenderDatum.gfx.visible = linkVisible
    linkRenderData.push(linkRenderDatum)
  }

  applyBooleanOptions()

  if (enableDrag) {
    select<HTMLCanvasElement, NodeData | undefined>(app.canvas).call(
      drag<HTMLCanvasElement, NodeData | undefined>()
        .container(() => app.canvas)
        .subject(() => graphData.nodes.find((n) => n.id === hoveredNodeId))
        .on("start", function dragstarted(event) {
          if (!event.active) simulation.alphaTarget(1).restart()
          event.subject.fx = event.subject.x
          event.subject.fy = event.subject.y
          event.subject.__initialDragPos = {
            x: event.subject.x,
            y: event.subject.y,
            fx: event.subject.fx,
            fy: event.subject.fy,
          }
          dragStartTime = Date.now()
          dragging = true
        })
        .on("drag", function dragged(event) {
          const initPos = event.subject.__initialDragPos
          event.subject.fx = initPos.x + (event.x - initPos.x) / currentTransform.k
          event.subject.fy = initPos.y + (event.y - initPos.y) / currentTransform.k
        })
        .on("end", function dragended(event) {
          if (!event.active) simulation.alphaTarget(0)
          event.subject.fx = null
          event.subject.fy = null
          dragging = false

          // if the time between mousedown and mouseup is short, we consider it a click
          if (Date.now() - dragStartTime < 500) {
            const node = graphData.nodes.find((n) => n.id === event.subject.id) as NodeData
            const targ = resolveRelative(fullSlug, node.id)
            window.spaNavigate(new URL(targ, window.location.toString()))
          }
        }),
    )
  } else {
    for (const node of nodeRenderData) {
      node.gfx.on("click", () => {
        const targ = resolveRelative(fullSlug, node.simulationData.id)
        window.spaNavigate(new URL(targ, window.location.toString()))
      })
    }
  }

  if (enableZoom) {
    zoomBehavior = zoom<HTMLCanvasElement, NodeData>()
      .extent([
        [0, 0],
        [width, height],
      ])
      .scaleExtent([0.25, 4])
      .on("zoom", ({ transform }) => {
        if (suppressZoomHandler) {
          return
        }

        applyTransform(transform)
        updateLabelVisibility(transform)
        remainingAutoRecenters = 0
      })

    canvasSelection = select<HTMLCanvasElement, NodeData>(app.canvas).call(zoomBehavior)

    const startingTransform = pendingTransform ?? currentTransform
    pendingTransform = null
    syncTransform(startingTransform)
  } else {
    applyTransform(currentTransform)
    updateLabelVisibility(currentTransform)
  }

  let stopAnimation = false
  function animate(time: number) {
    if (stopAnimation) return
    for (const n of nodeRenderData) {
      const { x, y } = n.simulationData
      if (!x || !y) continue
      n.gfx.position.set(x + width / 2, y + height / 2)
      if (n.label) {
        n.label.position.set(x + width / 2, y + height / 2)
      }
    }

    for (const l of linkRenderData) {
      const linkData = l.simulationData
      if (!l.visible) {
        l.gfx.visible = false
        continue
      }

      l.gfx.visible = true
      l.gfx.clear()
      l.gfx.moveTo(linkData.source.x! + width / 2, linkData.source.y! + height / 2)
      l.gfx
        .lineTo(linkData.target.x! + width / 2, linkData.target.y! + height / 2)
        .stroke({ alpha: l.alpha, width: 1, color: l.color })
    }

    if (remainingAutoRecenters > 0) {
      const centredTransform = createTransformForCenter(currentTransform.k)
      syncTransform(centredTransform)
      remainingAutoRecenters--
    }

    tweens.forEach((t) => t.update(time))
    app.renderer.render(stage)
    requestAnimationFrame(animate)
  }

  requestAnimationFrame(animate)
  graphElement.__graphHandle = {
    getForceSettings: () => ({ ...currentForceSettings }),
    getDefaultForceSettings: () => ({ ...defaultForceSettings }),
    updateForceSettings,
    resetForceSettings,
    getBooleanOptions,
    updateBooleanOptions,
    resetBooleanOptions,
    zoomBy: zoomStep,
  }
  return () => {
    stopAnimation = true
    delete graphElement.__graphHandle
    app.destroy()
  }
}

let localGraphCleanups: (() => void)[] = []
let globalGraphCleanups: (() => void)[] = []

const graphTeleportState = new WeakMap<
  HTMLElement,
  {
    parent: Node
    placeholder: Comment
  }
>()

function moveGraphToBody(container: HTMLElement) {
  if (container.parentElement === document.body) {
    return
  }

  const parent = container.parentNode
  if (!parent) {
    return
  }

  const placeholder = document.createComment("global-graph-home")
  parent.insertBefore(placeholder, container)
  graphTeleportState.set(container, { parent, placeholder })
  document.body.appendChild(container)
}

function restoreGraph(container: HTMLElement) {
  const state = graphTeleportState.get(container)
  if (!state) {
    return
  }

  const { parent, placeholder } = state
  if (parent.isConnected) {
    parent.insertBefore(container, placeholder)
  }

  placeholder.remove()
  graphTeleportState.delete(container)
}

const formatForceValue = (key: GraphControlKey, value: number): string => {
  if (!Number.isFinite(value)) {
    return "—"
  }

  switch (key) {
    case "linkDistance":
      return `${Math.round(value)} px`
    case "repelForce":
    case "centerForce":
    default:
      return value.toFixed(2)
  }
}

const setupGlobalGraphControls = (container: HTMLElement, graphElement: GraphElement) => {
  const controls = container.querySelector<HTMLElement>('[data-graph-controls]')
  if (!controls) {
    return () => {}
  }

  const handle = graphElement.__graphHandle
  if (!handle) {
    return () => {}
  }

  const sliderElements = Array.from(
    controls.querySelectorAll<HTMLInputElement>('[data-graph-slider]'),
  )
  const toggleElements = Array.from(
    controls.querySelectorAll<HTMLInputElement>('[data-graph-toggle]'),
  )

  const cleanupFns: Array<() => void> = []

  const syncUI = (
    settings?: GraphForceSettings,
    booleanSettings?: GraphBooleanOptions,
  ) => {
    const forceSettings = settings ?? handle.getForceSettings()
    const boolSettings = booleanSettings ?? handle.getBooleanOptions()

    sliderElements.forEach((input) => {
      const key = input.dataset.graphSlider as GraphControlKey | undefined
      if (!key) {
        return
      }

      const value = forceSettings[key]
      if (typeof value !== "number" || Number.isNaN(value)) {
        return
      }

      input.value = value.toString()
      input.setAttribute("aria-valuenow", value.toString())

      const display = controls.querySelector(`[data-graph-value="${key}"]`)
      if (display) {
        display.textContent = formatForceValue(key, value)
      }
    })

    toggleElements.forEach((input) => {
      const key = input.dataset.graphToggle as keyof GraphBooleanOptions | undefined
      if (!key) {
        return
      }

      const value = boolSettings[key]
      input.checked = Boolean(value)
    })
  }

  syncUI(handle.getForceSettings(), handle.getBooleanOptions())

  sliderElements.forEach((input) => {
    const key = input.dataset.graphSlider as GraphControlKey | undefined
    if (!key) {
      return
    }

    const updateFromEvent = (event: Event) => {
      const target = event.currentTarget as HTMLInputElement
      const nextValue = Number.parseFloat(target.value)
      const updated = handle.updateForceSettings({ [key]: nextValue })
      syncUI(updated, handle.getBooleanOptions())
    }

    input.addEventListener("input", updateFromEvent)
    input.addEventListener("change", updateFromEvent)
    cleanupFns.push(() => {
      input.removeEventListener("input", updateFromEvent)
      input.removeEventListener("change", updateFromEvent)
    })
  })

  toggleElements.forEach((input) => {
    const key = input.dataset.graphToggle as keyof GraphBooleanOptions | undefined
    if (!key) {
      return
    }

    const handleToggle = (event: Event) => {
      const target = event.currentTarget as HTMLInputElement
      const booleanState = handle.updateBooleanOptions({ [key]: target.checked })
      syncUI(undefined, booleanState)
    }

    input.addEventListener("change", handleToggle)
    cleanupFns.push(() => {
      input.removeEventListener("change", handleToggle)
    })
  })

  const resetButton = controls.querySelector<HTMLButtonElement>('[data-graph-reset]')
  if (resetButton) {
    const handleReset = () => {
      const settings = handle.resetForceSettings()
      const boolState = handle.resetBooleanOptions()
      syncUI(settings, boolState)
    }

    resetButton.addEventListener("click", handleReset)
    cleanupFns.push(() => resetButton.removeEventListener("click", handleReset))
  }

  return () => {
    cleanupFns.forEach((fn) => fn())
  }
}

const setupZoomControls = (container: HTMLElement, graphElement: GraphElement) => {
  const zoomControls = container.querySelector<HTMLElement>('[data-graph-zoom-controls]')
  if (!zoomControls) {
    return () => {}
  }

  const handle = graphElement.__graphHandle
  if (!handle) {
    return () => {}
  }

  const buttons = Array.from(
    zoomControls.querySelectorAll<HTMLButtonElement>('[data-graph-zoom]'),
  )

  const cleanupFns: Array<() => void> = []

  buttons.forEach((button) => {
    const direction = button.dataset.graphZoom === "in" ? "in" : button.dataset.graphZoom === "out" ? "out" : undefined
    if (!direction) {
      return
    }

    const handleClick = (event: Event) => {
      event.preventDefault()
      handle.zoomBy(direction)
    }

    button.addEventListener("click", handleClick)
    cleanupFns.push(() => button.removeEventListener("click", handleClick))
  })

  return () => {
    cleanupFns.forEach((fn) => fn())
  }
}

function cleanupLocalGraphs() {
  for (const cleanup of localGraphCleanups) {
    cleanup()
  }
  localGraphCleanups = []
}

function cleanupGlobalGraphs() {
  for (const cleanup of globalGraphCleanups) {
    cleanup()
  }
  globalGraphCleanups = []
}

document.addEventListener("nav", async (e: CustomEventMap["nav"]) => {
  const slug = e.detail.url
  addToVisited(simplifySlug(slug))

  async function renderLocalGraph() {
    cleanupLocalGraphs()
    const localGraphContainers = document.getElementsByClassName("graph-container")
    for (const container of localGraphContainers) {
      localGraphCleanups.push(await renderGraph(container as HTMLElement, slug))
    }
  }

  await renderLocalGraph()
  const handleThemeChange = () => {
    void renderLocalGraph()
  }

  document.addEventListener("themechange", handleThemeChange)
  window.addCleanup(() => {
    document.removeEventListener("themechange", handleThemeChange)
  })

  const containers = [...document.getElementsByClassName("global-graph-outer")] as HTMLElement[]
  async function renderGlobalGraph() {
    const slug = getFullSlug(window)
    document.body.classList.add("graph-modal-active")
    for (const container of containers) {
      moveGraphToBody(container)
      container.classList.add("active")

      const graphContainer = container.querySelector(".global-graph-container") as GraphElement | null
      registerEscapeHandler(container, hideGlobalGraph)
      if (graphContainer) {
        const localCleanupFns: Array<() => void> = []
        const graphCleanup = await renderGraph(graphContainer, slug)
        localCleanupFns.push(graphCleanup)

        const controlsCleanup = setupGlobalGraphControls(container, graphContainer)
        if (controlsCleanup) {
          localCleanupFns.push(controlsCleanup)
        }

        const zoomCleanup = setupZoomControls(container, graphContainer)
        if (zoomCleanup) {
          localCleanupFns.push(zoomCleanup)
        }

        const closeButton = container.querySelector<HTMLElement>("[data-graph-close]")
        if (closeButton) {
          const closeHandler = (event: Event) => {
            event.preventDefault()
            hideGlobalGraph()
          }

          closeButton.addEventListener("click", closeHandler)
          localCleanupFns.push(() => closeButton.removeEventListener("click", closeHandler))
        }

        globalGraphCleanups.push(() => {
          for (let i = localCleanupFns.length - 1; i >= 0; i--) {
            localCleanupFns[i]()
          }
        })
      }
    }
  }

  function hideGlobalGraph() {
    cleanupGlobalGraphs()
    document.body.classList.remove("graph-modal-active")
    for (const container of containers) {
      container.classList.remove("active")
      restoreGraph(container)
    }
  }

  async function shortcutHandler(e: HTMLElementEventMap["keydown"]) {
    if (e.key === "g" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      e.preventDefault()
      const anyGlobalGraphOpen = containers.some((container) =>
        container.classList.contains("active"),
      )
      anyGlobalGraphOpen ? hideGlobalGraph() : renderGlobalGraph()
    }
  }

  const triggerElements = document.querySelectorAll(
    ".global-graph-icon, .graph__show-full",
  ) as NodeListOf<HTMLElement>
  triggerElements.forEach((trigger) => {
    trigger.addEventListener("click", renderGlobalGraph)
    window.addCleanup(() => trigger.removeEventListener("click", renderGlobalGraph))
  })

  document.addEventListener("keydown", shortcutHandler)
  window.addCleanup(() => {
    document.removeEventListener("keydown", shortcutHandler)
    cleanupLocalGraphs()
    hideGlobalGraph()
  })
})
