'use client';

import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import 'leaflet/dist/leaflet.css';
import { HeatMapData } from '@/types';
import { Card } from '@/components/ui/card';

interface DynamicMapProps {
  data: HeatMapData[];
  center?: [number, number];
  zoom?: number;
}

function MapController({ center, zoom }: { center: [number, number], zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);

  return null;
}

export function DynamicMap({ data, center = [20.5937, 78.9629], zoom = 5 }: DynamicMapProps) {
  const getSeverityColor = (level: string) => {
    const colors: Record<string, string> = {
      critical: '#dc2626',
      Critical: '#dc2626',
      high: '#ea580c',
      High: '#ea580c',
      medium: '#f59e0b',
      Medium: '#f59e0b',
      low: '#3b82f6',
      Low: '#3b82f6',
    };
    return colors[level] || colors.low;
  };

  const getRadius = (casesper100k: number) => {
    return Math.max(5, Math.min(30, casesper100k / 10));
  };

  return (
    <Card className="p-0 overflow-hidden">
      <div style={{ height: '600px', width: '100%' }}>
        <MapContainer
          center={center}
          zoom={zoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={true}
          scrollWheelZoom={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <MapController center={center} zoom={zoom} />

          <MarkerClusterGroup
            chunkedLoading
            maxClusterRadius={50}
            spiderfyOnMaxZoom={true}
            showCoverageOnHover={false}
            zoomToBoundsOnClick={true}
          >
            {data.map((point, index) => (
              <CircleMarker
                key={index}
                center={[point.latitude, point.longitude]}
                radius={getRadius(point.cases_per_100k)}
                fillColor={getSeverityColor(point.risk_level)}
                color="#fff"
                weight={2}
                opacity={0.8}
                fillOpacity={0.6}
              >
                <Popup>
                  <div className="p-2">
                    <h3 className="font-bold text-lg mb-2">{point.region_name}</h3>
                    <div className="space-y-1 text-sm">
                      <p>
                        <span className="font-medium">Cases:</span> {point.case_count}
                      </p>
                      <p>
                        <span className="font-medium">Per 100k:</span>{' '}
                        {point.cases_per_100k.toFixed(2)}
                      </p>
                      <p>
                        <span className="font-medium">Risk Level:</span>{' '}
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-semibold text-white`}
                          style={{ backgroundColor: getSeverityColor(point.risk_level) }}
                        >
                          {point.risk_level.toUpperCase()}
                        </span>
                      </p>
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            ))}
          </MarkerClusterGroup>
        </MapContainer>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 right-4 bg-white p-3 rounded-lg shadow-lg z-[1000]">
        <p className="font-semibold text-sm mb-2">Severity</p>
        <div className="space-y-1">
          {[
            { label: 'Critical', color: '#dc2626' },
            { label: 'High', color: '#ea580c' },
            { label: 'Medium', color: '#f59e0b' },
            { label: 'Low', color: '#3b82f6' },
          ].map((item) => (
            <div key={item.label} className="flex items-center space-x-2 text-xs">
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
