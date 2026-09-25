'use client';

import React, { useEffect } from 'react';
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { useTheme } from 'next-themes';
import 'leaflet/dist/leaflet.css';
import type { HeatMapData } from '@/types';
import { t, intlLocale } from '@/lib/i18n';

export const RISK_COLORS: Record<string, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#0f766e',
};

// Basemap tiles: OpenStreetMap by default (open data, no API key). Another
// key-free tile server can be set with NEXT_PUBLIC_MAP_TILE_URL (optionally
// NEXT_PUBLIC_MAP_TILE_URL_DARK / NEXT_PUBLIC_MAP_ATTRIBUTION) in .env.local.
const TILE_URL = process.env.NEXT_PUBLIC_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_URL_DARK = process.env.NEXT_PUBLIC_MAP_TILE_URL_DARK || '';
const TILE_ATTRIBUTION =
  process.env.NEXT_PUBLIC_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function riskColor(level?: string) {
  return RISK_COLORS[(level || 'low').toLowerCase()] ?? RISK_COLORS.low;
}

interface DynamicMapProps {
  data: HeatMapData[];
  center?: [number, number];
  zoom?: number;
  height?: number;
  onSelect?: (point: HeatMapData) => void;
  selectedId?: string | null;
}

function Recenter({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.6 });
  }, [center, zoom, map]);
  return null;
}

/** District heat map: circle size follows cases per 100k, colour follows risk tier. */
export function DynamicMap({ data, center = [22.5, 80.5], zoom = 4.6, height = 520, onSelect, selectedId }: DynamicMapProps) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === 'dark';
  // Without a dedicated dark tile set, the light tiles are inverted in CSS.
  const invertTiles = dark && !TILE_URL_DARK;
  const maxRate = Math.max(1, ...data.map((d) => d.cases_per_100k || 0));

  return (
    <div className={`relative overflow-hidden rounded-xl border${invertTiles ? ' map-invert' : ''}`} style={{ height }}>
      <MapContainer center={center} zoom={zoom} zoomSnap={0.2} style={{ height: '100%', width: '100%' }} scrollWheelZoom attributionControl>
        <TileLayer
          key={dark ? 'dark' : 'light'}
          attribution={TILE_ATTRIBUTION}
          url={dark && TILE_URL_DARK ? TILE_URL_DARK : TILE_URL}
        />
        <Recenter center={center} zoom={zoom} />
        {data.map((p) => {
          const r = 6 + Math.sqrt((p.cases_per_100k || 0) / maxRate) * 18;
          const selected = selectedId === p.region_id;
          return (
            <CircleMarker
              key={p.region_id}
              center={[p.latitude, p.longitude]}
              radius={r}
              pathOptions={{
                color: selected ? (dark ? '#fff' : '#0b1113') : '#ffffff',
                weight: selected ? 3 : 1.5,
                fillColor: riskColor(p.risk_level),
                fillOpacity: 0.55,
              }}
              eventHandlers={{ click: () => onSelect?.(p) }}
            >
              <Tooltip direction="top" offset={[0, -r]} opacity={1}>
                <div className="text-[12px]">
                  <div className="font-semibold">{p.region_name}</div>
                  <div>{t("{case_count} cases · {cases_per_100k}/100k", { case_count: p.case_count.toLocaleString(intlLocale()), cases_per_100k: p.cases_per_100k.toFixed(1) })}</div>
                  <div style={{ color: riskColor(p.risk_level) }}>{t("{risk_level} risk", { risk_level: p.risk_level })}</div>
                </div>
              </Tooltip>
            </CircleMarker>
          );
        })}
      </MapContainer>
      <div className="pointer-events-none absolute bottom-3 left-3 z-[400] rounded-lg border bg-card/90 px-3 py-2 text-[11.5px] shadow-sm backdrop-blur">
        <div className="mb-1 font-semibold">{t("Risk tier")}</div>
        <div className="flex gap-3">
          {['Critical', 'High', 'Medium', 'Low'].map((l) => (
            <span key={l} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: riskColor(l) }} />{l}</span>
          ))}
        </div>
        <div className="mt-1 text-muted-foreground">{t("Circle size: cases per 100k")}</div>
      </div>
    </div>
  );
}
