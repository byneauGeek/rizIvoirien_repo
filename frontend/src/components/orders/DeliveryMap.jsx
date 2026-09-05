// LOT 8 (Logistique) : vraie carte de suivi — jusqu'ici seul un lien externe
// "Voir sur Maps" existait (aucune carte embarquée). OpenStreetMap/Leaflet,
// pas Google Maps : pas de clé API à gérer.
import { useEffect, useRef } from 'react'
import { MapContainer, TileLayer, Marker, Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Icônes maison en divIcon : évite le bug classique Leaflet + bundlers
// (chemins d'images par défaut cassés par Vite) et reprend les couleurs de
// la marque plutôt que le marqueur bleu générique de Leaflet.
const driverIcon = L.divIcon({
  className: '',
  html: '<div style="width:16px;height:16px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})
const destinationIcon = L.divIcon({
  className: '',
  html: '<div style="width:14px;height:14px;background:#E8A217;border:3px solid white;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

function FitBounds({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length < 2) return
    map.fitBounds(points, { padding: [30, 30], maxZoom: 15 })
  }, [map, points.map(p => p.join(',')).join('|')])
  return null
}

export default function DeliveryMap({ driverPosition, destination }) {
  const points = [driverPosition, destination].filter(Boolean).map(p => [p.lat, p.lng])
  const center = points[0] || [5.359, -4.008] // Abidjan par défaut si rien n'est encore disponible

  return (
    <div className="mt-2 rounded-2xl overflow-hidden border border-blue-100" style={{ height: 220 }}>
      <MapContainer center={center} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {driverPosition && <Marker position={[driverPosition.lat, driverPosition.lng]} icon={driverIcon} />}
        {destination && <Marker position={[destination.lat, destination.lng]} icon={destinationIcon} />}
        {driverPosition && destination && (
          <Polyline positions={points} pathOptions={{ color: '#2563eb', weight: 3, dashArray: '6 6' }} />
        )}
        <FitBounds points={points} />
      </MapContainer>
    </div>
  )
}
