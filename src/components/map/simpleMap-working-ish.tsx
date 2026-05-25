// src/components/map/simpleMap.tsx
'use client';

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet icon issues
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

// Component to handle map view updates
function MapViewUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (map && center && zoom) {
      map.setView(center, zoom);
    }
  }, [map, center, zoom]);
  
  return null;
}

export default function SimpleMap({ 
  events, 
  center = [39.3, -123.5], 
  zoom = 10, 
  height = "400px",
  onMarkerClick 
}: SimpleMapProps) {
  const mapRef = useRef<L.Map>(null);
  
  // Cleanup map on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
      }
    };
  }, []);

  // Handle empty events
  if (!events || events.length === 0) {
    return (
      <div className="bg-muted rounded-xl flex items-center justify-center" style={{ height }}>
        <p className="text-muted-foreground">No events to display</p>
      </div>
    );
  }

  return (
    <MapContainer
      ref={mapRef}
      center={center}
      zoom={zoom}
      style={{ height, width: '100%' }}
      className="rounded-xl z-0"
      whenReady={() => {
        // Map is ready, force a resize to ensure tile layer renders correctly
        setTimeout(() => {
          if (mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }, 100);
      }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapViewUpdater center={center} zoom={zoom} />
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