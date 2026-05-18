// src/app/dashboard/page.tsx
'use client';

import { useState } from 'react';
import CaltransClosures from '@/components/dashboard/CaltransClosures';
import BayArea511 from '@/components/dashboard/BayArea511';
import CHPLiveIncidents from '@/components/dashboard/CHPLiveIncidents';
import CHPHistorical from '@/components/dashboard/CHPHistorical';

type DataTab = 'caltrans' | 'bayarea' | 'chp-live' | 'chp-historical';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState<DataTab>('caltrans');

  const tabs = [
    { id: 'caltrans' as const, name: 'Caltrans Lane Closures', color: 'blue' },
    { id: 'bayarea' as const, name: 'Bay Area 511', color: 'green' },
    { id: 'chp-live' as const, name: 'CHP Live Incidents', color: 'red' },
    { id: 'chp-historical' as const, name: 'CHP Historical Collisions', color: 'purple' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              California Traffic Data Monitor
            </h1>
            <p className="text-gray-500 mt-1">
              Real-time data from Caltrans, 511.org, and CHP
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="flex -mb-px overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 text-sm font-medium flex items-center gap-2 whitespace-nowrap ${
                    activeTab === tab.id
                      ? `border-b-2 border-${tab.color}-500 text-${tab.color}-600`
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow">
          {activeTab === 'caltrans' && <CaltransClosures />}
          {activeTab === 'bayarea' && <BayArea511 />}
          {activeTab === 'chp-live' && <CHPLiveIncidents />}
          {activeTab === 'chp-historical' && <CHPHistorical />}
        </div>
      </div>
    </div>
  );
}
