// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';

// Dynamically import the map component with no SSR
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

interface BayAreaEvent {
  id: number;
  roadwayName: string;
  eventType: string;
  directionOfTravel: string;
  lanesAffected: string;
  description: string;
}

type ViewType = 'table' | 'map' | 'combined';
type DataTab = 'closures' | 'bayarea' | 'chp-live' | 'chp-historical';

export default function Dashboard() {
  const router = useRouter();
  
  // Tab state
  const [activeTab, setActiveTab] = useState<DataTab>('closures');
  
  // View state for closures tab
  const [viewType, setViewType] = useState<ViewType>('combined');
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  
  // Closures state
  const [closures, setClosures] = useState<Closure[]>([]);
  const [closuresLoading, setClosuresLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  
  // Bay Area state
  const [bayAreaEvents, setBayAreaEvents] = useState<BayAreaEvent[]>([]);
  const [bayAreaLoading, setBayAreaLoading] = useState(false);

  // Fetch Closures
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

  // Fetch Bay Area Events when tab is active
  useEffect(() => {
    if (activeTab !== 'bayarea') return;
    
    async function fetchBayArea() {
      setBayAreaLoading(true);
      try {
        const response = await fetch('/api/bay-area-traffic?limit=100');
        const data = await response.json();
        if (data.success && Array.isArray(data.data)) {
          setBayAreaEvents(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch Bay Area events:', error);
      } finally {
        setBayAreaLoading(false);
      }
    }
    fetchBayArea();
  }, [activeTab]);

  // Poll Caltrans
  const pollCaltrans = async () => {
    setIsPolling(true);
    try {
      const response = await fetch('/api/poll?action=poll');
      const data = await response.json();
      if (data.success) {
        alert(`Caltrans poll completed! Found ${data.stats?.totalClosures || 0} closures.`);
        const refresh = await fetch('/api/closures/raw');
        const refreshData = await refresh.json();
        if (refreshData.success) {
          setClosures(refreshData.data);
        }
      } else {
        alert('Caltrans poll failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Poll failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsPolling(false);
    }
  };

  // Poll Bay Area
  const pollBayArea = async () => {
    setIsPolling(true);
    try {
      const response = await fetch('/api/poll/bay-area-511?action=poll');
      const data = await response.json();
      if (data.success) {
        alert(`Bay Area poll completed! Found ${data.stats?.totalFetched || 0} events.`);
        const refresh = await fetch('/api/bay-area-traffic?limit=100');
        const refreshData = await refresh.json();
        if (refreshData.success) setBayAreaEvents(refreshData.data);
      } else {
        alert('Bay Area poll failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Poll failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsPolling(false);
    }
  };

  // Filter closures by district
  const getFilteredClosures = useCallback(() => {
    let filtered = [...closures];
    if (selectedDistrict) {
      filtered = filtered.filter(c => c.district === parseInt(selectedDistrict));
    }
    return filtered;
  }, [closures, selectedDistrict]);

  // Calculate district stats
  const getDistrictStats = useCallback(() => {
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
  }, [closures]);

  const filteredClosures = getFilteredClosures();
  const districtStats = getDistrictStats();
  const closuresWithCoordinates = filteredClosures.filter(c => c.latitude && c.longitude);
  const activeClosures = closures.filter(c => c.status === 'active');

  // Get the correct poll function
  const getPollFunction = () => {
    return activeTab === 'closures' ? pollCaltrans : pollBayArea;
  };

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
                Real-time data from Caltrans, 511.org, and CHP
              </p>
            </div>
            <button
              onClick={getPollFunction()}
              disabled={isPolling}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {isPolling ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              )}
              <span>{isPolling ? 'Polling...' : 'Refresh Data'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Data Source Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="flex -mb-px overflow-x-auto">
              <button
                onClick={() => setActiveTab('closures')}
                className={`px-6 py-4 text-sm font-medium flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'closures'
                    ? 'border-b-2 border-blue-500 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Caltrans Lane Closures
                <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-600 rounded-full">
                  {activeClosures.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('bayarea')}
                className={`px-6 py-4 text-sm font-medium flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'bayarea'
                    ? 'border-b-2 border-green-500 text-green-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                Bay Area 511
                <span className="ml-2 px-2 py-0.5 text-xs bg-green-100 text-green-600 rounded-full">
                  {bayAreaEvents.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('chp-live')}
                className="px-6 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap"
              >
                CHP Live Incidents
              </button>
              <button
                onClick={() => setActiveTab('chp-historical')}
                className="px-6 py-4 text-sm font-medium text-gray-500 hover:text-gray-700 whitespace-nowrap"
              >
                CHP Historical
              </button>
            </nav>
          </div>
        </div>

        {/* ============================================ */}
        {/* TAB 1: CALTRANS CLOSURES */}
        {/* ============================================ */}
        {activeTab === 'closures' && (
          <>
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Total Records</p>
                    <p className="text-3xl font-bold text-gray-900">{closures.length}</p>
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
                    <p className="text-3xl font-bold text-gray-900">{activeClosures.length}</p>
                  </div>
                  <div className="bg-green-100 rounded-full p-3">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Unique Routes</p>
                    <p className="text-3xl font-bold text-gray-900">{new Set(closures.map(c => c.route)).size}</p>
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
                    <p className="text-3xl font-bold text-gray-900">{closuresWithCoordinates.length}</p>
                  </div>
                  <div className="bg-indigo-100 rounded-full p-3">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-lg shadow p-6 border-l-4 border-gray-500">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-500 text-sm">Completed</p>
                    <p className="text-3xl font-bold text-gray-900">{closures.filter(c => c.status === 'completed').length}</p>
                  </div>
                  <div className="bg-gray-100 rounded-full p-3">
                    <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* View Toggle */}
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
                    Table
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
                    Map
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

            {/* Combined View (Map + Table) */}
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
                      <span className="text-xs text-gray-500">({closuresWithCoordinates.length} closures with coordinates)</span>
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
                      <span className="text-xs text-gray-500">({filteredClosures.length} records)</span>
                    </div>
                  </div>
                  <div className="overflow-y-auto flex-1 max-h-[500px]">
                    {filteredClosures.length === 0 ? (
                      <div className="p-8 text-center text-gray-500">
                        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>No active closures found</p>
                        <p className="text-sm mt-2">Try refreshing data or check during business hours</p>
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dist</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
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
                                  {closure.district}
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap">
                                  <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-800">
                                    {closure.closure_type?.substring(0, 12) || 'Unknown'}
                                  </span>
                                </td>
                                <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-600">
                                  {closure.end_date ? new Date(closure.end_date).toLocaleDateString() : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
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
                    <tbody className="bg-white divide-y divide-gray-200">
                      {filteredClosures.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-12 text-center text-gray-500">No active closures found</td>
                        </tr>
                      ) : (
                        filteredClosures.map((closure) => (
                          <tr 
                            key={closure.closure_id} 
                            className="hover:bg-gray-50 cursor-pointer"
                            onClick={() => router.push(`/closure/${closure.closure_id}`)}
                          >
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {closure.route || 'N/A'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {closure.district}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                                {closure.closure_type || 'Unknown'}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">
                                {closure.status}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              {closure.end_date ? new Date(closure.end_date).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-600 max-w-md">
                              <div className="truncate" title={closure.description || ''}>
                                {closure.description?.substring(0, 80) || 'No description'}
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

            {/* Map Only View */}
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

            {/* Footer */}
            <div className="mt-4 px-6 py-3 bg-white rounded-lg shadow text-sm text-gray-500">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Data source: Caltrans CWWP2 API</span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Data refreshes every 5 minutes</span>
                </div>
              </div>
            </div>
          </>
        )}

        {/* ============================================ */}
        {/* TAB 2: BAY AREA 511 */}
        {/* ============================================ */}
        {activeTab === 'bayarea' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-900">Bay Area Traffic Events</h2>
              </div>
              <p className="text-sm text-gray-500 mt-1 ml-7">Official real-time traffic data from 511.org</p>
            </div>

            {bayAreaLoading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600"></div>
                <p className="mt-2 text-gray-500">Loading Bay Area events...</p>
              </div>
            ) : bayAreaEvents.length === 0 ? (
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
                    {bayAreaEvents.map((event) => (
                      <tr key={event.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {event.roadwayName || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
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
                  <span>Data source: 511.org | MTC</span>
                </div>
                <div>Showing {bayAreaEvents.length} events</div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: CHP LIVE INCIDENTS (Placeholder) */}
        {activeTab === 'chp-live' && (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-lg font-semibold">Coming Soon</p>
            <p className="text-sm mt-2">CHP Live Incidents integration is currently being developed</p>
          </div>
        )}

        {/* TAB 4: CHP HISTORICAL (Placeholder) */}
        {activeTab === 'chp-historical' && (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-lg font-semibold">Coming Soon</p>
            <p className="text-sm mt-2">CHP Historical Collisions integration is currently being developed</p>
          </div>
        )}
      </div>
    </div>
  );
}
