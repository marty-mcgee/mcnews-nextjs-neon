// src/app/dashboard/511org/511orgContent.tsx
'use client';

import { useEffect, useState } from 'react';

interface BayAreaEvent {
  id: number;
  roadwayName: string;
  eventType: string;
  directionOfTravel: string;
  lanesAffected: string;
  description: string;
}

export default function BayArea511Content() {
  const [events, setEvents] = useState<BayAreaEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/bay-area-511?limit=100');
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setEvents(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch Bay Area events:', error);
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
        alert(`Bay Area 511.org poll completed! Found ${data.stats?.totalFetched || 0} events.`);
        await fetchData();
      } else {
        alert('Bay Area poll failed: ' + (data.error || 'Unknown error'));
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

  const getTypeColor = (type: string) => {
    const lowerType = type?.toLowerCase() || '';
    if (lowerType.includes('accident')) return 'bg-red-100 text-red-800';
    if (lowerType.includes('roadwork')) return 'bg-yellow-100 text-yellow-800';
    if (lowerType.includes('closure')) return 'bg-orange-100 text-orange-800';
    return 'bg-blue-100 text-blue-800';
  };

  return (
    <div>
      {/* Header with Refresh Button */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Bay Area Traffic Events</h2>
          <p className="text-sm text-gray-500">Official real-time traffic data from 511.org</p>
        </div>
        <button
          onClick={pollData}
          disabled={isPolling}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
        >
          {isPolling ? 'Polling...' : 'Refresh Data'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Total Events</p>
              <p className="text-3xl font-bold text-gray-900">{events.length}</p>
            </div>
            <div className="bg-green-100 rounded-full p-3">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Accidents</p>
              <p className="text-3xl font-bold text-gray-900">
                {events.filter(e => e.eventType?.toLowerCase().includes('accident')).length}
              </p>
            </div>
            <div className="bg-red-100 rounded-full p-3">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Road Work</p>
              <p className="text-3xl font-bold text-gray-900">
                {events.filter(e => e.eventType?.toLowerCase().includes('roadwork')).length}
              </p>
            </div>
            <div className="bg-yellow-100 rounded-full p-3">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 text-sm">Data Source</p>
              <p className="text-xl font-bold text-gray-900">511.org</p>
              <p className="text-xs text-gray-400">MTC</p>
            </div>
            <div className="bg-blue-100 rounded-full p-3">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Events Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
            <p className="mt-2 text-gray-500">Loading Bay Area events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-lg">No events found</p>
            <p className="text-sm mt-2">Click "Refresh Data" to fetch current events from 511.org</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Roadway</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Direction</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lanes</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {events.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {event.roadwayName || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs rounded-full ${getTypeColor(event.eventType)}`}>
                        {event.eventType || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {event.directionOfTravel || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {event.lanesAffected || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-md">
                      <div className="truncate" title={event.description || ''}>
                        {event.description?.substring(0, 100) || 'N/A'}
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
              <span>Data source: 511.org | Metropolitan Transportation Commission (MTC)</span>
            </div>
            <div>Showing {events.length} events</div>
          </div>
        </div>
      </div>
    </div>
  );
}