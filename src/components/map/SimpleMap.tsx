// src/components/Map/SimpleMap.tsx
'use client';

import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface MapEvent {
  id: number;
  latitude: number;
  longitude: number;
  roadwayName: string;
  eventType: string;
  description: string;
}

interface SimpleMapProps {
  events: MapEvent[];
  center?: [number, number];
  zoom?: number;
}

export default function SimpleMap({ events, center = [39.3, -123.5], zoom = 9 }: SimpleMapProps) {
  // Don't render on server
  if (typeof window === 'undefined') {
    return (
      <div className="w-full h-[400px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-2"></div>
          <p className="text-gray-500">Loading map...</p>
        </div>
      </div>
    );
  }

  const getMarkerColor = (eventType: string) => {
    const type = eventType?.toLowerCase() || '';
    if (type.includes('accident')) return '#ef4444';
    if (type.includes('construction')) return '#f97316';
    if (type.includes('roadwork')) return '#3b82f6';
    return '#10b981';
  };

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height: '400px', width: '100%', borderRadius: '0.75rem', zIndex: 1 }}
      className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {events.map((event) => (
        <Marker
          key={event.id}
          position={[event.latitude, event.longitude]}
          icon={L.divIcon({
            html: `<div style="
              background-color: ${getMarkerColor(event.eventType)};
              width: 14px;
              height: 14px;
              border-radius: 50%;
              border: 2px solid white;
              box-shadow: 0 0 4px rgba(0,0,0,0.3);
              cursor: pointer;
            "></div>`,
            iconSize: [18, 18],
            popupAnchor: [0, -9],
            className: 'custom-marker'
          })}
        >
          <Popup>
            <div style={{ minWidth: '200px', maxWidth: '300px' }}>
              <h3 style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '14px' }}>
                {event.roadwayName || 'Unknown Roadway'}
              </h3>
              <p style={{ fontSize: '12px', color: '#666', marginBottom: '8px' }}>
                {event.eventType || 'Event'}
              </p>
              <p style={{ fontSize: '12px', marginBottom: '4px' }}>
                {event.description?.substring(0, 100) || 'No description'}
              </p>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}