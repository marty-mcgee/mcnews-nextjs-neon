// src/components/map/masterMap.tsx
'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function MapBoundsUpdater({ events }: { events: any[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (events.length === 0) return;
    const validEvents = events.filter(e => e.latitude && e.longitude);
    if (validEvents.length === 0) return;
    const bounds = L.latLngBounds(validEvents.map(e => [e.latitude, e.longitude]));
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [events, map]);
  
  return null;
}

interface MapEvent {
  id: number;
  source: string;
  type: string;
  location: string;
  description: string;
  latitude: number;
  longitude: number;
  timestamp?: string;
  severity?: string;
}

interface MasterMapProps {
  events: MapEvent[];
  center?: [number, number];
  zoom?: number;
  height?: string;
  onMarkerClick?: (event: MapEvent) => void;
}

const getSourceColor = (source: string) => {
  switch (source) {
    case 'caltrans': return '#3b82f6';
    case 'bayarea511': return '#10b981';
    case 'chp-live': return '#ef4444';
    case 'chp-historical': return '#8b5cf6';
    default: return '#6b7280';
  }
};

const getSourceName = (source: string) => {
  switch (source) {
    case 'caltrans': return 'Caltrans';
    case 'bayarea511': return '511.org';
    case 'chp-live': return 'CHP Live';
    case 'chp-historical': return 'CHP Historical';
    default: return source;
  }
};

const getSourceIcon = (source: string) => {
  switch (source) {
    case 'caltrans': return '🚧';
    case 'bayarea511': return '🚗';
    case 'chp-live': return '🚨';
    case 'chp-historical': return '📊';
    default: return '📍';
  }
};

export default function MasterMap({ events, center = [39.3, -123.5], zoom = 9, height = '500px', onMarkerClick }: MasterMapProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    return (
      <div className={`w-full h-[${height}] rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const validEvents = events.filter(e => e.latitude && e.longitude && !isNaN(e.latitude) && !isNaN(e.longitude));

  const handleMarkerClick = (event: MapEvent) => {
    if (onMarkerClick) {
      onMarkerClick(event);
    }
  };

  return (
    <MapContainer
      center={center}
      zoom={zoom}
      style={{ height, width: '100%', borderRadius: '0.75rem', zIndex: 1 }}
      className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm"
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
      
      {validEvents.map((event) => {
        const sourceColor = getSourceColor(event.source);
        
        const customIcon = L.divIcon({
          html: `<div style="
            background-color: ${sourceColor};
            width: 28px;
            height: 28px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: bold;
            color: white;
            border: 2px solid white;
            box-shadow: 0 0 4px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: transform 0.2s;
          ">${getSourceIcon(event.source)}</div>`,
          iconSize: [32, 32],
          popupAnchor: [0, -16],
          className: 'custom-marker'
        });

        return (
          <Marker 
            key={`${event.source}-${event.id}`} 
            position={[event.latitude, event.longitude]} 
            icon={customIcon}
            eventHandlers={{
              click: () => handleMarkerClick(event),
            }}
          >
            <Popup>
              <div style={{ minWidth: '220px', maxWidth: '320px' }}>
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-gray-200">
                  <div className={`w-2 h-2 rounded-full`} style={{ backgroundColor: sourceColor }} />
                  <span className="text-xs font-semibold uppercase tracking-wide">{getSourceName(event.source)}</span>
                </div>
                <div className="font-bold text-sm mb-1">{event.type}</div>
                <div className="text-xs text-gray-600 mb-2">📍 {event.location}</div>
                <div className="text-xs text-gray-500 mb-2">{event.description?.substring(0, 100)}</div>
                {event.timestamp && (
                  <div className="text-xs text-gray-400">🕐 {new Date(event.timestamp).toLocaleString()}</div>
                )}
                {event.severity && (
                  <div className={`mt-2 inline-block px-2 py-0.5 text-xs rounded-full ${
                    event.severity === 'Fatal' || event.severity === 'Major' ? 'bg-red-100 text-red-700' :
                    event.severity === 'Injury' ? 'bg-orange-100 text-orange-700' :
                    'bg-yellow-100 text-yellow-700'
                  }`}>
                    {event.severity}
                  </div>
                )}
                <div className="mt-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => handleMarkerClick(event)}
                    className="w-full text-center text-xs text-blue-600 hover:text-blue-700"
                  >
                    View all {getSourceName(event.source)} events →
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        );
      })}
      
      <MapBoundsUpdater events={validEvents} />
    </MapContainer>
  );
}