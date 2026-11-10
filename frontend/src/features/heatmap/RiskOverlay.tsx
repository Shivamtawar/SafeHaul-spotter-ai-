import { DomUtil, Layer } from 'leaflet'
import type { Map as LeafletMap } from 'leaflet'
import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import { riskByLevel } from '../../shared/risk/tokens'
import { blobRadiusPx, paintOrder } from './heat'
import type { HeatPoint } from './heat'

const PANE = 'riskPane'
const PANE_Z_INDEX = '350' // above the map tiles (200), below route lines and markers (400+)
const OVERLAY_OPACITY = '0.6'

/**
 * Draws one soft, risk-colored blob per forecast point on a canvas. Unlike a density heatmap,
 * the color always means the risk level, however many points overlap: higher risk paints on top.
 */
class RiskLayer extends Layer {
  private canvas: HTMLCanvasElement | null = null
  private points: HeatPoint[] = []
  private readonly onMoveEnd = () => this.reset()
  private readonly onZoomStart = () => {
    if (this.canvas) this.canvas.style.visibility = 'hidden'
  }

  setPoints(points: HeatPoint[]): void {
    this.points = paintOrder(points)
    this.draw()
  }

  override onAdd(map: LeafletMap): this {
    const pane = map.getPane(PANE) ?? map.createPane(PANE)
    pane.style.zIndex = PANE_Z_INDEX
    pane.style.pointerEvents = 'none'

    const canvas = DomUtil.create('canvas', 'leaflet-risk-layer', pane)
    canvas.style.opacity = OVERLAY_OPACITY
    canvas.setAttribute('aria-hidden', 'true')
    this.canvas = canvas

    map.on('moveend resize', this.onMoveEnd)
    map.on('zoomstart', this.onZoomStart)
    this.reset()
    return this
  }

  override onRemove(map: LeafletMap): this {
    map.off('moveend resize', this.onMoveEnd)
    map.off('zoomstart', this.onZoomStart)
    this.canvas?.remove()
    this.canvas = null
    return this
  }

  /** Size the canvas to the view and pin it to the top-left corner of the visible map. */
  private reset(): void {
    const map = this._map
    const canvas = this.canvas
    if (!canvas) return
    const size = map.getSize()
    canvas.width = size.x
    canvas.height = size.y
    DomUtil.setPosition(canvas, map.containerPointToLayerPoint([0, 0]))
    canvas.style.visibility = 'visible'
    this.draw()
  }

  private draw(): void {
    const canvas = this.canvas
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return
    const map = this._map
    context.clearRect(0, 0, canvas.width, canvas.height)
    const zoom = map.getZoom()

    for (const point of this.points) {
      const { x, y } = map.latLngToContainerPoint([point.lat, point.lon])
      const radius = blobRadiusPx(point.lat, zoom)
      if (x < -radius || y < -radius || x > canvas.width + radius || y > canvas.height + radius) {
        continue
      }
      const color = riskByLevel(point.level).color
      const blob = context.createRadialGradient(x, y, 0, x, y, radius)
      blob.addColorStop(0, `${color}ff`)
      blob.addColorStop(0.55, `${color}cc`)
      blob.addColorStop(1, `${color}00`)
      context.fillStyle = blob
      context.beginPath()
      context.arc(x, y, radius, 0, Math.PI * 2)
      context.fill()
    }
  }
}

/** Mounts the risk overlay on the map. Updates are coalesced to one redraw per animation frame. */
export function RiskOverlay({ points }: { points: HeatPoint[] }) {
  const map = useMap()
  const layer = useRef<RiskLayer | null>(null)
  const latest = useRef(points)
  const frame = useRef(0)

  useEffect(() => {
    const created = new RiskLayer()
    created.setPoints(latest.current)
    created.addTo(map)
    layer.current = created
    return () => {
      cancelAnimationFrame(frame.current)
      frame.current = 0
      created.remove()
      layer.current = null
    }
  }, [map])

  useEffect(() => {
    latest.current = points
    if (frame.current || !layer.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      layer.current?.setPoints(latest.current)
    })
  }, [points])

  return null
}
