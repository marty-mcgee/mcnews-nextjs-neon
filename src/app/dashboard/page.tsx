// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { RefreshCw, Filter, X, Car, Radio, AlertTriangle, Calendar, MapPin } from 'lucide-react';

// Use the same map component that works in 511org
const SimpleMap = dynamic(() => import('@/components/map/simpleMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  ),
});

type SourceFilter = 'all' | 'caltrans' | 'bayarea511' | 'chp-live' | 'chp-historical';

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

export default function DashboardPage() {
  const [allEvents, setAllEvents] = useState<MapEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<MapEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch all data from your database via existing API endpoints
  const fetchAllData = async () => {
    try {
      // Fetch from your existing database-backed API routes
      const [caltransRes, bayAreaRes, chpLiveRes, chpHistoricalRes] = await Promise.all([
        fetch('/api/caltrans/closures/raw'),
        fetch('/api/bay-area-511?limit=1000'),
        fetch('/api/chp-cad?limit=1000'),
        fetch('/api/chp-historical/collisions?limit=1000'),
      ]);
      
      const caltransData = await caltransRes.json();
      const bayAreaData = await bayAreaRes.json();
      const chpLiveData = await chpLiveRes.json();
      const chpHistoricalData = await chpHistoricalRes.json();
      
      const allEventsList: MapEvent[] = [];
      
      // Caltrans events (from your database)
      (caltransData.data || []).forEach((item: any) => {
        if (item.latitude && item.longitude) {
          allEventsList.push({
            id: item.closure_id,
            source: 'caltrans',
            type: item.closure_type || 'Lane Closure',
            location: item.route || 'Unknown',
            description: item.description || '',
            latitude: parseFloat(item.latitude),
            longitude: parseFloat(item.longitude),
            timestamp: item.end_date,
            severity: item.status,
          });
        }
      });
      
      // Bay Area 511 events (from your database)
      (bayAreaData.data || []).forEach((item: any) => {
        if (item.latitude && item.longitude) {
          allEventsList.push({
            id: item.id,
            source: 'bayarea511',
            type: item.eventType || 'Traffic Event',
            location: item.roadwayName || 'Unknown',
            description: item.description || '',
            latitude: parseFloat(item.latitude),
            longitude: parseFloat(item.longitude),
            timestamp: item.startTime,
            severity: item.severity,
          });
        }
      });
      
      // CHP Live events (from your database)
      (chpLiveData.data || []).forEach((item: any) => {
        if (item.latitude && item.longitude) {
          allEventsList.push({
            id: item.id,
            source: 'chp-live',
            type: item.incidentType || 'Incident',
            location: item.location || 'Unknown',
            description: item.details || '',
            latitude: parseFloat(item.latitude),
            longitude: parseFloat(item.longitude),
            timestamp: item.logTime,
          });
        }
      });
      
      // CHP Historical events (from your database)
      (chpHistoricalData.data || []).forEach((item: any) => {
        if (item.latitude && item.longitude) {
          allEventsList.push({
            id: item.id,
            source: 'chp-historical',
            type: 'Collision',
            location: item.location || 'Unknown',
            description: item.primaryFactor || '',
            latitude: parseFloat(item.latitude),
            longitude: parseFloat(item.longitude),
            timestamp: item.collisionDate,
            severity: item.severity,
          });
        }
      });
      
      setAllEvents(allEventsList);
      setLastUpdated(new Date());
      
      // Apply current filter
      if (sourceFilter === 'all') {
        setFilteredEvents(allEventsList);
      } else {
        setFilteredEvents(allEventsList.filter(e => e.source === sourceFilter));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchAllData();
  }, []);

  // Handle filter change
  useEffect(() => {
    if (sourceFilter === 'all') {
      setFilteredEvents(allEvents);
    } else {
      setFilteredEvents(allEvents.filter(e => e.source === sourceFilter));
    }
  }, [sourceFilter, allEvents]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAllData();
  };

  const getSourceCount = (source: string) => {
    return allEvents.filter(e => e.source === source).length;
  };

  // Convert events to the format expected by SimpleMap
  const mapEvents = filteredEvents
    .filter(e => e.latitude && e.longitude)
    .map(e => ({
      id: e.id,
      latitude: e.latitude,
      longitude: e.longitude,
      roadwayName: e.location,
      eventType: `${e.source === 'caltrans' ? '🚧' : e.source === 'bayarea511' ? '🚗' : e.source === 'chp-live' ? '🚨' : '📊'} ${e.type}`,
      description: e.description,
    }));

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Traffic Map</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {filteredEvents.length} events on map from your database
            {sourceFilter !== 'all' && ` (filtered from ${allEvents.length} total)`}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
              sourceFilter !== 'all'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
            {sourceFilter !== 'all' && (
              <span className="ml-1 w-4 h-4 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">1</span>
            )}
          </button>
          
          {/* Refresh Button */}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">Filter by Source</h3>
            <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            <button
              onClick={() => setSourceFilter('all')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                sourceFilter === 'all'
                  ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <MapPin className="w-4 h-4" />
              All ({allEvents.length})
            </button>
            
            <button
              onClick={() => setSourceFilter('caltrans')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                sourceFilter === 'caltrans'
                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Car className="w-4 h-4" />
              Caltrans ({getSourceCount('caltrans')})
            </button>
            
            <button
              onClick={() => setSourceFilter('bayarea511')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                sourceFilter === 'bayarea511'
                  ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Radio className="w-4 h-4" />
              511.org ({getSourceCount('bayarea511')})
            </button>
            
            <button
              onClick={() => setSourceFilter('chp-live')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                sourceFilter === 'chp-live'
                  ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <AlertTriangle className="w-4 h-4" />
              CHP Live ({getSourceCount('chp-live')})
            </button>
            
            <button
              onClick={() => setSourceFilter('chp-historical')}
              className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                sourceFilter === 'chp-historical'
                  ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              <Calendar className="w-4 h-4" />
              CHP Historical ({getSourceCount('chp-historical')})
            </button>
          </div>
          
          {sourceFilter !== 'all' && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setSourceFilter('all')}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-gray-600 dark:text-gray-400">Caltrans - Lane Closures</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          <span className="text-gray-600 dark:text-gray-400">511.org - Traffic Events</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-gray-600 dark:text-gray-400">CHP Live - Active Incidents</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
          <span className="text-gray-600 dark:text-gray-400">CHP Historical - Collisions</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-gray-400">Data from your database</span>
        </div>
      </div>

      {/* Master Map */}
      <SimpleMap 
        events={mapEvents} 
        center={[39.3, -123.5]} 
        zoom={9} 
        // height="600px"
      />

      {/* Source Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Caltrans</span>
            </div>
            <span className="text-lg font-bold text-blue-700 dark:text-blue-400">{getSourceCount('caltrans')}</span>
          </div>
        </div>
        
        <div className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">511.org</span>
            </div>
            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{getSourceCount('bayarea511')}</span>
          </div>
        </div>
        
        <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-700 dark:text-red-400">CHP Live</span>
            </div>
            <span className="text-lg font-bold text-red-700 dark:text-red-400">{getSourceCount('chp-live')}</span>
          </div>
        </div>
        
        <div className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-400">CHP Historical</span>
            </div>
            <span className="text-lg font-bold text-purple-700 dark:text-purple-400">{getSourceCount('chp-historical')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}