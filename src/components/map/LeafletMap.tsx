// src/components/Map/LeafletMap.tsx
'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icons
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

interface EventMarker {
  id: number;
  latitude: number;
  longitude: number;
  roadwayName: string;
  eventType: string;
  description: string;
  directionOfTravel?: string;
  lanesAffected?: string;
}

interface LeafletMapProps {
  events: EventMarker[];
  center?: [number, number];
  zoom?: number;
}

export default function LeafletMap({ events, center = [39.3, -123.5], zoom = 9 }: LeafletMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    // Create map instance
    const map = L.map(mapContainerRef.current).setView(center, zoom);
    
    // Add tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 19,
      minZoom: 3
    }).addTo(map);

    mapRef.current = map;
    markersRef.current = L.layerGroup().addTo(map);

    // Cleanup on unmount
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markersRef.current = null;
    };
  }, [center, zoom]);

  // Update markers when events change
  useEffect(() => {
    if (!mapRef.current || !markersRef.current) return;

    // Clear existing markers
    markersRef.current.clearLayers();

    if (events.length === 0) return;

    // Add markers for each event
    events.forEach(event => {
      const getMarkerColor = () => {
        const type = event.eventType?.toLowerCase() || '';
        if (type.includes('accident')) return '#ef4444'; // red
        if (type.includes('construction')) return '#f97316'; // orange
        if (type.includes('roadwork')) return '#3b82f6'; // blue
        return '#10b981'; // green
      };

      const customIcon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          background-color: ${getMarkerColor()};
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 0 4px rgba(0,0,0,0.5);
          cursor: pointer;
        "></div>`,
        iconSize: [16, 16],
        popupAnchor: [0, -8],
      });

      const popupContent = `
        <div style="min-width: 200px; max-width: 300px; font-family: system-ui;">
          <h3 style="font-weight: bold; margin-bottom: 4px;">${event.roadwayName || 'Unknown Roadway'}</h3>
          <p style="font-size: 12px; color: #666; margin-bottom: 8px;">${event.eventType || 'Event'}</p>
          <p style="font-size: 12px; margin-bottom: 4px;">${event.description?.substring(0, 100) || 'No description'}</p>
          ${event.directionOfTravel ? `<p style="font-size: 11px; color: #666; margin-top: 4px;"><strong>Direction:</strong> ${event.directionOfTravel}</p>` : ''}
          ${event.lanesAffected ? `<p style="font-size: 11px; color: #666;"><strong>Lanes:</strong> ${event.lanesAffected}</p>` : ''}
        </div>
      `;

      const marker = L.marker([event.latitude, event.longitude], { icon: customIcon })
        .bindPopup(popupContent);

      marker.addTo(markersRef.current!);
    });

    // Fit bounds to show all markers
    if (events.length > 1) {
      const bounds = L.latLngBounds(events.map(e => [e.latitude, e.longitude]));
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    } else if (events.length === 1) {
      mapRef.current.setView([events[0].latitude, events[0].longitude], 12);
    }

  }, [events]);

  return (
    <div 
      ref={mapContainerRef} 
      className="w-full h-[400px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm"
      style={{ zIndex: 1 }}
    />
  );
}