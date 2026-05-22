// src/app/dashboard/page.tsx (Redirect to master view)
'use client';

import { useEffect, useState } from 'react';
import MasterMap, { MasterMapEvent } from '@/components/map/masterMap';
import { masterDataService } from '@/lib/services/MasterDataService';
import { RefreshCw, Activity, TrendingUp, MapPin, AlertTriangle, Car, Construction, Radio, Calendar } from 'lucide-react';

type SourceFilter = 'all' | 'caltrans' | 'bayarea511' | 'chp-live' | 'chp-historical';

export default function DashboardPage() {
  const [events, setEvents] = useState<MasterMapEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<MasterMapEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [summary, setSummary] = useState({
    total: 0,
    bySource: {} as Record<string, number>,
    byType: {} as Record<string, number>,
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await masterDataService.fetchAllEvents();
      setEvents(data.events);
      setSummary(data.summary);
      setLastUpdated(data.lastUpdated);
      
      // Apply current filter
      if (sourceFilter === 'all') {
        setFilteredEvents(data.events);
      } else {
        setFilteredEvents(data.events.filter(e => e.source === sourceFilter));
      }
    } catch (err) {
      console.error('Error fetching master data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (sourceFilter === 'all') {
      setFilteredEvents(events);
    } else {
      setFilteredEvents(events.filter(e => e.source === sourceFilter));
    }
  }, [sourceFilter, events]);

  const getSourceColor = (source: string) => {
    switch (source) {
      case 'caltrans': return 'bg-blue-500';
      case 'bayarea511': return 'bg-emerald-500';
      case 'chp-live': return 'bg-red-500';
      case 'chp-historical': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'caltrans': return <Car className="w-4 h-4" />;
      case 'bayarea511': return <Radio className="w-4 h-4" />;
      case 'chp-live': return <AlertTriangle className="w-4 h-4" />;
      case 'chp-historical': return <Calendar className="w-4 h-4" />;
      default: return <MapPin className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3" />
        <p>{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg">
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">California Traffic Monitor</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Unified view of all traffic events • {summary.total} active events
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-xs text-gray-400">
            {lastUpdated && `Last updated: ${lastUpdated.toLocaleTimeString()}`}
          </div>
          <button
            onClick={refreshData}
            disabled={refreshing}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh All'}
          </button>
        </div>
      </div>

      {/* Source Filter Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <button
          onClick={() => setSourceFilter('all')}
          className={`p-4 rounded-xl transition-all border ${
            sourceFilter === 'all'
              ? 'bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-700 border-gray-300 dark:border-gray-600 shadow-md'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 dark:text-gray-400 text-sm">All Sources</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total}</p>
            </div>
            <Activity className="w-8 h-8 text-gray-400 opacity-50" />
          </div>
        </button>

        <button
          onClick={() => setSourceFilter('caltrans')}
          className={`p-4 rounded-xl transition-all border ${
            sourceFilter === 'caltrans'
              ? 'bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 border-blue-300 dark:border-blue-700 shadow-md'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 dark:text-blue-400 text-sm">Caltrans</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{summary.bySource?.caltrans || 0}</p>
            </div>
            <Car className="w-8 h-8 text-blue-400 opacity-50" />
          </div>
        </button>

        <button
          onClick={() => setSourceFilter('bayarea511')}
          className={`p-4 rounded-xl transition-all border ${
            sourceFilter === 'bayarea511'
              ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 border-emerald-300 dark:border-emerald-700 shadow-md'
              : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:shadow-md'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-emerald-600 dark:text-emerald-400 text-sm">511.org</p>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">{summary.bySource?.bayarea511 || 0}</p>
            </div>
            <Radio className="w-8 h-8 text-emerald-400 opacity-50" />
          </div>
        </button>

        <div className="grid grid-cols-2 gap-4">
          <button
            onClick={() => setSourceFilter('chp-live')}
            className={`p-4 rounded-xl transition-all border ${
              sourceFilter === 'chp-live'
                ? 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/30 dark:to-red-800/30 border-red-300 dark:border-red-700 shadow-md'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:shadow-md'
            }`}
          >
            <div>
              <p className="text-red-600 dark:text-red-400 text-sm">CHP Live</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-300">{summary.bySource?.['chp-live'] || 0}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-400 opacity-50 mt-2" />
          </button>

          <button
            onClick={() => setSourceFilter('chp-historical')}
            className={`p-4 rounded-xl transition-all border ${
              sourceFilter === 'chp-historical'
                ? 'bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-purple-300 dark:border-purple-700 shadow-md'
                : 'bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-700 hover:shadow-md'
            }`}
          >
            <div>
              <p className="text-purple-600 dark:text-purple-400 text-sm">CHP Historical</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-300">{summary.bySource?.['chp-historical'] || 0}</p>
            </div>
            <Calendar className="w-8 h-8 text-purple-400 opacity-50 mt-2" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="mb-4 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500"></div>
          <span className="text-xs text-gray-600 dark:text-gray-400">Caltrans</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
          <span className="text-xs text-gray-600 dark:text-gray-400">511.org</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-xs text-gray-600 dark:text-gray-400">CHP Live</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
          <span className="text-xs text-gray-600 dark:text-gray-400">CHP Historical</span>
        </div>
      </div>

      {/* Master Map */}
      <MasterMap 
        events={filteredEvents} 
        center={[39.3, -123.5]} 
        zoom={9} 
        height="500px"
        onEventClick={(event) => {
          console.log('Event clicked:', event);
          // You can add navigation to detailed view here
        }}
      />

      {/* Event List Summary */}
      <div className="mt-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Events by Source</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(summary.bySource).map(([source, count]) => (
            <div key={source} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${getSourceColor(source)}`} />
                <span className="text-sm capitalize text-gray-700 dark:text-gray-300">
                  {source === 'bayarea511' ? '511.org' : source}
                </span>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{count}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}