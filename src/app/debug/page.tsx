// app/debug/page.tsx
'use client';

import Link from 'next/link';

export default function DebugIndex() {
  const debugRoutes = [
    {
      path: '/debug/database',
      title: 'Database Debug',
      description: 'View database contents, status counts, and sample records'
    },
    {
      path: '/debug/full',
      title: 'Full Debug',
      description: 'Comprehensive debug information with Drizzle vs Raw comparison'
    },
    {
      path: '/debug/compare',
      title: 'Compare Endpoints',
      description: 'Compare Drizzle and Raw SQL query results'
    },
    {
      path: '/debug/closure-test',
      title: 'Closure ID Test',
      description: 'Test the /api/caltrans/closures/[id] endpoint with specific IDs'
    },
    {
      path: '/api/caltrans/closures/raw',
      title: 'Raw Closures API',
      description: 'View raw closure data directly from database',
      external: true
    },
    {
      path: '/api/debug/test',
      title: 'API Test',
      description: 'Quick API connectivity test',
      external: true
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Debug Tools</h1>
          <p className="text-gray-500 mt-1">Diagnostic pages for Caltrans Lane Closure Monitor</p>
        </div>

        <div className="grid gap-4">
          {debugRoutes.map((route) => (
            <Link
              key={route.path}
              href={route.path}
              target={route.external ? '_blank' : undefined}
              className="block bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">{route.title}</h2>
                  <p className="text-gray-500 text-sm mt-1">{route.description}</p>
                  <code className="text-xs text-gray-400 mt-2 block">/{route.path}</code>
                </div>
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </Link>
          ))}
        </div>

        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">Note</h3>
          <p className="text-sm text-yellow-700">
            These debug pages are for development and troubleshooting only. They expose database structure and raw data.
            Make sure to secure or remove these routes in production.
          </p>
        </div>
      </div>
    </div>
  );
}
