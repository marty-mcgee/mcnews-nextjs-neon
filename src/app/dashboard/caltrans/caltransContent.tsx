// src/app/dashboard/caltrans/caltransContent.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { 
  RefreshCw, 
  Map, 
  Table2, 
  LayoutGrid,
  AlertTriangle,
  Calendar,
  MapPin,
  ChevronRight
} from 'lucide-react';

const ClosureMap = dynamic(
  () => import('@/components/ClosureMap'),
  { 
    ssr: false,
    loading: () => (
      <div className="h-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 rounded-lg">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
          <p className="text-gray-500 dark:text-gray-400">Loading map...</p>
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
  const [mounted, setMounted] = useState(false);
  const [viewType, setViewType] = useState<ViewType>('combined');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [closures, setClosures] = useState<Closure[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    async function fetchClosures() {
      try {
        setLoading(true);
        const response = await fetch('/api/caltrans/closures/raw');
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
      const response = await fetch('/api/caltrans/poll?action=poll');
      const data = await response.json();
      if (data.success) {
        alert(`Caltrans poll completed! Found ${data.stats?.totalClosures || 0} closures.`);
        const refresh = await fetch('/api/caltrans/closures/raw');
        const refreshData = await refresh.json();
        if (refreshData.success) setClosures(refreshData.data);
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

  const showMap = mounted && (viewType === 'map' || viewType === 'combined');

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Caltrans Lane Closures</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Real-time lane closures from Caltrans CWWP2 API</p>
        </div>
        <button
          onClick={pollCaltrans}
          disabled={isPolling}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 shadow-sm"
        >
          <RefreshCw className={`w-4 h-4 ${isPolling ? 'animate-spin' : ''}`} />
          {isPolling ? 'Fetching...' : 'Refresh Data'}
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4">
          <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">Total Records</p>
          <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{closures.length}</p>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4">
          <p className="text-green-600 dark:text-green-400 text-sm font-medium">Active Closures</p>
          <p className="text-2xl font-bold text-green-900 dark:text-green-300">{activeClosures.length}</p>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4">
          <p className="text-purple-600 dark:text-purple-400 text-sm font-medium">Unique Routes</p>
          <p className="text-2xl font-bold text-purple-900 dark:text-purple-300">{new Set(closures.map(c => c.route)).size}</p>
        </div>
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-xl p-4">
          <p className="text-indigo-600 dark:text-indigo-400 text-sm font-medium">On Map</p>
          <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-300">{closuresWithCoordinates.length}</p>
        </div>
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-700/30 rounded-xl p-4">
          <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Completed</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-300">{closures.filter(c => c.status === 'completed').length}</p>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setViewType('table')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            viewType === 'table'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <Table2 className="w-4 h-4" />
          Table
        </button>
        <button
          onClick={() => setViewType('map')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            viewType === 'map'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <Map className="w-4 h-4" />
          Map
        </button>
        <button
          onClick={() => setViewType('combined')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            viewType === 'combined'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          Map + Table
        </button>
      </div>

      {/* District Filter */}
      {districtStats.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-gray-500" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by District:</label>
            </div>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Districts</option>
              {districtStats.map((d) => (
                <option key={d.district} value={d.district}>
                  District {d.district} ({d.active} active)
                </option>
              ))}
            </select>
            {selectedDistrict && (
              <button
                onClick={() => setSelectedDistrict('')}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Combined View */}
      {viewType === 'combined' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden h-[500px]">
            {showMap ? (
              <ClosureMap closures={filteredClosures} selectedDistrict={selectedDistrict || undefined} />
            ) : (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                  <p className="text-gray-500">Loading map...</p>
                </div>
              </div>
            )}
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl overflow-hidden">
            <div className="overflow-y-auto max-h-[500px]">
              {filteredClosures.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <AlertTriangle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No active closures found</p>
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-100 dark:bg-gray-700 sticky top-0">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Route</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Dist</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Type</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300">End Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredClosures.map((closure) => (
                      <tr
                        key={closure.closure_id}
                        className="hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                        onClick={() => router.push(`/closure/${closure.closure_id}`)}
                      >
                        <td className="px-4 py-3 text-sm font-medium">{closure.route || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm">{closure.district}</td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                            <AlertTriangle className="w-3 h-3" />
                            {closure.closure_type?.substring(0, 12) || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <div className="flex items-center gap-1">
                            <Calendar className="w-3 h-3 text-gray-400" />
                            {closure.end_date ? new Date(closure.end_date).toLocaleDateString() : 'N/A'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Table Only View */}
      {viewType === 'table' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Route</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">District</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">End Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filteredClosures.map((closure) => (
                  <tr
                    key={closure.closure_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors"
                    onClick={() => router.push(`/closure/${closure.closure_id}`)}
                  >
                    <td className="px-6 py-4 text-sm font-medium">{closure.route || 'N/A'}</td>
                    <td className="px-6 py-4 text-sm">{closure.district}</td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                        <AlertTriangle className="w-3 h-3" />
                        {closure.closure_type || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300">
                        {closure.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        {closure.end_date ? new Date(closure.end_date).toLocaleDateString() : 'N/A'}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-md truncate">
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
        <div className="bg-gray-100 dark:bg-gray-800 rounded-xl overflow-hidden h-[600px]">
          {showMap ? (
            <ClosureMap closures={filteredClosures} selectedDistrict={selectedDistrict || undefined} />
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <p className="text-gray-500">Loading map...</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}