// src/components/map/simpleMap.tsx
'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState } from 'react';

// Fix Leaflet icon issues (keep your existing icon fix)
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface SimpleMapProps {
  events: Array<{
    id: number | string;
    latitude: number;
    longitude: number;
    roadwayName: string;
    eventType: string;
    description: string;
    onClick?: () => void;
  }>;
  center?: [number, number];
  zoom?: number;
  height?: string;
  onMarkerClick?: (event: any) => void;
}

export default function SimpleMap({ 
  events, 
  center = [39.3, -123.5], 
  zoom = 10, 
  height = "400px",
  onMarkerClick 
}: SimpleMapProps) {
  // Generate a unique key that changes when events or center changes
  // This forces React-Leaflet to remount on updates instead of trying to patch
  const mapKey = `${center[0]}-${center[1]}-${zoom}-${events.length}-${Date.now()}`;
  
  // For development only - use a stable key for production
  const isDev = process.env.NODE_ENV === 'development';
  const stableKey = `${center[0]}-${center[1]}-${zoom}`;

  return (
    <MapContainer
      key={isDev ? mapKey : stableKey}  // Force remount in dev, stable in prod
      center={center}
      zoom={zoom}
      style={{ height, width: '100%' }}
      className="rounded-xl z-0"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {events.map((event) => (
        <Marker
          key={event.id}
          position={[event.latitude, event.longitude]}
          eventHandlers={{
            click: () => {
              if (onMarkerClick) {
                onMarkerClick(event);
              } else if (event.onClick) {
                event.onClick();
              }
            },
          }}
        >
          <Popup>
            <div className="text-sm min-w-[200px]">
              <h3 className="font-semibold text-foreground">{event.eventType}</h3>
              <p className="text-muted-foreground text-xs mt-1">{event.roadwayName}</p>
              <p className="text-muted-foreground text-xs mt-1">{event.description?.substring(0, 100)}</p>
              <button
                className="mt-2 text-xs text-primary hover:underline"
                onClick={() => {
                  if (onMarkerClick) {
                    onMarkerClick(event);
                  } else if (event.onClick) {
                    event.onClick();
                  }
                }}
              >
                Click for details →
              </button>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}