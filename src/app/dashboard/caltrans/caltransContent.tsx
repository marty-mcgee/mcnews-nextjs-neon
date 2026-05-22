// src/app/dashboard/caltrans/caltransContent.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { RefreshCw, AlertTriangle, MapPin, Calendar, Car, XCircle, TrendingUp, LayoutGrid, MapIcon, Table2 } from 'lucide-react';

const ClosureMap = dynamic(() => import('@/components/ClosureMap'), { ssr: false });

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
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/caltrans/closures/raw');
      const data = await response.json();
      if (data.success && Array.isArray(data.data)) {
        setClosures(data.data);
      } else {
        setError('Failed to load closures');
      }
    } catch (err) {
      console.error('Failed to fetch closures:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const pollCaltrans = async () => {
    setIsPolling(true);
    try {
      const response = await fetch('/api/caltrans/poll?action=poll');
      const data = await response.json();
      if (data.success) {
        alert(`Caltrans poll completed! Found ${data.stats?.totalClosures || 0} closures.`);
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

  const filteredClosures = () => {
    let filtered = [...closures];
    if (selectedDistrict) {
      filtered = filtered.filter(c => c.district === parseInt(selectedDistrict));
    }
    return filtered;
  };

  const districtStats = () => {
    const districtMap = new Map<number, number>();
    closures.forEach(c => {
      if (c.status === 'active') {
        districtMap.set(c.district, (districtMap.get(c.district) || 0) + 1);
      }
    });
    return Array.from(districtMap.entries()).map(([district, count]) => ({ district, count }));
  };

  const filtered = filteredClosures();
  const districts = districtStats();
  const activeClosures = closures.filter(c => c.status === 'active');
  const closuresWithCoordinates = filtered.filter(c => c.latitude && c.longitude);

  const getClosureTypeBadge = (type: string) => {
    const lowerType = type?.toLowerCase() || '';
    if (lowerType.includes('closure')) return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    if (lowerType.includes('work')) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
    return 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
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
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">Total Records</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-300">{closures.length}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-600 dark:text-green-400 text-sm font-medium">Active Closures</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-300">{activeClosures.length}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-green-500 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 dark:text-purple-400 text-sm font-medium">Unique Routes</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-300">{new Set(closures.map(c => c.route)).size}</p>
            </div>
            <MapPin className="w-8 h-8 text-purple-500 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-indigo-600 dark:text-indigo-400 text-sm font-medium">On Map</p>
              <p className="text-2xl font-bold text-indigo-900 dark:text-indigo-300">{closuresWithCoordinates.length}</p>
            </div>
            <MapIcon className="w-8 h-8 text-indigo-500 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800/50 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Completed</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-300">{closures.filter(c => c.status === 'completed').length}</p>
            </div>
            <XCircle className="w-8 h-8 text-gray-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setViewType('table')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            viewType === 'table'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
          }`}
        >
          <Table2 className="w-4 h-4" /> Table
        </button>
        <button
          onClick={() => setViewType('map')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            viewType === 'map'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
          }`}
        >
          <MapIcon className="w-4 h-4" /> Map
        </button>
        <button
          onClick={() => setViewType('combined')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            viewType === 'combined'
              ? 'bg-blue-600 text-white shadow-md'
              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200'
          }`}
        >
          <LayoutGrid className="w-4 h-4" /> Map + Table
        </button>
      </div>

      {/* District Filter */}
      {districts.length > 0 && (
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
              {districts.map((d) => (
                <option key={d.district} value={d.district}>
                  District {d.district} ({d.count} active)
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
            {mounted && <ClosureMap closures={filtered} selectedDistrict={selectedDistrict} />}
          </div>
          <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl overflow-hidden">
            <div className="overflow-y-auto max-h-[500px]">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-gray-500">No active closures found</div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filtered.map(closure => (
                    <div
                      key={closure.closure_id}
                      className="p-4 hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                      onClick={() => router.push(`/closure/${closure.closure_id}`)}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="font-semibold">{closure.route}</span>
                          <span className="ml-2 text-xs text-gray-500">Dist {closure.district}</span>
                          <div className="mt-1">
                            <span className={`px-2 py-0.5 text-xs rounded-full ${getClosureTypeBadge(closure.closure_type)}`}>
                              {closure.closure_type}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-xs text-gray-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {closure.end_date ? new Date(closure.end_date).toLocaleDateString() : 'N/A'}
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mt-2 line-clamp-2">{closure.description}</p>
                    </div>
                  ))}
                </div>
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
              <thead className="bg-gray-50 dark:bg-gray-800 border-b">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium">Route</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">District</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">End Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {filtered.map(closure => (
                  <tr
                    key={closure.closure_id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    onClick={() => router.push(`/closure/${closure.closure_id}`)}
                  >
                    <td className="px-4 py-3 text-sm font-medium">{closure.route}</td>
                    <td className="px-4 py-3 text-sm">{closure.district}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full ${getClosureTypeBadge(closure.closure_type)}`}>{closure.closure_type}</span></td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 text-xs rounded-full ${closure.status === 'active' ? 'bg-green-100 dark:bg-green-900/30 text-green-800' : 'bg-gray-100 dark:bg-gray-800 text-gray-800'}`}>{closure.status}</span></td>
                    <td className="px-4 py-3 text-sm flex items-center gap-1"><Calendar className="w-3 h-3" />{closure.end_date ? new Date(closure.end_date).toLocaleDateString() : 'N/A'}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 max-w-md truncate">{closure.description}</td>
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
          {mounted && <ClosureMap closures={filtered} selectedDistrict={selectedDistrict} />}
        </div>
      )}
    </div>
  );
}