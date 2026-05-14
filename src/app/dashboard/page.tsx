// app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';

// Types
interface Closure {
  closureId: number;
  district: number;
  route: string;
  direction: string;
  closureType: string;
  lanesAffected: string;
  description: string;
  startDate: string;
  endDate: string;
  status: string;
  hoursRemaining: number | null;
  isExpiringSoon: boolean;
}

interface DashboardStats {
  overview: {
    total_active: number;
    total_completed: number;
    unique_routes: number;
    new_last_24h: number;
  };
  by_district: Array<{ district: number; total: number; active: number }>;
  weekly_trend: Array<{ date: string; new_closures: number }>;
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch both stats and closures in parallel
        const [statsRes, closuresRes] = await Promise.all([
          fetch('/api/dashboard/stats'),
          fetch(`/api/closures?${selectedDistrict ? `district=${selectedDistrict}&` : ''}limit=20&status=active`)
        ]);
        
        if (!statsRes.ok) throw new Error('Failed to fetch stats');
        if (!closuresRes.ok) throw new Error('Failed to fetch closures');
        
        const statsData = await statsRes.json();
        const closuresData = await closuresRes.json();
        
        if (statsData.success) setStats(statsData.data);
        if (closuresData.success) setClosures(closuresData.data);
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
        console.error('Dashboard error:', err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [selectedDistrict, refreshKey]);

  // Manual refresh function
  const refreshData = () => setRefreshKey(prev => prev + 1);

  // Trigger polling
  const triggerPoll = async () => {
    try {
      const response = await fetch('/api/poll?action=poll');
      const data = await response.json();
      if (data.success) {
        alert(`Poll completed! Found ${data.stats.totalClosures} closures`);
        refreshData();
      }
    } catch (err) {
      alert('Poll failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-xl mb-2">Loading dashboard data...</div>
          <div className="text-sm text-gray-500">Fetching from database</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <h2 className="text-red-600 text-xl font-semibold mb-2">Error Loading Dashboard</h2>
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={refreshData}
            className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Caltrans Lane Closure Monitor
              </h1>
              <p className="text-gray-500 mt-1">
                Real-time traffic closure data from California highways
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={triggerPoll}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Fetch Latest Data
              </button>
              <button
                onClick={refreshData}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Refresh View
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Active Closures</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats?.overview.total_active || 0}
                </p>
              </div>
              <div className="bg-blue-100 rounded-full p-3">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Completed (Total)</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats?.overview.total_completed || 0}
                </p>
              </div>
              <div className="bg-green-100 rounded-full p-3">
                <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">Unique Routes</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats?.overview.unique_routes || 0}
                </p>
              </div>
              <div className="bg-purple-100 rounded-full p-3">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm">New (Last 24h)</p>
                <p className="text-3xl font-bold text-gray-900">
                  {stats?.overview.new_last_24h || 0}
                </p>
              </div>
              <div className="bg-yellow-100 rounded-full p-3">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* District Filter */}
        <div className="bg-white rounded-lg shadow mb-8 p-4">
          <div className="flex items-center gap-4">
            <label className="font-medium text-gray-700">Filter by District:</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Districts</option>
              {stats?.by_district.map(d => (
                <option key={d.district} value={d.district}>
                  District {d.district} ({d.active} active)
                </option>
              ))}
            </select>
            {selectedDistrict && (
              <button
                onClick={() => setSelectedDistrict('')}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Clear filter
              </button>
            )}
          </div>
        </div>

        {/* Active Closures Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b bg-gray-50">
            <h2 className="text-xl font-semibold text-gray-900">Active Lane Closures</h2>
          </div>
          
          {closures.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg">No active closures found</p>
              <p className="text-sm mt-2">
                {selectedDistrict ? `No closures in District ${selectedDistrict}` : 'Run a poll to fetch data from Caltrans'}
              </p>
              <button
                onClick={triggerPoll}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Fetch Data Now
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Route
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      District
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Lanes
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      End Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {closures.map((closure) => (
                    <tr key={closure.closureId} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {closure.route}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {closure.district}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          closure.closureType.includes('Closure') 
                            ? 'bg-red-100 text-red-800'
                            : closure.closureType.includes('Work')
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}>
                          {closure.closureType}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                        {closure.lanesAffected}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm">
                          <div className="text-gray-900">
                            {new Date(closure.endDate).toLocaleDateString()}
                          </div>
                          {closure.isExpiringSoon && (
                            <div className="text-xs text-orange-600 font-semibold">
                              {Math.round(closure.hoursRemaining || 0)}h remaining
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          closure.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {closure.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 max-w-md">
                        <div className="truncate" title={closure.description}>
                          {closure.description?.substring(0, 100)}
                          {closure.description?.length > 100 ? '...' : ''}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          
          {/* Footer with info */}
          <div className="px-6 py-4 border-t bg-gray-50 text-sm text-gray-500">
            <div className="flex justify-between items-center">
              <div>
                Showing {closures.length} active closures
                {selectedDistrict && ` in District ${selectedDistrict}`}
              </div>
              <div>
                Last updated: {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </div>

        {/* District Breakdown Section */}
        {stats?.by_district && stats.by_district.length > 0 && (
          <div className="mt-8 bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <h2 className="text-xl font-semibold text-gray-900">Active Closures by District</h2>
            </div>
            <div className="p-6">
              <div className="space-y-3">
                {stats.by_district.map((district) => (
                  <div key={district.district}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">District {district.district}</span>
                      <span className="text-gray-600">{district.active} active / {district.total} total</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 rounded-full h-2 transition-all duration-500"
                        style={{ 
                          width: `${stats.overview.total_active > 0 
                            ? (district.active / stats.overview.total_active) * 100 
                            : 0}%` 
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
