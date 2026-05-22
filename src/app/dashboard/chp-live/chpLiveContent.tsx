// src/app/dashboard/chp-live/chpLiveContent.tsx
'use client';

import { useEffect, useState } from 'react';

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
      
      // Build URL with filters
      let url = '/api/chp-cad?limit=200';
      if (selectedCounty && selectedCounty !== 'all') {
        url += `&county=${encodeURIComponent(selectedCounty)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setIncidents(data.data);
        setTotalCount(data.count || data.data.length);
        
        // Extract unique counties for filter
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
      const response = await fetch('/api/poll/chp-cad?action=poll');
      const data = await response.json();
      if (data.success) {
        // Your API returns stats with totalFetched and newCount
        const newCount = data.stats?.newCount || 0;
        const totalFetched = data.stats?.totalFetched || 0;
        alert(`CHP Live poll completed! Found ${newCount} new incidents (${totalFetched} total fetched).`);
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
    if (lowerType.includes('sig')) return 'bg-red-100 text-red-800';
    if (lowerType.includes('closure')) return 'bg-orange-100 text-orange-800';
    if (lowerType.includes('fire')) return 'bg-red-100 text-red-800';
    if (lowerType.includes('hazard')) return 'bg-yellow-100 text-yellow-800';
    if (lowerType.includes('accident')) return 'bg-red-100 text-red-800';
    if (lowerType.includes('roadwork')) return 'bg-yellow-100 text-yellow-800';
    return 'bg-blue-100 text-blue-800';
  };

  if (loading) {
    return (
      <div className="p-12 text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
        <p className="mt-2 text-gray-500">Loading CHP live incidents...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center text-red-500">
        <p>{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-red-600 text-white rounded">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Header with Refresh Button */}
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">CHP Live Incidents</h2>
          <p className="text-sm text-gray-500">Real-time incidents from CHP CAD system (Total: {totalCount} incidents)</p>
        </div>
        <button
          onClick={pollData}
          disabled={isPolling}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
        >
          {isPolling ? 'Polling...' : 'Refresh Data'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Incidents</p>
              <p className="text-3xl font-bold text-gray-900">{totalCount}</p>
            </div>
            <div className="bg-red-100 rounded-full p-3">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Active Alerts</p>
              <p className="text-3xl font-bold text-gray-900">
                {incidents.filter(i => i.status === 'active').length}
              </p>
            </div>
            <div className="bg-orange-100 rounded-full p-3">
              <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Counties</p>
              <p className="text-3xl font-bold text-gray-900">{availableCounties.length}</p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Data Source</p>
              <p className="text-xl font-bold text-gray-900">CHP CAD</p>
              <p className="text-xs text-gray-400">Real-time feed</p>
            </div>
            <div className="bg-purple-100 rounded-full p-3">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* County Filter */}
      {availableCounties.length > 0 && (
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <label className="font-medium text-gray-700">Filter by County:</label>
            <select
              value={selectedCounty}
              onChange={(e) => setSelectedCounty(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">All Counties</option>
              {availableCounties.map((county) => (
                <option key={county} value={county}>{county}</option>
              ))}
            </select>
            {selectedCounty && (
              <button
                onClick={() => setSelectedCounty('')}
                className="text-sm text-red-600 hover:text-red-800"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>
      )}

      {/* Incidents Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Live Incidents</h3>
          <p className="text-sm text-gray-500">Showing {incidents.length} of {totalCount} incidents</p>
        </div>

        {incidents.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg">No incidents found</p>
            <p className="text-sm mt-2">Click "Refresh Data" to fetch current incidents from CHP CAD.</p>
            <button
              onClick={pollData}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Fetch Live Incidents
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Time</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">County</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {incidents.map((incident) => (
                  <tr key={incident.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {incident.logTime ? new Date(incident.logTime).toLocaleTimeString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {incident.county || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getIncidentTypeBadge(incident.incidentType)}`}>
                        {incident.incidentType || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs">
                      <div className="truncate" title={incident.location || ''}>
                        {incident.location || 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {incident.city || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-md">
                      <div className="truncate" title={incident.details || ''}>
                        {incident.details?.substring(0, 100) || 'N/A'}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        <div className="px-6 py-4 border-t bg-gray-50 text-sm text-gray-500">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Data source: CHP CAD Public Feed (unofficial)</span>
            </div>
            <div>Auto-refreshes every 5 minutes</div>
          </div>
        </div>
      </div>
    </div>
  );
}