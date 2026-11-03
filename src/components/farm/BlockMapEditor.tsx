'use client';

import { useEffect, useRef, useState } from 'react';
import { Crosshair, MapPin, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import { polygonCentroid, type BlockPolygon } from '@/lib/farm/geometry';
export type { BlockPolygon } from '@/lib/farm/geometry';

export type BlockGeo = {
  centroid_lat: number | null;
  centroid_lng: number | null;
  boundary_geojson: BlockPolygon | null;
};

type Props = {
  value: BlockGeo;
  onChange?: (next: BlockGeo) => void;
  /** When true, show the map without draw/GPS controls. */
  readOnly?: boolean;
};

export function BlockMapEditor({ value, onChange, readOnly = false }: Props) {
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import('leaflet').Map | null>(null);
  const layerRef = useRef<import('leaflet').LayerGroup | null>(null);
  const markerRef = useRef<import('leaflet').Marker | null>(null);
  const [drawing, setDrawing] = useState<[number, number][]>([]);
  const [ready, setReady] = useState(false);
  const notify = onChange ?? (() => undefined);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | undefined;
    async function boot() {
      if (!mapEl.current || mapRef.current) return;
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');

      // Fix default marker icons under bundlers.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      });

      if (cancelled || !mapEl.current) return;
      const start: [number, number] =
        value.centroid_lat != null && value.centroid_lng != null
          ? [value.centroid_lat, value.centroid_lng]
          : [0.3476, 32.5825]; // Kampala fallback

      const map = L.map(mapEl.current, {
        zoomControl: true,
        dragging: true,
        scrollWheelZoom: !readOnly,
      }).setView(start, value.centroid_lat != null ? 16 : 12);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(map);

      if (!readOnly) {
        map.on('click', (e: { latlng: { lat: number; lng: number } }) => {
          setDrawing((prev) => [...prev, [e.latlng.lng, e.latlng.lat] as [number, number]]);
        });
      }

      mapRef.current = map;
      setReady(true);
      resizeObserver = new ResizeObserver(() => map.invalidateSize());
      resizeObserver.observe(mapEl.current);
    }
    boot().catch(() => toast.error('Could not load map'));
    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // Intentionally once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function redraw() {
      const map = mapRef.current;
      if (!map || !ready) return;
      const L = (await import('leaflet')).default;
      if (mapRef.current !== map) return;

      layerRef.current?.remove();
      markerRef.current?.remove();
      layerRef.current = null;
      markerRef.current = null;

      const ring: [number, number][] =
        drawing.length >= 1
          ? drawing
          : (value.boundary_geojson?.coordinates?.[0] ?? []).map((c) => [c[0], c[1]] as [number, number]);

      const layers = L.layerGroup().addTo(map);
      layerRef.current = layers;
      if (ring.length >= 3) {
        const rings = drawing.length ? [ring] : value.boundary_geojson?.coordinates ?? [ring];
        const latLngs = rings.map((r) => r.map(([lng, lat]) => [lat, lng] as [number, number]));
        const poly = L.polygon(latLngs, { color: '#2e5e4a', weight: 2, fillOpacity: 0.25 }).addTo(layers);
        if (!drawing.length) map.fitBounds(poly.getBounds(), { padding: [24, 24] });
      }
      if (drawing.length) {
        L.polyline(drawing.map(([lng, lat]) => [lat, lng]), { color: '#2e5e4a' }).addTo(layers);
        for (const [lng, lat] of drawing) L.circleMarker([lat, lng], { radius: 4 }).addTo(layers);
      }

      if (value.centroid_lat != null && value.centroid_lng != null && drawing.length === 0) {
        markerRef.current = L.marker([value.centroid_lat, value.centroid_lng]).addTo(map);
      }
    }
    redraw();
  }, [drawing, value.boundary_geojson, value.centroid_lat, value.centroid_lng, ready]);

  function commitPolygon() {
    if (drawing.length < 3) {
      toast.error('Click at least 3 points on the map to draw the block boundary');
      return;
    }
    const ring: [number, number][] = [...drawing];
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push([first[0], first[1]]);
    const c = polygonCentroid({ type: 'Polygon', coordinates: [ring] });
    if (!c) {
      toast.error('The boundary must enclose an area');
      return;
    }
    notify({
      boundary_geojson: { type: 'Polygon', coordinates: [ring] },
      centroid_lat: c?.lat ?? null,
      centroid_lng: c?.lng ?? null,
    });
    setDrawing([]);
    toast.success('Boundary saved on this form — click Save to store it');
  }

  async function useDeviceGps() {
    if (!navigator.geolocation) {
      toast.error('Geolocation is not available on this device');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!value.boundary_geojson) notify({ ...value, centroid_lat: lat, centroid_lng: lng });
        mapRef.current?.setView([lat, lng], 17);
        toast.success('GPS point captured');
      },
      () => toast.error('Could not read GPS — check location permission'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-slate-900">Map & GPS</p>
          <p className="text-xs text-slate-500">
            {readOnly
              ? 'Block location and boundary.'
              : 'Capture a point or click the map to draw the block polygon.'}
          </p>
        </div>
        {!readOnly ? (
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={useDeviceGps}>
              <Crosshair className="size-4" /> Use my GPS
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={!drawing.length} onClick={() => setDrawing((points) => points.slice(0, -1))}>
              Undo point
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={commitPolygon} disabled={drawing.length < 3}>
              <MapPin className="size-4" /> Finish polygon ({drawing.length})
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setDrawing([]);
                notify({ centroid_lat: null, centroid_lng: null, boundary_geojson: null });
              }}
            >
              <Trash2 className="size-4" /> Clear
            </Button>
          </div>
        ) : null}
      </div>
      <div ref={mapEl} className="relative z-0 h-64 w-full overflow-hidden rounded-lg border border-slate-200 bg-white" />
      {value.centroid_lat != null && value.centroid_lng != null ? (
        <p className="text-xs text-slate-600">
          Centroid {value.centroid_lat.toFixed(5)}, {value.centroid_lng.toFixed(5)}
          {value.boundary_geojson ? ' · boundary set' : ''}
        </p>
      ) : (
        <p className="text-xs text-slate-500">No GPS saved yet.</p>
      )}
    </div>
  );
}
