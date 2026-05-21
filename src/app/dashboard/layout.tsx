// src/app/dashboard/layout.tsx
import Link from 'next/link';

const tabs = [
  { path: '/dashboard/511org', name: 'Bay Area 511.org', color: 'green' },
  { path: '/dashboard/caltrans', name: 'Caltrans Lane Closures', color: 'blue' },
  { path: '/dashboard/chp-live', name: 'CHP Live Incidents', color: 'red' },
  { path: '/dashboard/chp-historical', name: 'CHP Historical', color: 'purple' },
];

function BayAreaIcon() {
  return (
    <svg 
      className="w-5 h-5" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
      suppressHydrationWarning
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}

function CaltransIcon() {
  return (
    <svg 
      className="w-5 h-5" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
      suppressHydrationWarning
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CHPLiveIcon() {
  return (
    <svg 
      className="w-5 h-5" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
      suppressHydrationWarning
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function CHPHistoricalIcon() {
  return (
    <svg 
      className="w-5 h-5" 
      fill="none" 
      stroke="currentColor" 
      viewBox="0 0 24 24"
      suppressHydrationWarning
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50" suppressHydrationWarning>
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">
            California Traffic Data Monitor
          </h1>
          <p className="text-gray-500 mt-1">
            Real-time data from 511.org, Caltrans, and CHP
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tabs Navigation - Server Component, no active highlighting */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="border-b">
            <nav className="flex -mb-px overflow-x-auto">
              {tabs.map((tab) => (
                <Link
                  key={tab.path}
                  href={tab.path}
                  className={`px-6 py-4 text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-colors text-gray-500 hover:text-gray-700 border-b-2 border-transparent`}
                  suppressHydrationWarning
                >
                  {tab.path === '/dashboard/511org' && <BayAreaIcon />}
                  {tab.path === '/dashboard/caltrans' && <CaltransIcon />}
                  {tab.path === '/dashboard/chp-live' && <CHPLiveIcon />}
                  {tab.path === '/dashboard/chp-historical' && <CHPHistoricalIcon />}
                  {tab.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
}