import { QuartzComponent, QuartzComponentConstructor, QuartzComponentProps } from "./types"
// @ts-ignore
import script from "./scripts/graph.inline"
import style from "./styles/graph.scss"
import { i18n } from "../i18n"
import { classNames } from "../util/lang"

export interface LabelVisibilityConfig {
  minAlpha: number
  maxAlpha: number
  startZoom: number
  endZoom: number
}

export interface D3Config {
  drag: boolean
  zoom: boolean
  depth: number
  scale: number
  autoZoom?: {
    enabled: boolean
    padding: number
    zoomLevels: {
      nodes1?: number
      nodes2?: number
      nodes3?: number
      nodes4?: number
      nodes5?: number
      nodes6?: number
      nodes7to9?: number
      nodes10to15?: number
      nodes15to25?: number
      nodesAbove25?: number
    }
  }
  repelForce: number
  centerForce: number
  linkDistance: number
  fontSize: number
  opacityScale: number
  labelVisibility?: LabelVisibilityConfig
  removeTags: string[]
  showTags: boolean
  focusOnHover?: boolean
  enableRadial?: boolean
}

interface GraphOptions {
  localGraph: Partial<D3Config> | undefined
  globalGraph: Partial<D3Config> | undefined
}

// Tweak these defaults to tune the graph label sizing/visibility and layout forces.
const defaultOptions: GraphOptions = {
  localGraph: {
    drag: true,
    zoom: true,
    depth: 1,
    scale: 1.1,
    autoZoom: {
      enabled: true,
      padding: 1.2,
      zoomLevels: {
        nodes1: 6,
        nodes2: 5,
        nodes3: 3.5,
        nodes4: 3.0,
        nodes5: 2.7,
        nodes6: 2.4,
        nodes7to9: 2.1,
        nodes10to15: 1.7,
        nodes15to25: 1.2,
        nodesAbove25: 1.0,
      },
    },
    repelForce: 0.5,
    centerForce: 0.3,
    linkDistance: 30,
    fontSize: 0.8,
    opacityScale: 1.6,
    labelVisibility: {
      minAlpha: 0.05,
      maxAlpha: 1,
      startZoom: 1,
      endZoom: 2.9,
    },
    showTags: true,
    removeTags: [],
    focusOnHover: false,
    enableRadial: false,
  },
  globalGraph: {
    drag: true,
    zoom: true,
    depth: -1,
    scale: 0.9,
    autoZoom: {
      enabled: true,
      padding: 1.15,
      zoomLevels: {
        nodes1: 2.4,
        nodes2: 2.2,
        nodes3: 2,
        nodes4: 1.85,
        nodes5: 1.75,
        nodes6: 1.65,
        nodes7to9: 1.5,
        nodes10to15: 1.2,
        nodes15to25: 1,
        nodesAbove25: 0.85,
      },
    },
    repelForce: 0.5,
    centerForce: 0.2,
    linkDistance: 30,
    fontSize: 0.75,
    opacityScale: 1.4,
    labelVisibility: {
      minAlpha: 0.2,
      maxAlpha: 1,
      startZoom: 0.9,
      endZoom: 2.4,
    },
    showTags: true,
    removeTags: [],
    focusOnHover: true,
    enableRadial: true,
  },
}

export default ((opts?: Partial<GraphOptions>) => {
  const Graph: QuartzComponent = ({ displayClass, cfg }: QuartzComponentProps) => {
    const localGraph = { ...defaultOptions.localGraph, ...opts?.localGraph }
    const globalGraph = { ...defaultOptions.globalGraph, ...opts?.globalGraph }
    const controlDefaults: Record<"repelForce" | "centerForce" | "linkDistance", number> = {
      repelForce: globalGraph.repelForce ?? 0.5,
      centerForce: globalGraph.centerForce ?? 0.2,
      linkDistance: globalGraph.linkDistance ?? 30,
    }

    return (
      <div class={classNames(displayClass, "graph")}>
        <div
          class="graph__heading-row"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}
        >
          <h3>{i18n(cfg.locale).components.graph.title}</h3>
          <button class="graph__show-full" type="button">
            SHOW FULL GRAPH
          </button>
        </div>
        <div class="graph-outer">
          <div class="graph-container" data-cfg={JSON.stringify(localGraph)}></div>
        </div>
        <div
          class="global-graph-outer"
          role="dialog"
          aria-modal="true"
          aria-label="Full graph preview"
        >
          <div class="global-graph-content">
            <aside class="global-graph-controls" data-graph-controls>
              <div class="graph-controls__header">
                <h4 class="graph-controls__title">Graph Controls</h4>
                <button
                  class="graph-controls__close"
                  type="button"
                  data-graph-close
                  aria-label="Close full graph"
                >
                  <span aria-hidden="true">&times;</span>
                </button>
              </div>
              <div class="graph-controls__body">
                <label class="graph-control" for="graph-slider-repel">
                  <span class="graph-control__label">Repel Force</span>
                  <div class="graph-control__range">
                    <input
                      class="graph-control__slider"
                      type="range"
                      min="0.1"
                      max="2"
                      step="0.05"
                      id="graph-slider-repel"
                      value={controlDefaults.repelForce.toString()}
                      data-graph-slider="repelForce"
                      aria-label="Repel force"
                    />
                    <span class="graph-control__value" data-graph-value="repelForce">
                      {controlDefaults.repelForce.toFixed(2)}
                    </span>
                  </div>
                </label>
                <label class="graph-control" for="graph-slider-center">
                  <span class="graph-control__label">Center Force</span>
                  <div class="graph-control__range">
                    <input
                      class="graph-control__slider"
                      type="range"
                      min="0"
                      max="2"
                      step="0.05"
                      id="graph-slider-center"
                      value={controlDefaults.centerForce.toString()}
                      data-graph-slider="centerForce"
                      aria-label="Center force"
                    />
                    <span class="graph-control__value" data-graph-value="centerForce">
                      {controlDefaults.centerForce.toFixed(2)}
                    </span>
                  </div>
                </label>
                <label class="graph-control" for="graph-slider-distance">
                  <span class="graph-control__label">Link Distance</span>
                  <div class="graph-control__range">
                    <input
                      class="graph-control__slider"
                      type="range"
                      min="12"
                      max="160"
                      step="2"
                      id="graph-slider-distance"
                      value={controlDefaults.linkDistance.toString()}
                      data-graph-slider="linkDistance"
                      aria-label="Link distance"
                    />
                    <span class="graph-control__value" data-graph-value="linkDistance">
                      {Math.round(controlDefaults.linkDistance)} px
                    </span>
                  </div>
                </label>
                <div class="graph-controls__toggles">
                  <label class="graph-toggle">
                    <input
                      type="checkbox"
                      class="graph-toggle__input"
                      data-graph-toggle="showSinglets"
                      defaultChecked
                    />
                    <span class="graph-toggle__label">Show singlets</span>
                  </label>
                  <label class="graph-toggle">
                    <input
                      type="checkbox"
                      class="graph-toggle__input"
                      data-graph-toggle="highlightVisited"
                      defaultChecked
                    />
                    <span class="graph-toggle__label">Highlight visited notes</span>
                  </label>
                  <label class="graph-toggle">
                    <input
                      type="checkbox"
                      class="graph-toggle__input"
                      data-graph-toggle="focusOnHover"
                      defaultChecked={globalGraph.focusOnHover !== false}
                    />
                    <span class="graph-toggle__label">Focus neighbors on hover</span>
                  </label>
                </div>
                <div class="graph-controls__info">
                  <p>
                    Adjust the layout forces or toggle visibility to explore clusters. Boost the center force to
                    pull everything inward, or crank up the repel force for a wider spread.
                  </p>
                </div>
              </div>
              <div class="graph-controls__footer">
                <button class="graph-controls__reset" type="button" data-graph-reset>
                  Reset Controls
                </button>
              </div>
            </aside>
            <div class="global-graph-stage">
              <div
                class="global-graph-container"
                data-cfg={JSON.stringify(globalGraph)}
                data-graph-mode="global"
              ></div>
              <div class="graph-zoom" data-graph-zoom-controls>
                <button type="button" class="graph-zoom__button" data-graph-zoom="in" aria-label="Zoom in">
                  +
                </button>
                <button type="button" class="graph-zoom__button" data-graph-zoom="out" aria-label="Zoom out">
                  &minus;
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  Graph.css = style
  Graph.afterDOMLoaded = script

  return Graph
}) satisfies QuartzComponentConstructor
