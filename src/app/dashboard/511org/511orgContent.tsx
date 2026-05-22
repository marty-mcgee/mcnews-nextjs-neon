// src/app/dashboard/511org/511orgContent.tsx
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { RefreshCw, AlertTriangle, MapPin, Clock, TrendingUp, Radio, Construction, Car } from 'lucide-react';

// Dynamically import the map component to avoid SSR issues
const SimpleMap = dynamic(() => import('@/components/map/SimpleMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600 mx-auto mb-2"></div>
        <p className="text-gray-500">Loading map...</p>
      </div>
    </div>
  ),
});

interface BayAreaEvent {
  id: number;
  roadwayName: string;
  eventType: string;
  directionOfTravel: string;
  lanesAffected: string;
  description: string;
  severity?: string;
  startTime?: string;
  latitude?: number;
  longitude?: number;
  county?: string;
}

// Demo markers for Mendocino County to show map functionality
const DEMO_MARKERS = [
  {
    id: 9991,
    latitude: 39.1505,
    longitude: -123.2076,
    roadwayName: 'US-101',
    eventType: 'Construction',
    description: 'Road work near Ukiah - lane closure',
  },
  {
    id: 9992,
    latitude: 39.3005,
    longitude: -123.7994,
    roadwayName: 'CA-1',
    eventType: 'Accident',
    description: 'Vehicle accident near Mendocino coast',
  },
  {
    id: 9993,
    latitude: 38.9785,
    longitude: -123.0711,
    roadwayName: 'CA-128',
    eventType: 'Road Work',
    description: 'Road maintenance near Boonville',
  },
  {
    id: 9994,
    latitude: 39.4355,
    longitude: -123.3555,
    roadwayName: 'CA-20',
    eventType: 'Hazard',
    description: 'Tree down on roadway',
  },
];

export default function BayArea511Content() {
  const [events, setEvents] = useState<BayAreaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('');
  const [availableTypes, setAvailableTypes] = useState<string[]>([]);
  const [showMap, setShowMap] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let url = '/api/bay-area-511?limit=200';
      if (selectedType && selectedType !== 'all') {
        url += `&eventType=${encodeURIComponent(selectedType)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setEvents(data.data);
        setTotalCount(data.count || data.data.length);
        const types = [...new Set(data.data.map((e: BayAreaEvent) => e.eventType).filter(Boolean))];
        setAvailableTypes(types.sort());
      } else {
        setError('Failed to load Bay Area events');
      }
    } catch (err) {
      console.error('Error fetching Bay Area events:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const pollData = async () => {
    setIsPolling(true);
    try {
      const response = await fetch('/api/bay-area-511/poll?action=poll');
      const data = await response.json();
      if (data.success) {
        const newCount = data.stats?.newCount || 0;
        alert(`Bay Area 511 poll completed! Found ${newCount} new events.`);
        await fetchData();
      } else {
        alert('Poll failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Poll failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsPolling(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedType]);

  const getEventTypeBadge = (type: string) => {
    const lowerType = type?.toLowerCase() || '';
    if (lowerType.includes('accident')) return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    if (lowerType.includes('construction')) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300';
    if (lowerType.includes('roadwork')) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
    return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
  };

  const mendocinoEvents = events.filter(e => e.county?.toLowerCase() === 'mendocino');
  const mendocinoWithCoordinates = mendocinoEvents.filter(e => e.latitude && e.longitude);
  const activeCount = events.filter(e => e.eventType?.toLowerCase().includes('incident')).length;
  const constructionCount = events.filter(e => e.eventType?.toLowerCase().includes('construction')).length;
  const roadworkCount = events.filter(e => e.eventType?.toLowerCase().includes('roadwork')).length;

  // Use real events if they have coordinates, otherwise use demo markers
  const mapEvents = mendocinoWithCoordinates.length > 0 
    ? mendocinoWithCoordinates.map(event => ({
        id: event.id,
        latitude: event.latitude!,
        longitude: event.longitude!,
        roadwayName: event.roadwayName,
        eventType: event.eventType,
        description: event.description,
      }))
    : DEMO_MARKERS;

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3" />
        <p>{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Bay Area Traffic Events</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Official real-time data from 511.org</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowMap(!showMap)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-all shadow-sm"
          >
            <MapPin className="w-4 h-4" />
            {showMap ? 'Hide Map' : 'Show Map'}
          </button>
          <button
            onClick={pollData}
            disabled={isPolling}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isPolling ? 'animate-spin' : ''}`} />
            {isPolling ? 'Fetching...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium">Total Events</p>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">{totalCount}</p>
            </div>
            <Radio className="w-8 h-8 text-emerald-500 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">Active Incidents</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-300">{activeCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-amber-600 dark:text-amber-400 text-sm font-medium">Construction</p>
              <p className="text-2xl font-bold text-amber-900 dark:text-amber-300">{constructionCount}</p>
            </div>
            <Construction className="w-8 h-8 text-amber-500 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">Road Work</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{roadworkCount}</p>
            </div>
            <Car className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Mendocino County Summary */}
      <div className="mb-6 p-4 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-600" />
            <span className="font-semibold text-purple-900 dark:text-purple-300">Mendocino County</span>
          </div>
          <div className="text-sm text-purple-700 dark:text-purple-400">
            {mendocinoWithCoordinates.length > 0 
              ? `${mendocinoWithCoordinates.length} real events on map`
              : '4 demo locations shown (waiting for real coordinate data)'}
          </div>
        </div>
      </div>

      {/* Type Filter */}
      {availableTypes.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-500" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Type:</label>
            </div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Types</option>
              {availableTypes.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {selectedType && (
              <button
                onClick={() => setSelectedType('')}
                className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Map */}
      {showMap && (
        <div className="mb-6">
          <SimpleMap events={mapEvents} center={[39.3, -123.5]} zoom={9} />
        </div>
      )}

      {/* Events Grid */}
      {events.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg">No events found</p>
          <p className="text-sm mt-1">Click refresh to fetch current events from 511.org</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {events.map((event) => (
            <div key={event.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-900 shadow-sm flex items-center justify-center">
                    {event.eventType?.toLowerCase().includes('construction') ? (
                      <Construction className="w-4 h-4 text-amber-500" />
                    ) : event.eventType?.toLowerCase().includes('accident') ? (
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                    ) : (
                      <Car className="w-4 h-4 text-blue-500" />
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{event.roadwayName || 'Unknown Roadway'}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{event.description?.substring(0, 120)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={`px-2 py-1 text-xs rounded-full ${getEventTypeBadge(event.eventType)}`}>
                        {event.eventType || 'Event'}
                      </span>
                      {event.county && (
                        <span className="text-xs text-gray-400">{event.county}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    {event.directionOfTravel && (
                      <span className="flex items-center gap-1">
                        <Car className="w-3 h-3" />
                        {event.directionOfTravel}
                      </span>
                    )}
                    {event.lanesAffected && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {event.lanesAffected}
                      </span>
                    )}
                    {event.startTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Starts: {new Date(event.startTime).toLocaleDateString()}
                      </span>
                    )}
                    {event.latitude && event.longitude && (
                      <span className="flex items-center gap-1 text-emerald-600">
                        <MapPin className="w-3 h-3" />
                        Located on map
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}