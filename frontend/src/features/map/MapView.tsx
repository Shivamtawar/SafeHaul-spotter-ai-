import 'leaflet/dist/leaflet.css'
import { latLngBounds } from 'leaflet'
import { useEffect } from 'react'
import {
  CircleMarker,
  MapContainer,
  Polyline,
  Popup,
  TileLayer,
  Tooltip,
  useMap,
} from 'react-leaflet'
import { RiskOverlay } from '../heatmap/RiskOverlay'
import { RiskChip } from '../routes/RiskChip'
import type { HeatPoint } from '../heatmap/heat'
import type { Checkpoint, Plan, Place } from '../../shared/api/schemas'
import { formatDateTime } from '../../shared/lib/format'
import { riskByLevel, routeColor } from '../../shared/risk/tokens'

const US_CENTER: [number, number] = [39.5, -98.35]

interface MapViewProps {
  plan: Plan | null
  selectedId: string | null
  onSelect: (routeId: string) => void
  origin: Place | null
  destination: Place | null
  heatPoints: HeatPoint[]
  showHeatmap: boolean
}

function FitToRoutes({ plan }: { plan: Plan | null }) {
  const map = useMap()
  useEffect(() => {
    if (!plan) return
    const points = plan.routes.flatMap((route) => route.geometry)
    if (points.length > 0) map.fitBounds(latLngBounds(points), { padding: [40, 40] })
  }, [map, plan])
  return null
}

function CheckpointPopup({ checkpoint }: { checkpoint: Checkpoint }) {
  return (
    <div className="checkpoint-popup">
      <strong>Mile {checkpoint.mile}</strong>
      <div>ETA {formatDateTime(checkpoint.eta)}</div>
      <div>
        <RiskChip level={checkpoint.level} />
      </div>
      <dl>
        <dt>Wind</dt>
        <dd>{checkpoint.wind_mph} mph</dd>
        <dt>Rain</dt>
        <dd>{checkpoint.rain_in_hr} in/hr</dd>
        <dt>Snow</dt>
        <dd>{checkpoint.snow_in_hr} in/hr</dd>
      </dl>
      {checkpoint.reasons.length > 0 && (
        <ul>
          {checkpoint.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function MapView({
  plan,
  selectedId,
  onSelect,
  origin,
  destination,
  heatPoints,
  showHeatmap,
}: MapViewProps) {
  const selected = plan?.routes.find((route) => route.route_id === selectedId)
  // Draw the selected route last so it sits on top of the others.
  const ordered = plan
    ? [...plan.routes].sort(
        (a, b) => Number(a.route_id === selectedId) - Number(b.route_id === selectedId),
      )
    : []

  return (
    <MapContainer center={US_CENTER} zoom={4} preferCanvas className="map" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <FitToRoutes plan={plan} />

      {/* Lives in its own pane below the route lines and markers. */}
      {plan && showHeatmap && <RiskOverlay points={heatPoints} />}

      {ordered.map((route) => {
        const index = plan?.routes.indexOf(route) ?? 0
        const isSelected = route.route_id === selectedId
        return (
          <Polyline
            key={route.route_id}
            positions={route.geometry}
            pathOptions={{
              color: routeColor(index),
              weight: isSelected ? 7 : 4,
              opacity: isSelected ? 0.95 : 0.55,
              // Dashed as well as red-flagged, so a blocked route is recognizable without color.
              dashArray: route.has_no_travel ? '12 9' : undefined,
            }}
            eventHandlers={{ click: () => onSelect(route.route_id) }}
          />
        )
      })}

      {selected?.checkpoints.map((checkpoint) => {
        const risk = riskByLevel(checkpoint.level)
        return (
          <CircleMarker
            key={checkpoint.mile}
            center={[checkpoint.lat, checkpoint.lon]}
            radius={checkpoint.level >= 3 ? 10 : 7}
            pathOptions={{
              color: '#ffffff',
              weight: checkpoint.level >= 3 ? 3 : 2,
              fillColor: risk.color,
              fillOpacity: 1,
            }}
          >
            <Popup>
              <CheckpointPopup checkpoint={checkpoint} />
            </Popup>
          </CircleMarker>
        )
      })}

      {origin && (
        <CircleMarker
          center={[origin.lat, origin.lon]}
          radius={9}
          pathOptions={{ color: '#111827', fillColor: '#ffffff', fillOpacity: 1, weight: 3 }}
        >
          <Tooltip permanent direction="top">
            Start
          </Tooltip>
        </CircleMarker>
      )}
      {destination && (
        <CircleMarker
          center={[destination.lat, destination.lon]}
          radius={9}
          pathOptions={{ color: '#111827', fillColor: '#111827', fillOpacity: 1, weight: 3 }}
        >
          <Tooltip permanent direction="top">
            End
          </Tooltip>
        </CircleMarker>
      )}
    </MapContainer>
  )
}
