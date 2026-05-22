// src/app/dashboard/chp-live/chpLiveContent.tsx
'use client';

import { useEffect, useState } from 'react';
import { 
  RefreshCw, 
  AlertTriangle, 
  MapPin, 
  Clock,
  Building2,
  TrendingUp
} from 'lucide-react';

interface CHPIncident {
  id: number;
  sourceId: string;
  incidentType: string;
  location: string;
  city: string;
  county: string;
  logTime: string;
  details: string;
  status: string;
  centerName?: string;
}

export default function CHPLiveContent() {
  const [incidents, setIncidents] = useState<CHPIncident[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [selectedCounty, setSelectedCounty] = useState<string>('');
  const [availableCounties, setAvailableCounties] = useState<string[]>([]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let url = '/api/chp-cad?limit=200';
      if (selectedCounty && selectedCounty !== 'all') {
        url += `&county=${encodeURIComponent(selectedCounty)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setIncidents(data.data);
        setTotalCount(data.count || data.data.length);
        const counties = [...new Set(data.data.map((inc: CHPIncident) => inc.county).filter(Boolean))];
        setAvailableCounties(counties.sort());
      } else {
        setError('Failed to load CHP incidents');
      }
    } catch (err) {
      console.error('Error fetching CHP incidents:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const pollData = async () => {
    setIsPolling(true);
    try {
      const response = await fetch('/api/chp-cad/poll?action=poll');
      const data = await response.json();
      if (data.success) {
        const newCount = data.stats?.newCount || 0;
        alert(`CHP Live poll completed! Found ${newCount} new incidents.`);
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
  }, [selectedCounty]);

  const getIncidentTypeBadge = (type: string) => {
    const lowerType = type?.toLowerCase() || '';
    if (lowerType.includes('sig')) return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    if (lowerType.includes('accident')) return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    if (lowerType.includes('fire')) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
    if (lowerType.includes('hazard')) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3" />
        <p>{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg">
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">CHP Live Incidents</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Real-time incidents from CHP CAD system</p>
        </div>
        <button
          onClick={pollData}
          disabled={isPolling}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isPolling ? 'animate-spin' : ''}`} />
          {isPolling ? 'Fetching...' : 'Refresh Data'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">Total Incidents</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-300">{totalCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-500 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-600 dark:text-orange-400 text-sm font-medium">Active Alerts</p>
              <p className="text-2xl font-bold text-orange-900 dark:text-orange-300">
                {incidents.filter(i => i.status === 'active').length}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-orange-500 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">Counties</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{availableCounties.length}</p>
            </div>
            <Building2 className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 dark:text-purple-400 text-sm font-medium">Data Source</p>
              <p className="text-lg font-bold text-purple-900 dark:text-purple-300">CHP CAD</p>
              <p className="text-xs text-purple-600 dark:text-purple-400">Real-time</p>
            </div>
            <Clock className="w-8 h-8 text-purple-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* County Filter */}
      {availableCounties.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-500" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by County:</label>
            </div>
            <select
              value={selectedCounty}
              onChange={(e) => setSelectedCounty(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-red-500"
            >
              <option value="">All Counties</option>
              {availableCounties.map((county) => (
                <option key={county} value={county}>{county}</option>
              ))}
            </select>
            {selectedCounty && (
              <button
                onClick={() => setSelectedCounty('')}
                className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Incidents Grid */}
      {incidents.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg">No incidents found</p>
          <p className="text-sm mt-1">Click refresh to fetch current incidents from CHP CAD</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {incidents.map((incident) => (
            <div key={incident.id} className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 hover:shadow-md transition-shadow border border-gray-100 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-lg bg-white dark:bg-gray-900 shadow-sm flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{incident.incidentType || 'Unknown'}</h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-0.5">{incident.location}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className={`px-2 py-1 text-xs rounded-full ${getIncidentTypeBadge(incident.incidentType)}`}>
                        {incident.incidentType || 'Event'}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                    {incident.county && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {incident.county}
                      </span>
                    )}
                    {incident.city && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {incident.city}
                      </span>
                    )}
                    {incident.logTime && (
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(incident.logTime).toLocaleTimeString()}
                      </span>
                    )}
                    {incident.centerName && (
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3" />
                        {incident.centerName} Center
                      </span>
                    )}
                  </div>
                  {incident.details && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">{incident.details}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}