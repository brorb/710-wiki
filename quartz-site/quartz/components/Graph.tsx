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
      minAlpha: 0.25,
      maxAlpha: 1,
      startZoom: 0.8,
      endZoom: 2.6,
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
          <button class="graph__show-full" type="button" >
            SHOW FULL GRAPH
          </button>
        </div>
        <div class="graph-outer">
          <div class="graph-container" data-cfg={JSON.stringify(localGraph)}></div>
          <button class="global-graph-icon" aria-label="Global Graph">
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              xmlnsXlink="http://www.w3.org/1999/xlink"
              x="0px"
              y="0px"
              viewBox="0 0 55 55"
              fill="currentColor"
              xmlSpace="preserve"
            >
              <path
                d="M49,0c-3.309,0-6,2.691-6,6c0,1.035,0.263,2.009,0.726,2.86l-9.829,9.829C32.542,17.634,30.846,17,29,17
                s-3.542,0.634-4.898,1.688l-7.669-7.669C16.785,10.424,17,9.74,17,9c0-2.206-1.794-4-4-4S9,6.794,9,9s1.794,4,4,4
                c0.74,0,1.424-0.215,2.019-0.567l7.669,7.669C21.634,21.458,21,23.154,21,25s0.634,3.542,1.688,4.897L10.024,42.562
                C8.958,41.595,7.549,41,6,41c-3.309,0-6,2.691-6,6s2.691,6,6,6s6-2.691,6-6c0-1.035-0.263-2.009-0.726-2.86l12.829-12.829
                c1.106,0.86,2.44,1.436,3.898,1.619v10.16c-2.833,0.478-5,2.942-5,5.91c0,3.309,2.691,6,6,6s6-2.691,6-6c0-2.967-2.167-5.431-5-5.91
                v-10.16c1.458-0.183,2.792-0.759,3.898-1.619l7.669,7.669C41.215,39.576,41,40.26,41,41c0,2.206,1.794,4,4,4s4-1.794,4-4
                s-1.794-4-4-4c-0.74,0-1.424,0.215-2.019,0.567l-7.669-7.669C36.366,28.542,37,26.846,37,25s-0.634-3.542-1.688-4.897l9.665-9.665
                C46.042,11.405,47.451,12,49,12c3.309,0,6-2.691,6-6S52.309,0,49,0z M11,9c0-1.103,0.897-2,2-2s2,0.897,2,2s-0.897,2-2,2
                S11,10.103,11,9z M6,51c-2.206,0-4-1.794-4-4s1.794-4,4-4s4,1.794,4,4S8.206,51,6,51z M33,49c0,2.206-1.794,4-4,4s-4-1.794-4-4
                s1.794-4,4-4S33,46.794,33,49z M29,31c-3.309,0-6-2.691-6-6s2.691-6,6-6s6,2.691,6,6S32.309,31,29,31z M47,41c0,1.103-0.897,2-2,2
                s-2-0.897-2-2s0.897-2,2-2S47,39.897,47,41z M49,10c-2.206,0-4-1.794-4-4s1.794-4,4-4s4,1.794,4,4S51.206,10,49,10z"
              />
            </svg>
          </button>
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
