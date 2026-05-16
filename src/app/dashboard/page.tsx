// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// Dynamically import the map component
const ClosureMap = dynamic(() => import('@/components/ClosureMap'), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gray-100 rounded-lg">
      <div className="text-center">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mb-2"></div>
        <p className="text-gray-500">Loading map...</p>
      </div>
    </div>
  ),
});

// Types
interface Closure {
  closure_id: number;
  source_id: string;
  district: number;
  route: string;
  direction: string;
  closure_type: string;
  lanes_affected: string;
  description: string;
  start_date: string;
  end_date: string;
  status: string;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

interface Collision {
  id: number;
  caseId: string;
  collisionDate: string;
  collisionYear: number;
  severity: string;
  county: string;
  city: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  fatalities: number;
  injuries: number;
}

type ViewType = 'table' | 'map' | 'combined';
type DataTab = 'closures' | 'collisions';

export default function Dashboard() {
  const router = useRouter();
  
  // Closures state
  const [closures, setClosures] = useState<Closure[]>([]);
  const [closuresLoading, setClosuresLoading] = useState(true);
  
  // Collisions state
  const [collisions, setCollisions] = useState<Collision[]>([]);
  const [collisionsLoading, setCollisionsLoading] = useState(true);
  const [collisionsStats, setCollisionsStats] = useState<any>(null);
  
  // UI state
  const [activeDataTab, setActiveDataTab] = useState<DataTab>('closures');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [selectedCounty, setSelectedCounty] = useState<string>('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('');
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [viewType, setViewType] = useState<ViewType>('combined');
  const [isPolling, setIsPolling] = useState(false);
  
  // Available filters
  const [availableCounties, setAvailableCounties] = useState<string[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  // Fetch closures data
  useEffect(() => {
    async function fetchClosures() {
      try {
        setClosuresLoading(true);
        const response = await fetch('/api/closures/raw');
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setClosures(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch closures:', error);
      } finally {
        setClosuresLoading(false);
      }
    }
    fetchClosures();
  }, []);

  // Fetch collisions data
  useEffect(() => {
    async function fetchCollisions() {
      if (activeDataTab !== 'collisions') return;
      
      try {
        setCollisionsLoading(true);
        const params = new URLSearchParams();
        if (selectedCounty && selectedCounty !== 'all') params.append('county', selectedCounty);
        if (selectedSeverity && selectedSeverity !== 'all') params.append('severity', selectedSeverity);
        if (selectedYear && selectedYear !== 'all') params.append('year', selectedYear);
        params.append('limit', '100');
        
        const response = await fetch(`/api/collisions?${params.toString()}`);
        const data = await response.json();
        
        if (data.success && Array.isArray(data.data)) {
          setCollisions(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch collisions:', error);
      } finally {
        setCollisionsLoading(false);
      }
    }
    
    fetchCollisions();
  }, [activeDataTab, selectedCounty, selectedSeverity, selectedYear]);

  // Fetch collisions stats
  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/collisions/stats');
        const data = await response.json();
        if (data.success) {
          setCollisionsStats(data.data);
          setAvailableCounties(data.data.byCounty?.map((c: any) => c.county) || []);
          setAvailableYears(data.data.availableYears || []);
        }
      } catch (error) {
        console.error('Failed to fetch collision stats:', error);
      }
    }
    fetchStats();
  }, []);

  // Filter closures
  const getFilteredClosures = () => {
    let filtered = [...closures];
    if (selectedDistrict) {
      filtered = filtered.filter(c => c.district === parseInt(selectedDistrict));
    }
    return filtered;
  };

  // Calculate closures stats
  const getClosuresStats = () => {
    const activeCount = closures.filter(c => c.status === 'active').length;
    const completedCount = closures.filter(c => c.status === 'completed').length;
    const uniqueRoutes = new Set(closures.map(c => c.route)).size;
    const withCoordinates = closures.filter(c => c.latitude && c.longitude).length;
    
    return {
      total: closures.length,
      active: activeCount,
      completed: completedCount,
      unique_routes: uniqueRoutes,
      with_coordinates: withCoordinates
    };
  };

  // Calculate district stats
  const getDistrictStats = () => {
    const districtMap = new Map<number, { active: number; total: number }>();
    
    closures.forEach(closure => {
      const district = closure.district;
      if (!districtMap.has(district)) {
        districtMap.set(district, { active: 0, total: 0 });
      }
      const stats = districtMap.get(district)!;
      stats.total++;
      if (closure.status === 'active') {
        stats.active++;
      }
    });
    
    return Array.from(districtMap.entries())
      .map(([district, stats]) => ({
        district,
        active: stats.active,
        total: stats.total
      }))
      .sort((a, b) => a.district - b.district);
  };

  // Trigger CHP data poll
  const triggerCHPPoll = async () => {
    setIsPolling(true);
    try {
      const response = await fetch('/api/historical/chp?action=poll&limit=500');
      const data = await response.json();
      if (data.success) {
        alert(`CHP Data poll completed! ${data.stats?.new || 0} new records added.`);
        const refreshResponse = await fetch('/api/collisions?limit=100');
        const refreshData = await refreshResponse.json();
        if (refreshData.success) {
          setCollisions(refreshData.data);
        }
      } else {
        alert('CHP Poll failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('CHP Poll failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsPolling(false);
    }
  };

  // Get severity badge color
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'Fatal':
        return 'bg-red-100 text-red-800';
      case 'Injury':
        return 'bg-orange-100 text-orange-800';
      case 'Property Damage':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const closuresStats = getClosuresStats();
  const filteredClosures = getFilteredClosures();
  const districtStats = getDistrictStats();
  const closuresWithCoordinates = filteredClosures.filter(c => c.latitude && c.longitude);

  // Loading state for closures
  if (closuresLoading && activeDataTab === 'closures') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <div className="text-xl text-gray-600">Loading dashboard...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex justify-between items-center flex-wrap gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                California Traffic Data Monitor
              </h1>
              <p className="text-gray-500 mt-1">
                Real-time lane closures + Historical CHP collision data
              </p>
            </div>
            {activeDataTab === 'collisions' && (
              <button
                onClick={triggerCHPPoll}
                disabled={isPolling}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {isPolling ? 'Polling...' : 'Refresh CHP Data'}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Data Source Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="flex -mb-px">
              <button
                onClick={() => setActiveDataTab('closures')}
                className={`px-6 py-4 text-sm font-medium flex items-center gap-2 ${
                  activeDataTab === 'closures'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Live Lane Closures
                <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">
                  {closuresStats.active}
                </span>
              </button>
              <button
                onClick={() => setActiveDataTab('collisions')}
                className={`px-6 py-4 text-sm font-medium flex items-center gap-2 ${
                  activeDataTab === 'collisions'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                CHP Collision History
                <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-600 rounded-full">
                  {collisionsStats?.summary?.totalCollisions?.toLocaleString() || 0}
                </span>
              </button>
            </nav>
          </div>
        </div>

        {/* ==================== CLOSURES TAB ==================== */}
        {activeDataTab === 'closures' && (
          <>
            {/* Closures Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Total Records</p>
                    <p className="text-3xl font-bold text-gray-900">{closuresStats.total}</p>
                  </div>
                  <div className="bg-blue-100 rounded-full p-3">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-green-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Active Closures</p>
                    <p className="text-3xl font-bold text-gray-900">{closuresStats.active}</p>
                  </div>
                  <div className="bg-green-100 rounded-full p-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Completed</p>
                    <p className="text-3xl font-bold text-gray-900">{closuresStats.completed}</p>
                  </div>
                  <div className="bg-gray-100 rounded-full p-3">
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Unique Routes</p>
                    <p className="text-3xl font-bold text-gray-900">{closuresStats.unique_routes}</p>
                  </div>
                  <div className="bg-purple-100 rounded-full p-3">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-indigo-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">On Map</p>
                    <p className="text-3xl font-bold text-gray-900">{closuresStats.with_coordinates}</p>
                  </div>
                  <div className="bg-indigo-100 rounded-full p-3">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* View Toggle - Table, Map, Combined */}
            <div className="bg-white rounded-lg shadow mb-6">
              <div className="px-6 py-3 border-b bg-gray-50 flex justify-between items-center flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6" />
                  </svg>
                  <span className="text-sm text-gray-600">Display mode:</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setViewType('table')}
                    className={`px-4 py-2 text-sm rounded-lg transition flex items-center gap-2 ${
                      viewType === 'table'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Table Only
                  </button>
                  <button
                    onClick={() => setViewType('map')}
                    className={`px-4 py-2 text-sm rounded-lg transition flex items-center gap-2 ${
                      viewType === 'map'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    Map Only
                  </button>
                  <button
                    onClick={() => setViewType('combined')}
                    className={`px-4 py-2 text-sm rounded-lg transition flex items-center gap-2 ${
                      viewType === 'combined'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                    }`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 6v12" />
                    </svg>
                    Map + Table
                  </button>
                </div>
              </div>
            </div>

            {/* District Filter */}
            {districtStats.length > 0 && (
              <div className="bg-white rounded-lg shadow mb-6 p-4">
                <div className="flex items-center gap-4 flex-wrap">
                  <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
                  </svg>
                  <label className="font-medium text-gray-700">Filter by District:</label>
                  <select
                    value={selectedDistrict}
                    onChange={(e) => setSelectedDistrict(e.target.value)}
                    className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Clear filter
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ==================== COMBINED VIEW ==================== */}
            {viewType === 'combined' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Map Section */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                      </svg>
                      <h3 className="font-semibold text-gray-900">Map View</h3>
                      <span className="text-xs text-gray-500">
                        ({closuresWithCoordinates.length} closures with coordinates)
                      </span>
                    </div>
                  </div>
                  <div className="h-[500px] w-full">
                    <ClosureMap 
                      closures={filteredClosures} 
                      selectedDistrict={selectedDistrict || undefined}
                    />
                  </div>
                </div>

                {/* Table Section */}
                <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col">
                  <div className="px-4 py-3 border-b bg-gray-50">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                      <h3 className="font-semibold text-gray-900">Data Table</h3>
                      <span className="text-xs text-gray-500">
                        ({filteredClosures.length} records)
                      </span>
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1 max-h-[500px]">
                    {filteredClosures.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>No active closures found</p>
                      </div>
                    ) : (
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dist</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {filteredClosures.map((closure) => (
                            <tr 
                              key={closure.closure_id} 
                              className="hover:bg-gray-50 cursor-pointer"
                              onClick={() => router.push(`/closure/${closure.closure_id}`)}
                            >
                              <td className="px-4 py-2 whitespace-nowrap text-sm font-medium text-gray-900">
                                {closure.route || 'N/A'}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                                {closure.district ?? 'N/A'}
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap">
                                <span className={`px-2 py-0.5 text-xs rounded-full ${
                                  closure.closure_type?.includes('Closure') 
                                    ? 'bg-red-100 text-red-800'
                                    : closure.closure_type?.includes('Work')
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}>
                                  {closure.closure_type?.substring(0, 12) || 'Unknown'}
                                </span>
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap">
                                <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">
                                  {closure.status}
                                </span>
                              </td>
                              <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                                {closure.end_date ? new Date(closure.end_date).toLocaleDateString() : 'N/A'}
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

            {/* ==================== TABLE ONLY VIEW ==================== */}
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
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredClosures.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                            No active closures found
                          </td>
                        </tr>
                      ) : (
                        filteredClosures.map((closure) => (
                          <tr 
                            key={closure.closure_id} 
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => router.push(`/closure/${closure.closure_id}`)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                              {closure.route || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                              {closure.district ?? 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 text-xs rounded-full ${
                                closure.closure_type?.includes('Closure') 
                                  ? 'bg-red-100 text-red-800'
                                  : closure.closure_type?.includes('Work')
                                  ? 'bg-yellow-100 text-yellow-800'
                                  : 'bg-blue-100 text-blue-800'
                              }`}>
                                {closure.closure_type || 'Unknown'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                                {closure.status || 'active'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                              {closure.end_date ? new Date(closure.end_date).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-gray-600 max-w-md">
                              <div className="truncate" title={closure.description || ''}>
                                {(closure.description || 'No description')?.substring(0, 80)}
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ==================== MAP ONLY VIEW ==================== */}
            {viewType === 'map' && (
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="h-[600px] w-full">
                  <ClosureMap 
                    closures={filteredClosures} 
                    selectedDistrict={selectedDistrict || undefined}
                  />
                </div>
              </div>
            )}
          </>
        )}

        {/* ==================== COLLISIONS TAB ==================== */}
        {activeDataTab === 'collisions' && (
          <>
            {/* Collisions Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Total Collisions</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {collisionsStats?.summary?.totalCollisions?.toLocaleString() || 0}
                    </p>
                  </div>
                  <div className="bg-purple-100 rounded-full p-3">
                    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Fatalities</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {collisionsStats?.summary?.totalFatalities || 0}
                    </p>
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
                    <p className="text-gray-500 text-sm">Injuries</p>
                    <p className="text-3xl font-bold text-gray-900">
                      {collisionsStats?.summary?.totalInjuries || 0}
                    </p>
                  </div>
                  <div className="bg-orange-100 rounded-full p-3">
                    <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Data Source</p>
                    <p className="text-xl font-bold text-gray-900">CHP CCRS</p>
                    <p className="text-xs text-gray-400">via data.ca.gov</p>
                  </div>
                  <div className="bg-blue-100 rounded-full p-3">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Collisions Filters */}
            <div className="bg-white rounded-lg shadow mb-6 p-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">County</label>
                  <select
                    value={selectedCounty}
                    onChange={(e) => setSelectedCounty(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Counties</option>
                    {availableCounties.map((county) => (
                      <option key={county} value={county}>{county}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                  <select
                    value={selectedSeverity}
                    onChange={(e) => setSelectedSeverity(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Severities</option>
                    <option value="Fatal">Fatal</option>
                    <option value="Injury">Injury</option>
                    <option value="Property Damage">Property Damage</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                  <select
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Years</option>
                    {availableYears.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-end">
                  {(selectedCounty !== 'all' || selectedSeverity !== 'all' || selectedYear !== 'all') && (
                    <button
                      onClick={() => {
                        setSelectedCounty('all');
                        setSelectedSeverity('all');
                        setSelectedYear('all');
                      }}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Collisions Table */}
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <h2 className="text-xl font-semibold text-gray-900">CHP Collision Records</h2>
                </div>
                <p className="text-sm text-gray-500 mt-1 ml-7">
                  Showing {collisions.length} of {collisionsStats?.summary?.totalCollisions?.toLocaleString() || 0} records
                </p>
              </div>

              {collisionsLoading ? (
                <div className="p-12 text-center">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-500">Loading collisions data...</p>
                </div>
              ) : collisions.length === 0 ? (
                <div className="p-12 text-center text-gray-500">
                  <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-lg">No collision records found</p>
                  <p className="text-sm mt-2">
                    {collisionsStats?.summary?.totalCollisions === 0 
                      ? 'No CHP data available. Use the "Refresh CHP Data" button to fetch from data.ca.gov.'
                      : 'No records match your filters.'}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">County</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">City</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Severity</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fatalities</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Injuries</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {collisions.map((collision) => (
                        <tr key={collision.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {collision.collisionDate ? new Date(collision.collisionDate).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {collision.county || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {collision.city || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${getSeverityBadge(collision.severity)}`}>
                              {collision.severity || 'Unknown'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <span className={`font-semibold ${collision.fatalities > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                              {collision.fatalities || 0}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {collision.injuries || 0}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600 max-w-md">
                            <div className="truncate" title={collision.location || ''}>
                              {collision.location || 'N/A'}
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
                    <span>Data source: CHP Collision and Citation Records System (CCRS) via data.ca.gov</span>
                  </div>
                  <div>Last updated: {new Date().toLocaleTimeString()}</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
