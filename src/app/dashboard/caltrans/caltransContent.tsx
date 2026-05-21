// src/app/dashboard/caltrans/caltransContent.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

const ClosureMap = dynamic(
  () => import('@/components/ClosureMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <p className="text-gray-500">Loading map...</p>
        </div>
      </div>
    )
  }
);

interface Closure {
  closure_id: number;
  district: number;
  route: string;
  closure_type: string;
  status: string;
  end_date: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
}

type ViewType = 'table' | 'map' | 'combined';

export default function CaltransContent() {
  const router = useRouter();
  
  const [viewType, setViewType] = useState<ViewType>('combined');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    async function fetchClosures() {
      try {
        setLoading(true);
        const response = await fetch('/api/closures/raw');
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setClosures(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch closures:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchClosures();
  }, []);

  const pollCaltrans = async () => {
    setIsPolling(true);
    try {
      const response = await fetch('/api/poll?action=poll');
      const data = await response.json();
      if (data.success) {
        alert(`Caltrans poll completed! Found ${data.stats?.totalClosures || 0} closures.`);
        const refresh = await fetch('/api/closures/raw');
        const refreshData = await refresh.json();
        if (refreshData.success) setClosures(refreshData.data);
      } else {
        alert('Caltrans poll failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Poll failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsPolling(false);
    }
  };

  const getFilteredClosures = useCallback(() => {
    let filtered = [...closures];
    if (selectedDistrict) {
      filtered = filtered.filter(c => c.district === parseInt(selectedDistrict));
    }
    return filtered;
  }, [closures, selectedDistrict]);

  const getDistrictStats = useCallback(() => {
    const districtMap = new Map<number, { active: number; total: number }>();
    closures.forEach(closure => {
      const district = closure.district;
      if (!districtMap.has(district)) {
        districtMap.set(district, { active: 0, total: 0 });
      }
      const stats = districtMap.get(district)!;
      stats.total++;
      if (closure.status === 'active') stats.active++;
    });
    return Array.from(districtMap.entries())
      .map(([district, stats]) => ({ district, active: stats.active, total: stats.total }))
      .sort((a, b) => a.district - b.district);
  }, [closures]);

  const filteredClosures = getFilteredClosures();
  const districtStats = getDistrictStats();
  const closuresWithCoordinates = filteredClosures.filter(c => c.latitude && c.longitude);
  const activeClosures = closures.filter(c => c.status === 'active');

  return (
    <div>
      {/* Header with Refresh Button */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Caltrans Lane Closures</h2>
          <p className="text-sm text-gray-500">Real-time lane closures from Caltrans CWWP2 API</p>
        </div>
        <button
          onClick={pollCaltrans}
          disabled={isPolling}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
        >
          {isPolling ? 'Polling...' : 'Refresh Data'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
          <p className="text-gray-500 text-sm">Total Records</p>
          <p className="text-3xl font-bold text-gray-900">{closures.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
          <p className="text-gray-500 text-sm">Active Closures</p>
          <p className="text-3xl font-bold text-gray-900">{activeClosures.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
          <p className="text-gray-500 text-sm">Unique Routes</p>
          <p className="text-3xl font-bold text-gray-900">{new Set(closures.map(c => c.route)).size}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-500">
          <p className="text-gray-500 text-sm">On Map</p>
          <p className="text-3xl font-bold text-gray-900">{closuresWithCoordinates.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-500">
          <p className="text-gray-500 text-sm">Completed</p>
          <p className="text-3xl font-bold text-gray-900">{closures.filter(c => c.status === 'completed').length}</p>
        </div>
      </div>

      {/* View Toggle */}
      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-3 border-b bg-gray-50 flex justify-between items-center flex-wrap gap-3">
          <span className="text-sm text-gray-600">Display mode:</span>
          <div className="flex gap-2">
            <button
              onClick={() => setViewType('table')}
              className={`px-4 py-2 text-sm rounded-lg ${viewType === 'table' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Table
            </button>
            <button
              onClick={() => setViewType('map')}
              className={`px-4 py-2 text-sm rounded-lg ${viewType === 'map' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Map
            </button>
            <button
              onClick={() => setViewType('combined')}
              className={`px-4 py-2 text-sm rounded-lg ${viewType === 'combined' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
            >
              Map + Table
            </button>
          </div>
        </div>
      </div>

      {/* District Filter */}
      {districtStats.length > 0 && (
        <div className="bg-white rounded-lg shadow mb-6 p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <label className="font-medium text-gray-700">Filter by District:</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">All Districts</option>
              {districtStats.map((d) => (
                <option key={d.district} value={d.district}>
                  District {d.district} ({d.active} active)
                </option>
              ))}
            </select>
            {selectedDistrict && (
              <button onClick={() => setSelectedDistrict('')} className="text-sm text-blue-600">
                Clear filter
              </button>
            )}
          </div>
        </div>
      )}

      {/* Combined View */}
      {viewType === 'combined' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="h-[500px] w-full">
              <ClosureMap closures={filteredClosures} selectedDistrict={selectedDistrict || undefined} />
            </div>
          </div>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-y-auto max-h-[500px]">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dist</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClosures.map((closure) => (
                    <tr
                      key={closure.closure_id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => router.push(`/closure/${closure.closure_id}`)}
                    >
                      <td className="px-4 py-2 text-sm">{closure.route || 'N/A'}</td>
                      <td className="px-4 py-2 text-sm">{closure.district}</td>
                      <td className="px-4 py-2">
                        <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">
                          {closure.closure_type?.substring(0, 12) || 'Unknown'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {closure.end_date ? new Date(closure.end_date).toLocaleDateString() : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Table Only View */}
      {viewType === 'table' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">District</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                </tr>
              </thead>
              <tbody>
                {filteredClosures.map((closure) => (
                  <tr
                    key={closure.closure_id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/closure/${closure.closure_id}`)}
                  >
                    <td className="px-6 py-4 text-sm">{closure.route || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm">{closure.district}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                        {closure.closure_type || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                        {closure.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {closure.end_date ? new Date(closure.end_date).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm max-w-md truncate">
                      {closure.description?.substring(0, 80)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Map Only View */}
      {viewType === 'map' && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="h-[600px] w-full">
            <ClosureMap closures={filteredClosures} selectedDistrict={selectedDistrict || undefined} />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 text-center text-sm text-gray-500">
        Data source: Caltrans CWWP2 API | Data refreshes every 5 minutes
      </div>
    </div>
  );
}