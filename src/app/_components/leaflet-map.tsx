"use client";

import "leaflet/dist/leaflet.css";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap } from "react-leaflet";
import { useEffect } from "react";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color: string;
  radius?: number;
  fillOpacity?: number;
  highlight?: boolean;
}

function FitBounds({ points }: { points: MapPoint[] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      { padding: [30, 30], maxZoom: 14 },
    );
  }, [map, points]);
  return null;
}

/** Leaflet + OpenStreetMap tiles. CircleMarkers avoid Leaflet's broken default marker images under bundlers. */
export default function LeafletMap({ points, className = "h-72" }: { points: MapPoint[]; className?: string }) {
  const center = points[0] ? ([points[0].lat, points[0].lng] as [number, number]) : ([23.7, 90.4] as [number, number]);
  return (
    <MapContainer center={center} zoom={12} scrollWheelZoom={false} className={`z-0 w-full rounded-2xl ${className}`}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((p) => (
        <CircleMarker
          key={p.id}
          center={[p.lat, p.lng]}
          radius={p.radius ?? 9}
          pathOptions={{ color: p.highlight ? "#111" : "#fff", weight: p.highlight ? 3 : 2, fillColor: p.color, fillOpacity: p.fillOpacity ?? 0.9 }}
        >
          <Tooltip permanent={p.highlight} direction="top">
            {p.label}
          </Tooltip>
        </CircleMarker>
      ))}
      <FitBounds points={points} />
    </MapContainer>
  );
}
