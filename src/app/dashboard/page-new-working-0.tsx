// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamicImport from 'next/dynamic';
import { RefreshCw, Filter, X, Car, Radio, AlertTriangle, Calendar, MapPin, Download, Calendar as CalendarIcon, ChevronDown } from 'lucide-react';

export const dynamic = 'force-dynamic';  // Add this line

// Use the same map component that works in 511org
const SimpleMap = dynamicImport(() => import('@/components/map/simpleMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>
  ),
});

type SourceFilter = 'all' | 'caltrans' | 'bayarea511' | 'chp-live' | 'chp-historical';
type DateRange = '1d' | '7d' | '30d' | 'all';

interface MapEvent {
  id: string;
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
  const router = useRouter();
  const [allEvents, setAllEvents] = useState<MapEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<MapEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [showFilters, setShowFilters] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [exporting, setExporting] = useState(false);

  // Fetch all data from your database
  const fetchAllData = useCallback(async () => {
    try {
      const [caltransRes, bayAreaRes, chpLiveRes, chpHistoricalRes] = await Promise.all([
        fetch('/api/caltrans/closures/raw'),
        fetch('/api/bay-area-511?limit=2000'),
        fetch('/api/chp-cad?limit=2000'),
        fetch('/api/chp-historical/collisions?limit=2000'),
      ]);
      
      const caltransData = await caltransRes.json();
      const bayAreaData = await bayAreaRes.json();
      const chpLiveData = await chpLiveRes.json();
      const chpHistoricalData = await chpHistoricalRes.json();
      
      const allEventsList: MapEvent[] = [];
      
      // Caltrans events
      (caltransData.data || []).forEach((item: any) => {
        if (item.latitude && item.longitude) {
          allEventsList.push({
            id: `caltrans_${item.closure_id}`,
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
      
      // Bay Area 511 events
      (bayAreaData.data || []).forEach((item: any) => {
        // The API returns latitude/longitude directly, not nested
        if (item.latitude && item.longitude) {
          allEventsList.push({
            id: `bayarea_${item.id}`,
            source: 'bayarea511',
            type: item.eventType || item.event_type || 'Traffic Event',
            location: item.roadwayName || item.roadway_name || 'Unknown',
            description: item.description || `${item.eventType} on ${item.roadwayName}`,
            latitude: typeof item.latitude === 'string' ? parseFloat(item.latitude) : item.latitude,
            longitude: typeof item.longitude === 'string' ? parseFloat(item.longitude) : item.longitude,
            timestamp: item.startTime || item.created_at,
            severity: item.severity,
          });
        }
      });
      
      // CHP Live events
      (chpLiveData.data || []).forEach((item: any) => {
        if (item.latitude && item.longitude) {
          allEventsList.push({
            id: `chplive_${item.id}`,
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
      
      // CHP Historical events
      (chpHistoricalData.data || []).forEach((item: any) => {
        if (item.latitude && item.longitude) {
          allEventsList.push({
            id: `chphist_${item.id}`,
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
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Apply filters
  const applyFilters = useCallback(() => {
    let filtered = [...allEvents];
    
    // Filter by source
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(e => e.source === sourceFilter);
    }
    
    // Filter by date range
    if (dateRange !== 'all' && dateRange !== '1d' && dateRange !== '7d' && dateRange !== '30d') {
      const now = new Date();
      let cutoffDate: Date;
      switch (dateRange) {
        case '1d':
          cutoffDate = new Date(now.setDate(now.getDate() - 1));
          break;
        case '7d':
          cutoffDate = new Date(now.setDate(now.getDate() - 7));
          break;
        case '30d':
          cutoffDate = new Date(now.setDate(now.getDate() - 30));
          break;
        default:
          cutoffDate = new Date(0);
      }
      filtered = filtered.filter(e => e.timestamp ? new Date(e.timestamp) > cutoffDate : true);
    }
    
    setFilteredEvents(filtered);
  }, [allEvents, sourceFilter, dateRange]);

  // Initial load
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchAllData();
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAllData]);

  // Apply filters when dependencies change
  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  const handleRefresh = async () => {
    console.log('Refresh button clicked');
    setRefreshing(true);
    await fetchAllData();
    console.log('Fetch completed, allEvents length:', allEvents.length);
    // Force filter re-application
    applyFilters();
    console.log('Refreshing complete');
    setRefreshing(false);
  };

  const getSourceCount = (source: string) => {
    return allEvents.filter(e => e.source === source).length;
  };

  // Export to CSV
  const exportToCSV = () => {
    setExporting(true);
    try {
      const headers = ['Source', 'Type', 'Location', 'Description', 'Latitude', 'Longitude', 'Timestamp', 'Severity'];
      const csvRows = [headers.join(',')];
      
      filteredEvents.forEach(event => {
        const row = [
          `"${event.source}"`,
          `"${event.type.replace(/"/g, '""')}"`,
          `"${event.location.replace(/"/g, '""')}"`,
          `"${event.description?.replace(/"/g, '""') || ''}"`,
          event.latitude,
          event.longitude,
          event.timestamp || '',
          event.severity || '',
        ];
        csvRows.push(row.join(','));
      });
      
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `traffic-events-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  // Handle marker click to navigate to service page
  const handleMarkerClick = (event: MapEvent) => {
    switch (event.source) {
      case 'caltrans':
        router.push('/dashboard/caltrans');
        break;
      case 'bayarea511':
        router.push('/dashboard/511org');
        break;
      case 'chp-live':
        router.push('/dashboard/chp-live');
        break;
      case 'chp-historical':
        router.push('/dashboard/chp-historical');
        break;
    }
  };

  // Convert events to map format with click handler
  const mapEvents = filteredEvents
    .filter(e => e.latitude && e.longitude)
    .map(e => ({
      id: e.id,
      latitude: e.latitude,
      longitude: e.longitude,
      roadwayName: e.location,
      eventType: `${e.source === 'caltrans' ? '🚧' : e.source === 'bayarea511' ? '🚗' : e.source === 'chp-live' ? '🚨' : '📊'} ${e.type}`,
      description: e.description,
      onClick: () => handleMarkerClick(e),
    }));

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const totalEvents = filteredEvents.length;
  const totalAllEvents = allEvents.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Traffic Map</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {totalEvents} events on map
            {sourceFilter !== 'all' && ` (filtered from ${totalAllEvents} total)`}
            {lastUpdated && ` • Updated ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Auto-refresh Toggle */}
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
              autoRefresh 
                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-pulse' : ''}`} />
            Auto {autoRefresh ? 'ON' : 'OFF'}
          </button>
          
          {/* Export Button */}
          <button
            onClick={exportToCSV}
            disabled={exporting || filteredEvents.length === 0}
            className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? 'Exporting...' : 'Export CSV'}
          </button>
          
          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors flex items-center gap-1.5 ${
              sourceFilter !== 'all' || dateRange !== '7d'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
            }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Filter
            {(sourceFilter !== 'all' || dateRange !== '7d') && (
              <span className="ml-1 w-4 h-4 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center">
                {(sourceFilter !== 'all' ? 1 : 0) + (dateRange !== '7d' ? 1 : 0)}
              </span>
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
            <h3 className="font-semibold text-gray-900 dark:text-white">Filters</h3>
            <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-600">
              <X className="w-4 h-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Source Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Data Source
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  onClick={() => setSourceFilter('all')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    sourceFilter === 'all'
                      ? 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <MapPin className="w-4 h-4" />
                  All ({totalAllEvents})
                </button>
                
                <button
                  onClick={() => setSourceFilter('caltrans')}
                  className={`px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    sourceFilter === 'caltrans'
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
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
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
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
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
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
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Historical ({getSourceCount('chp-historical')})
                </button>
              </div>
            </div>
            
            {/* Date Range Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Date Range
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setDateRange('1d')}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    dateRange === '1d'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  Last 24h
                </button>
                <button
                  onClick={() => setDateRange('7d')}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    dateRange === '7d'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  Last 7 days
                </button>
                <button
                  onClick={() => setDateRange('30d')}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    dateRange === '30d'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  Last 30 days
                </button>
                <button
                  onClick={() => setDateRange('all')}
                  className={`px-4 py-2 rounded-lg text-sm transition-colors ${
                    dateRange === 'all'
                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                      : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200'
                  }`}
                >
                  All time
                </button>
              </div>
            </div>
          </div>
          
          {(sourceFilter !== 'all' || dateRange !== '7d') && (
            <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
              <button
                onClick={() => {
                  setSourceFilter('all');
                  setDateRange('7d');
                }}
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
          <span className="text-gray-600 dark:text-gray-400">Caltrans - Click to view</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          <span className="text-gray-600 dark:text-gray-400">511.org - Click to view</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-gray-600 dark:text-gray-400">CHP Live - Click to view</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
          <span className="text-gray-600 dark:text-gray-400">CHP Historical - Click to view</span>
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          <span className="text-gray-400">Click any marker to see service details</span>
        </div>
      </div>

      {/* Master Map */}
      <SimpleMap 
        events={mapEvents} 
        center={[39.3, -123.5]} 
        zoom={10} 
        height="600px"
        onMarkerClick={(event: any) => {
          if (event.onClick) event.onClick();
        }}
      />

      {/* Source Summary Cards - Clickable */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <button
          onClick={() => router.push('/dashboard/caltrans')}
          className="bg-blue-50 dark:bg-blue-950/20 rounded-lg p-3 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors text-left"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-400">Caltrans</span>
            </div>
            <span className="text-lg font-bold text-blue-700 dark:text-blue-400">{getSourceCount('caltrans')}</span>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">Click to view details →</p>
        </button>
        
        <button
          onClick={() => router.push('/dashboard/511org')}
          className="bg-emerald-50 dark:bg-emerald-950/20 rounded-lg p-3 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors text-left"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">511.org</span>
            </div>
            <span className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{getSourceCount('bayarea511')}</span>
          </div>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">Click to view details →</p>
        </button>
        
        <button
          onClick={() => router.push('/dashboard/chp-live')}
          className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-left"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-700 dark:text-red-400">CHP Live</span>
            </div>
            <span className="text-lg font-bold text-red-700 dark:text-red-400">{getSourceCount('chp-live')}</span>
          </div>
          <p className="text-xs text-red-600 dark:text-red-400 mt-1">Click to view details →</p>
        </button>
        
        <button
          onClick={() => router.push('/dashboard/chp-historical')}
          className="bg-purple-50 dark:bg-purple-950/20 rounded-lg p-3 hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors text-left"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-medium text-purple-700 dark:text-purple-400">CHP Historical</span>
            </div>
            <span className="text-lg font-bold text-purple-700 dark:text-purple-400">{getSourceCount('chp-historical')}</span>
          </div>
          <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">Click to view details →</p>
        </button>
      </div>
    </div>
  );
}