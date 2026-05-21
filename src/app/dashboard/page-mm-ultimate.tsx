// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// ============================================
// TYPES for each data source
// ============================================

// Type for Caltrans Lane Closures
interface Closure {
  closure_id: number;
  route: string;
  district: number;
  closure_type: string;
  status: string;
  end_date: string;
  description: string;
}

// Type for Bay Area 511 Events
interface BayAreaEvent {
  id: number;
  roadwayName: string;
  eventType: string;
  directionOfTravel: string;
  lanesAffected: string;
  description: string;
}

// Type for CHP Live Incidents (coming soon)
interface CHPIncident {
  id: number;
  incidentType: string;
  location: string;
  county: string;
}

// Type for CHP Historical Collisions (coming soon)
interface CHPCollision {
  id: number;
  caseId: string;
  collisionDate: string;
  severity: string;
  county: string;
}

// Tab type
type DataTab = 'closures' | 'bayarea' | 'chp-live' | 'chp-historical';

// ============================================
// MAIN DASHBOARD COMPONENT
// ============================================

export default function Dashboard() {
  const router = useRouter();
  
  // Current active tab
  const [activeTab, setActiveTab] = useState<DataTab>('closures');
  
  // Loading states
  const [isPolling, setIsPolling] = useState(false);
  
  // Module 1: Caltrans Lane Closures
  const [closures, setClosures] = useState<Closure[]>([]);
  const [closuresLoading, setClosuresLoading] = useState(true);
  
  // Module 2: Bay Area 511 Events
  const [bayAreaEvents, setBayAreaEvents] = useState<BayAreaEvent[]>([]);
  const [bayAreaLoading, setBayAreaLoading] = useState(false);
  
  // Module 3: CHP Live Incidents (placeholder)
  const [chpIncidents] = useState<CHPIncident[]>([]);
  
  // Module 4: CHP Historical Collisions (placeholder)
  const [chpCollisions] = useState<CHPCollision[]>([]);

  // ============================================
  // MODULE 1: FETCH CALTRANS CLOSURES
  // ============================================
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

  // ============================================
  // MODULE 2: FETCH BAY AREA 511 EVENTS
  // ============================================
  useEffect(() => {
    if (activeTab !== 'bayarea') return;
    
    async function fetchBayAreaEvents() {
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
    fetchBayAreaEvents();
  }, [activeTab]);

  // ============================================
  // POLLING FUNCTIONS FOR EACH MODULE
  // ============================================

  // Poll Caltrans API
  const pollCaltrans = async () => {
    setIsPolling(true);
    try {
      const response = await fetch('/api/poll?action=poll');
      const data = await response.json();
      if (data.success) {
        alert(`Caltrans poll completed! Found ${data.stats?.totalClosures || 0} closures.`);
        // Refresh the data
        const refresh = await fetch('/api/closures/raw');
        const refreshData = await refresh.json();
        if (refreshData.success) setClosures(refreshData.data);
      } else {
        alert('Caltrans poll failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Caltrans poll failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsPolling(false);
    }
  };

  // Poll Bay Area 511 API
  const pollBayArea = async () => {
    setIsPolling(true);
    try {
      const response = await fetch('/api/poll/bay-area-511?action=poll');
      const data = await response.json();
      if (data.success) {
        alert(`Bay Area 511 poll completed! Found ${data.stats?.totalFetched || 0} events.`);
        // Refresh the data
        const refresh = await fetch('/api/bay-area-traffic?limit=100');
        const refreshData = await refresh.json();
        if (refreshData.success) setBayAreaEvents(refreshData.data);
      } else {
        alert('Bay Area poll failed: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Bay Area poll failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setIsPolling(false);
    }
  };

  // Poll CHP CAD (placeholder)
  const pollCHPLive = async () => {
    alert('CHP Live Incidents - Coming soon');
  };

  // Poll CHP Historical (placeholder)
  const pollCHPHistorical = async () => {
    alert('CHP Historical Collisions - Coming soon');
  };

  // Get the correct poll function based on active tab
  const getPollFunction = () => {
    switch (activeTab) {
      case 'closures': return pollCaltrans;
      case 'bayarea': return pollBayArea;
      case 'chp-live': return pollCHPLive;
      case 'chp-historical': return pollCHPHistorical;
      default: return pollCaltrans;
    }
  };

  // Filter active closures
  const activeClosures = closures.filter(c => c.status === 'active');

  // ============================================
  // RENDER COMPONENT
  // ============================================

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
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
            >
              {isPolling ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Polling...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh Data
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Data Source Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="flex -mb-px overflow-x-auto">
              {/* Tab 1: Caltrans Lane Closures */}
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

              {/* Tab 2: Bay Area 511 */}
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

              {/* Tab 3: CHP Live Incidents */}
              <button
                onClick={() => setActiveTab('chp-live')}
                className={`px-6 py-4 text-sm font-medium flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'chp-live'
                    ? 'border-b-2 border-red-500 text-red-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                CHP Live Incidents
                <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-600 rounded-full">
                  0
                </span>
              </button>

              {/* Tab 4: CHP Historical Collisions */}
              <button
                onClick={() => setActiveTab('chp-historical')}
                className={`px-6 py-4 text-sm font-medium flex items-center gap-2 whitespace-nowrap ${
                  activeTab === 'chp-historical'
                    ? 'border-b-2 border-purple-500 text-purple-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                CHP Historical
                <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-600 rounded-full">
                  0
                </span>
              </button>
            </nav>
          </div>
        </div>

        {/* ============================================ */}
        {/* MODULE 1: CALTRANS LANE CLOSURES */}
        {/* ============================================ */}
        {activeTab === 'closures' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-900">Caltrans Lane Closures</h2>
              </div>
              <p className="text-sm text-gray-500 mt-1 ml-7">
                Real-time lane closures from Caltrans CWWP2 API
              </p>
            </div>

            {closuresLoading ? (
              <div className="p-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <p className="mt-2 text-gray-500">Loading closures...</p>
              </div>
            ) : activeClosures.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg">No active closures found</p>
                <p className="text-sm mt-2">
                  Try running during weekday business hours (Tuesday-Thursday, 10 AM - 2 PM PT)
                </p>
                <button
                  onClick={pollCaltrans}
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Route</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">District</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">End Date</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Description</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {activeClosures.slice(0, 100).map((closure) => (
                      <tr key={closure.closure_id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {closure.route || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {closure.district || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-800">
                            {closure.closure_type || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {closure.end_date ? new Date(closure.end_date).toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-md">
                          <div className="truncate" title={closure.description || ''}>
                            {(closure.description || 'No description')?.substring(0, 100)}
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
                <span>Data source: Caltrans CWWP2 API</span>
                <span>Showing {activeClosures.length} active closures</span>
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* MODULE 2: BAY AREA 511 */}
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
              <p className="text-sm text-gray-500 mt-1 ml-7">
                Official real-time traffic data from 511.org
              </p>
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
                <button
                  onClick={pollBayArea}
                  className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Fetch Data Now
                </button>
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
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            event.eventType?.toLowerCase().includes('accident') 
                              ? 'bg-red-100 text-red-800'
                              : event.eventType?.toLowerCase().includes('roadwork')
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}>
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
                <span>Data source: 511.org | MTC</span>
                <span>Showing {bayAreaEvents.length} events</span>
              </div>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* MODULE 3: CHP LIVE INCIDENTS (PLACEHOLDER) */}
        {/* ============================================ */}
        {activeTab === 'chp-live' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-900">CHP Live Incidents</h2>
              </div>
              <p className="text-sm text-gray-500 mt-1 ml-7">
                Real-time incidents from CHP CAD system
              </p>
            </div>
            <div className="p-12 text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-lg font-semibold">Coming Soon</p>
              <p className="text-sm mt-2">CHP Live Incidents integration is currently being developed</p>
            </div>
          </div>
        )}

        {/* ============================================ */}
        {/* MODULE 4: CHP HISTORICAL COLLISIONS (PLACEHOLDER) */}
        {/* ============================================ */}
        {activeTab === 'chp-historical' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <h2 className="text-lg font-semibold text-gray-900">CHP Historical Collisions</h2>
              </div>
              <p className="text-sm text-gray-500 mt-1 ml-7">
                Historical collision records from CHP CCRS
              </p>
            </div>
            <div className="p-12 text-center text-gray-500">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-lg font-semibold">Coming Soon</p>
              <p className="text-sm mt-2">CHP Historical Collisions integration is currently being developed</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
