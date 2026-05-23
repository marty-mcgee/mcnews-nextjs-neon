// src/app/dashboard/511org/511orgContent.tsx
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { RefreshCw, AlertTriangle, MapPin, TrendingUp, Radio, Construction, Car, Filter, X } from 'lucide-react';

const SimpleMap = dynamic(() => import('@/components/map/simpleMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[400px] rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
    </div>
  ),
});

interface BayAreaEvent {
  id: number;
  sourceId: string;
  eventType: string;
  severity: string;
  description: string;
  roadwayName: string;
  directionOfTravel: string;
  lanesAffected: string;
  latitude: number | null;
  longitude: number | null;
  county: string | null;
  city: string | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
  createdAt: string;
}

// Mendocino area keywords for client-side filtering
const MENDOCINO_KEYWORDS = [
  'mendocino', 'ukiah', 'fort bragg', 'willits', 'point arena', 
  'boonville', 'hopland', 'redwood valley', 'laytonville', 'covelo',
  'philo', 'navarro', 'albion', 'comptche', 'potter valley'
];

const isMendocinoEvent = (event: BayAreaEvent): boolean => {
  const searchText = `${event.county || ''} ${event.city || ''} ${event.roadwayName || ''} ${event.description || ''}`.toLowerCase();
  return MENDOCINO_KEYWORDS.some(keyword => searchText.includes(keyword.toLowerCase()));
};

export default function BayArea511Content() {
  const [allEvents, setAllEvents] = useState<BayAreaEvent[]>([]);
  const [events, setEvents] = useState<BayAreaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('all');
  const [mendocinoOnly, setMendocinoOnly] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/bay-area-511?limit=1000`);
      const data = await response.json();
      
      if (data.success) {
        setAllEvents(data.data);
        setLastUpdated(new Date(data.timestamp));
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
        alert(`Bay Area 511 poll completed! Found ${data.stats?.mendocinoEvents || 0} new events.`);
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
  }, []);

  // Apply filters client-side
  useEffect(() => {
    let filtered = [...allEvents];
    
    // Apply Mendocino filter
    if (mendocinoOnly) {
      filtered = filtered.filter(event => isMendocinoEvent(event));
    }
    
    // Apply event type filter
    if (eventTypeFilter !== 'all') {
      filtered = filtered.filter(event => 
        event.eventType?.toLowerCase().includes(eventTypeFilter)
      );
    }
    
    setEvents(filtered);
  }, [allEvents, mendocinoOnly, eventTypeFilter]);

  const eventsWithCoords = events.filter(e => e.latitude && e.longitude);
  const activeCount = events.filter(e => e.status === 'active').length;
  const constructionCount = events.filter(e => e.eventType?.toLowerCase().includes('construction')).length;
  const accidentCount = events.filter(e => e.eventType?.toLowerCase().includes('accident')).length;
  const roadworkCount = events.filter(e => e.eventType?.toLowerCase().includes('roadwork')).length;

  const getEventTypeBadge = (type: string) => {
    const lowerType = type?.toLowerCase() || '';
    if (lowerType.includes('accident')) return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    if (lowerType.includes('construction')) return 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300';
    if (lowerType.includes('roadwork')) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
    return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
  };

  // Map events with coordinates
  const mapEvents = eventsWithCoords.map(event => ({
    id: event.id,
    latitude: event.latitude!,
    longitude: event.longitude!,
    roadwayName: event.roadwayName,
    eventType: event.eventType,
    description: `${event.description || ''} ${event.city ? `(${event.city})` : ''}`,
  }));

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bay Area 511 Traffic Events</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {mendocinoOnly ? 'Mendocino County focus' : 'All Bay Area events'} • {events.length} events
            {lastUpdated && ` • Updated ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMendocinoOnly(!mendocinoOnly)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
              mendocinoOnly
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
            {mendocinoOnly ? 'Mendocino Only' : 'All Areas'}
          </button>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
              eventTypeFilter !== 'all'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
            {eventTypeFilter !== 'all' && (
              <span className="ml-1 w-4 h-4 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center">1</span>
            )}
          </button>
          
          <button
            onClick={() => setShowMap(!showMap)}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-1.5"
          >
            <MapPin className="w-3.5 h-3.5" />
            {showMap ? 'Hide Map' : 'Show Map'}
          </button>
          
          <button
            onClick={pollData}
            disabled={isPolling}
            className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin' : ''}`} />
            {isPolling ? 'Polling...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">Filter Events</h3>
            <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Event Type
            </label>
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">All Types</option>
              <option value="accident">Accidents</option>
              <option value="construction">Construction</option>
              <option value="roadwork">Road Work</option>
              <option value="hazard">Hazards</option>
            </select>
          </div>
          
          {eventTypeFilter !== 'all' && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setEventTypeFilter('all')}
                className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear filter
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-950/30 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div><p className="text-emerald-600 dark:text-emerald-400 text-xs">Total</p><p className="text-xl font-bold text-emerald-900 dark:text-emerald-300">{events.length}</p></div>
            <Radio className="w-5 h-5 text-emerald-500 opacity-50" />
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/30 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div><p className="text-red-600 dark:text-red-400 text-xs">Active</p><p className="text-xl font-bold text-red-900 dark:text-red-300">{activeCount}</p></div>
            <AlertTriangle className="w-5 h-5 text-red-500 opacity-50" />
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/30 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div><p className="text-amber-600 dark:text-amber-400 text-xs">Construction</p><p className="text-xl font-bold text-amber-900 dark:text-amber-300">{constructionCount}</p></div>
            <Construction className="w-5 h-5 text-amber-500 opacity-50" />
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/30 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div><p className="text-blue-600 dark:text-blue-400 text-xs">Road Work</p><p className="text-xl font-bold text-blue-900 dark:text-blue-300">{roadworkCount}</p></div>
            <Car className="w-5 h-5 text-blue-500 opacity-50" />
          </div>
        </div>
        
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/30 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div><p className="text-purple-600 dark:text-purple-400 text-xs">On Map</p><p className="text-xl font-bold text-purple-900 dark:text-purple-300">{eventsWithCoords.length}</p></div>
            <MapPin className="w-5 h-5 text-purple-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Map - Zoom level 11 (closer than default 9) */}
      {showMap && (
        <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700">
          {mapEvents.length > 0 ? (
            <SimpleMap events={mapEvents} center={[39.3, -123.5]} zoom={10} height="400px" />
          ) : (
            <div className="h-[400px] bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center">
              <MapPin className="w-12 h-12 text-gray-400 mb-2" />
              <p className="text-gray-500">No events with location data in Mendocino County</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting filters or refresh data</p>
            </div>
          )}
        </div>
      )}

      {/* Events Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roadway</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {events.slice(0, 50).map((event) => (
                <tr key={event.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${getEventTypeBadge(event.eventType)}`}>
                      {event.eventType || 'Unknown'}
                    </span>
                   </td>
                  <td className="px-4 py-3 text-sm font-medium">{event.roadwayName || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">{event.city || event.county || 'N/A'}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs rounded-full ${event.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {event.status || 'unknown'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-md truncate">
                    {event.description?.substring(0, 100) || 'No description'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {events.length > 50 && (
          <div className="px-4 py-3 border-t bg-gray-50 dark:bg-gray-800 text-center text-sm text-gray-500">
            Showing 50 of {events.length} events
          </div>
        )}
      </div>
    </div>
  );
}