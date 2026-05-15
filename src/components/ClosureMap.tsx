// app/components/ClosureMap.tsx
'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons in Next.js
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/marker-icon-2x.png',
  iconUrl: '/marker-icon.png',
  shadowUrl: '/marker-shadow.png',
});

// Custom marker icons for different closure types
const getMarkerIcon = (closureType: string) => {
  const color = closureType?.includes('Closure') 
    ? 'red' 
    : closureType?.includes('Work') 
    ? 'orange' 
    : 'blue';
  
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    ">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="white" stroke-width="2">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      </svg>
    </div>`,
    iconSize: [24, 24],
    popupAnchor: [0, -12],
  });
};

// Component to handle map view updates
function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

interface Closure {
  closure_id: number;
  district: number;
  route: string;
  closure_type: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  status: string;
  end_date: string;
}

interface ClosureMapProps {
  closures: Closure[];
  selectedDistrict?: string;
}

export default function ClosureMap({ closures, selectedDistrict }: ClosureMapProps) {
  const [mapCenter, setMapCenter] = useState<[number, number]>([36.7783, -119.4179]); // California center
  const [mapZoom, setMapZoom] = useState(6);

  // Filter closures that have valid coordinates
  const validClosures = closures.filter(
    c => c.latitude && c.longitude && c.status === 'active'
  );

  // Calculate map bounds to show all markers
  useEffect(() => {
    if (validClosures.length > 0) {
      const lats = validClosures.map(c => c.latitude!);
      const lngs = validClosures.map(c => c.longitude!);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLng = Math.min(...lngs);
      const maxLng = Math.max(...lngs);
      
      // Center on the middle of all markers
      const centerLat = (minLat + maxLat) / 2;
      const centerLng = (minLng + maxLng) / 2;
      setMapCenter([centerLat, centerLng]);
      
      // Adjust zoom based on spread
      const latDiff = maxLat - minLat;
      const lngDiff = maxLng - minLng;
      const maxDiff = Math.max(latDiff, lngDiff);
      
      if (maxDiff < 0.5) setMapZoom(10);
      else if (maxDiff < 1) setMapZoom(9);
      else if (maxDiff < 2) setMapZoom(8);
      else if (maxDiff < 4) setMapZoom(7);
      else setMapZoom(6);
    } else {
      setMapCenter([36.7783, -119.4179]);
      setMapZoom(6);
    }
  }, [validClosures]);

  if (typeof window === 'undefined') {
    return <div className="h-full flex items-center justify-center bg-gray-100">Loading map...</div>;
  }

  return (
    <div className="h-full w-full">
      <MapContainer
        center={mapCenter}
        zoom={mapZoom}
        style={{ height: '100%', width: '100%' }}
        className="rounded-lg"
      >
        <MapUpdater center={mapCenter} zoom={mapZoom} />
        
        {/* OpenStreetMap tiles */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {/* Markers for each closure */}
        {validClosures.map((closure) => (
          <Marker
            key={closure.closure_id}
            position={[closure.latitude!, closure.longitude!]}
            icon={getMarkerIcon(closure.closure_type)}
          >
            <Popup>
              <div className="min-w-[200px]">
                <h3 className="font-bold text-lg mb-2">
                  {closure.route} - District {closure.district}
                </h3>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="font-semibold">Type:</span>{' '}
                    <span className={`px-2 py-0.5 rounded text-xs ${
                      closure.closure_type?.includes('Closure') 
                        ? 'bg-red-100 text-red-800'
                        : closure.closure_type?.includes('Work')
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}>
                      {closure.closure_type || 'Unknown'}
                    </span>
                  </p>
                  <p>
                    <span className="font-semibold">Ends:</span>{' '}
                    {new Date(closure.end_date).toLocaleDateString()}
                  </p>
                  <p className="text-gray-600 mt-2">
                    {closure.description?.substring(0, 150)}
                    {closure.description?.length > 150 ? '...' : ''}
                  </p>
                  <button
                    onClick={() => {
                      // You can add navigation to details here
                      window.location.href = `/closure/${closure.closure_id}`;
                    }}
                    className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    View Details →
                  </button>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
        
        {/* No markers message */}
        {validClosures.length === 0 && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white bg-opacity-90 p-4 rounded-lg shadow-lg z-1000">
            <p className="text-gray-600">
              No closures with location data available
              {selectedDistrict && ` in District ${selectedDistrict}`}
            </p>
          </div>
        )}
      </MapContainer>
    </div>
  );
}
