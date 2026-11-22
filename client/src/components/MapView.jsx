import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, LayersControl, ZoomControl, Marker, useMap, useMapEvents } from 'react-leaflet';
import { esc } from '../utils';

const DEFAULT_CENTER = [28.2488, 77.06347];
// Esri has no real imagery past some zoom level (it varies by area) and serves a 'Map data not available'
// picture instead. We stop asking for tiles at SAT_NATIVE_ZOOM and stretch that level for the closer views.
// If you still see the grey message in your area, lower it: VITE_SAT_NATIVE_ZOOM=17 in client/.env
const SAT_NATIVE_ZOOM = Number(import.meta.env.VITE_SAT_NATIVE_ZOOM || 18);
const MAX_ZOOM = 20;
const LABEL_ZOOM = 20; // below this, bays are small dots (names show on hover/select) so adjacent spots never overlap

const cache = new Map();
function bayIcon(slot, { selected, labelled: zoomedIn, ghost }) {
  const labelled = zoomedIn || selected || ghost;
  const kind = ghost ? 'draft' : slot.mine ? 'mine' : slot.status.toLowerCase();
  const cls = `bay bay--${kind}${selected ? ' is-selected' : ''}${labelled ? '' : ' bay--dot'}`;
  const key = `${cls}|${slot.name}`;
  if (!cache.has(key)) {
    cache.set(key, L.divIcon({
      className: 'bay-wrap',
      html: `<div class="${cls}">${labelled ? `<b>${esc(slot.name || 'New')}</b>` : ''}</div>`,
      iconSize: labelled ? [44, 22] : [14, 14],
      iconAnchor: labelled ? [22, 11] : [7, 7],
    }));
  }
  return cache.get(key);
}

// Reports zoom changes and (optionally) map clicks to the parent.
function Watcher({ onZoom, onClick }) {
  const map = useMapEvents({
    zoomend: () => onZoom(map.getZoom()),
    click: (e) => onClick?.(e.latlng.lat, e.latlng.lng),
  });
  useEffect(() => { onZoom(map.getZoom()); }, [map, onZoom]);
  return null;
}

// Fit the view to all spots the first time any exist.
function FitOnce({ slots }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !slots.length) return;
    done.current = true;
    const wide = window.innerWidth > 800;
    map.fitBounds(L.latLngBounds(slots.map((s) => [s.lat, s.lng])), {
      paddingTopLeft: [wide ? 400 : 40, 70], paddingBottomRight: [40, wide ? 50 : 320], maxZoom: 20,
    });
  }, [slots, map]);
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 19), { duration: 0.8 });
  }, [target, map]);
  return null;
}

function Legend() {
  return (
    <div className="legend" aria-label="Map legend">
      <span><i className="dot dot--available" /> Free</span>
      <span><i className="dot dot--booked" /> Taken</span>
      <span><i className="dot dot--mine" /> Yours</span>
      <span><i className="dot dot--maintenance" /> Closed</span>
    </div>
  );
}

export default function MapView({ slots, selectedId, onSelect, flyTarget, editor = false, draft, onMapClick, onMove, onDraftMove }) {
  const [zoom, setZoom] = useState(17);
  const labelled = zoom >= LABEL_ZOOM;

  return (
    <MapContainer center={DEFAULT_CENTER} zoom={17} maxZoom={MAX_ZOOM} zoomControl={false} className={`map${draft ? ' is-placing' : ''}`}>
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="Satellite">
          <TileLayer
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxNativeZoom={SAT_NATIVE_ZOOM} maxZoom={MAX_ZOOM}
            attribution="Imagery &copy; Esri, Maxar, Earthstar Geographics"
          />
        </LayersControl.BaseLayer>
        <LayersControl.BaseLayer name="Streets">
          <TileLayer
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxNativeZoom={19} maxZoom={MAX_ZOOM}
            attribution="&copy; OpenStreetMap contributors"
          />
        </LayersControl.BaseLayer>
      </LayersControl>
      <ZoomControl position="bottomright" />
      <Legend />
      <Watcher onZoom={setZoom} onClick={editor ? onMapClick : undefined} />
      <FitOnce slots={slots} />
      <FlyTo target={flyTarget} />

      {slots.map((s) => {
        const selected = s.id === selectedId;
        return (
          <Marker
            key={s.id}
            position={[s.lat, s.lng]}
            icon={bayIcon(s, { selected, labelled })}
            zIndexOffset={selected ? 1000 : 0}
            title={`${s.name}: ${s.mine ? 'your spot' : s.status}`}
            draggable={editor && selected}
            eventHandlers={{
              click: (e) => { L.DomEvent.stopPropagation(e); onSelect(s.id); },
              dragend: (e) => { const p = e.target.getLatLng(); onMove?.(s, p.lat, p.lng); },
            }}
          />
        );
      })}

      {draft && (
        <Marker
          position={[draft.lat, draft.lng]}
          icon={bayIcon({ name: draft.name, status: 'Available' }, { selected: true, labelled: true, ghost: true })}
          draggable
          zIndexOffset={2000}
          eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onDraftMove?.(p.lat, p.lng); } }}
        />
      )}
    </MapContainer>
  );
}
