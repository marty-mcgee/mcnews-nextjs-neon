// app/debug/closure-test/page.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function DebugClosureTest() {
  const [testId, setTestId] = useState<string>('');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableIds, setAvailableIds] = useState<any[]>([]);
  const [showIds, setShowIds] = useState(false);

  const testClosureId = async () => {
    if (!testId) return;
    
    setLoading(true);
    setError(null);
    setResult(null);
    
    try {
      const response = await fetch(`/api/caltrans/closures/${testId}`);
      const data = await response.json();
      
      setResult({
        status: response.status,
        ok: response.ok,
        data: data
      });
      
      if (!response.ok) {
        setError(data.error || `API returned ${response.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableIds = async () => {
    setShowIds(true);
    try {
      const response = await fetch('/api/caltrans/closures/raw');
      const data = await response.json();
      if (data.success) {
        setAvailableIds(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch IDs:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link href="/debug" className="text-blue-600 hover:underline mb-4 inline-block">
            ← Back to Debug
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Closure ID Debug Tool</h1>
          <p className="text-gray-500 mt-1">Test the /api/caltrans/closures/[id] endpoint with Drizzle ORM</p>
        </div>

        {/* Test Form */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Test a Specific ID</h2>
          <div className="flex gap-4">
            <input
              type="text"
              value={testId}
              onChange={(e) => setTestId(e.target.value)}
              placeholder="Enter closure ID (e.g., 1, 2, 3)"
              className="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={testClosureId}
              disabled={loading || !testId}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Testing...' : 'Test ID'}
            </button>
          </div>
          
          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 font-semibold">Error:</p>
              <p className="text-red-500 text-sm mt-1">{error}</p>
            </div>
          )}
          
          {result && (
            <div className="mt-4">
              <div className={`p-4 rounded-lg ${result.ok ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'} border`}>
                <p className="font-semibold">Response Status: {result.status}</p>
                <p className={result.ok ? 'text-green-600' : 'text-yellow-600'}>
                  {result.ok ? '✅ Success' : '⚠️ Failed'}
                </p>
                <pre className="mt-4 bg-gray-900 text-white p-4 rounded-lg overflow-auto max-h-96 text-xs">
                  {JSON.stringify(result.data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>

        {/* Available IDs */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Available Closure IDs</h2>
            <button
              onClick={fetchAvailableIds}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Load IDs from Database
            </button>
          </div>
          
          {showIds && (
            <div className="overflow-x-auto">
              {availableIds.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No records found in database.</p>
                  <button
                    onClick={() => window.location.href = '/api/test/populate'}
                    className="mt-2 text-blue-600 hover:underline"
                  >
                    Run /api/test/populate first
                  </button>
                </div>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">ID</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Route</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {availableIds.map((closure) => (
                      <tr key={closure.closure_id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-sm font-mono">{closure.closure_id}</td>
                        <td className="px-4 py-2 text-sm">{closure.route}</td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            closure.status === 'active' 
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {closure.status}
                          </span>
                        </td>
                        <td className="px-4 py-2">
                          <button
                            onClick={() => {
                              setTestId(String(closure.closure_id));
                              setTimeout(() => testClosureId(), 100);
                            }}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            Test This ID
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>

        {/* Schema Info */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">Drizzle Schema Note</h3>
          <p className="text-sm text-blue-700">
            Your Drizzle schema uses <code className="bg-blue-100 px-1 rounded">closureId</code> (camelCase) 
            which maps to <code className="bg-blue-100 px-1 rounded">closure_id</code> in the database.
            The API endpoint expects the numeric ID value.
          </p>
        </div>
      </div>
    </div>
  );
}
