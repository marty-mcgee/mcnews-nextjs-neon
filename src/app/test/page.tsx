// app/debug/page.tsx
'use client';

import { useEffect, useState } from 'react';

export default function DebugPage() {
  const [debugData, setDebugData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function runDebug() {
      try {
        // Test 1: Check if API is reachable
        const summaryRes = await fetch('/api/caltrans/closures/summary');
        const summaryData = await summaryRes.json();
        
        // Test 2: Get sample closures
        const closuresRes = await fetch('/api/caltrans/closures?limit=5');
        const closuresData = await closuresRes.json();
        
        // Test 3: Get dashboard stats
        const statsRes = await fetch('/api/dashboard/stats');
        const statsData = await statsRes.json();
        
        setDebugData({
          summary: summaryData,
          closures: closuresData,
          stats: statsData,
          apiStatus: {
            summary: summaryRes.status,
            closures: closuresRes.status,
            stats: statsRes.status
          }
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    
    runDebug();
  }, []);

  if (loading) return <div className="p-8">Loading debug info...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Debug Information</h1>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">API Status</h2>
        <pre className="bg-gray-100 p-4 rounded">{JSON.stringify(debugData?.apiStatus, null, 2)}</pre>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Summary Data</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(debugData?.summary, null, 2)}
        </pre>
      </div>
      
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-2">Sample Closures</h2>
        <pre className="bg-gray-100 p-4 rounded overflow-auto max-h-96">
          {JSON.stringify(debugData?.closures, null, 2)}
        </pre>
      </div>
    </div>
  );
}
