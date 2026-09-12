import { useState } from 'react'
import { MapPin, Check, AlertCircle, ExternalLink } from 'lucide-react'
import { parseGoogleMapsInput } from '../../utils/googleMaps'

// LOT GEOLOC (retour utilisateur) : solution additionnelle à l'adresse texte
// existante — colle un lien Google Maps (ou "lat, lng") pour enregistrer une
// position exacte. N'importe où un latitude/longitude existe déjà (Shop,
// Address, Cooperative, Producer) : le parent gère l'état réel, ce composant
// ne fait que traduire une saisie en {lat, lng} via onLocate.
export default function GoogleMapsLocationInput({ latitude, longitude, onLocate }) {
  const [raw, setRaw] = useState('')
  const [error, setError] = useState('')

  const apply = () => {
    const coords = parseGoogleMapsInput(raw)
    if (!coords) {
      setError('Non reconnu — collez un lien Google Maps complet (pas un lien raccourci maps.app.goo.gl) ou "latitude, longitude"')
      return
    }
    setError('')
    setRaw('')
    onLocate(coords)
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="text" value={raw} onChange={(e) => setRaw(e.target.value)}
          placeholder="Coller un lien Google Maps ou des coordonnées (ex : 5.359951, -4.008256)"
          className="flex-1 bg-white border-2 border-charcoal/10 rounded-2xl px-4 py-2.5 font-dm text-sm text-charcoal placeholder-charcoal/30 focus:outline-none focus:border-forest transition-colors"
        />
        <button type="button" onClick={apply}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-forest text-cream font-syne text-xs font-bold hover:bg-forest-light transition-colors shrink-0">
          <MapPin size={13} /> Localiser
        </button>
      </div>
      {error && (
        <p className="flex items-center gap-1.5 font-dm text-xs text-red-500"><AlertCircle size={12} className="shrink-0" /> {error}</p>
      )}
      {latitude != null && longitude != null && (
        <p className="flex items-center gap-1.5 font-dm text-xs text-green-600">
          <Check size={12} className="shrink-0" /> Position enregistrée : {Number(latitude).toFixed(6)}, {Number(longitude).toFixed(6)}
          <a href={`https://www.google.com/maps?q=${latitude},${longitude}`} target="_blank" rel="noreferrer"
            className="flex items-center gap-1 underline hover:text-green-700">
            Voir <ExternalLink size={10} />
          </a>
        </p>
      )}
    </div>
  )
}
