// src/components/DataFreshness.tsx
'use client';

import { useEffect, useState } from 'react';

interface DataFreshnessProps {
  lastUpdated: string | null;
  sourceName: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
}

export default function DataFreshness({ 
  lastUpdated, 
  sourceName, 
  onRefresh, 
  isRefreshing 
}: DataFreshnessProps) {
  const [timeAgo, setTimeAgo] = useState<string>('');

  useEffect(() => {
    if (!lastUpdated) {
      setTimeAgo('Never');
      return;
    }

    const updateTimeAgo = () => {
      const now = new Date();
      const last = new Date(lastUpdated);
      const diffMs = now.getTime() - last.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) {
        setTimeAgo('Just now');
      } else if (diffMins < 60) {
        setTimeAgo(`${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`);
      } else if (diffHours < 24) {
        setTimeAgo(`${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`);
      } else {
        setTimeAgo(`${diffDays} day${diffDays !== 1 ? 's' : ''} ago`);
      }
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 60000);
    return () => clearInterval(interval);
  }, [lastUpdated]);

  const getFreshnessColor = () => {
    if (!lastUpdated) return 'bg-gray-500';
    const last = new Date(lastUpdated);
    const diffMs = Date.now() - last.getTime();
    const diffMins = diffMs / 60000;

    if (diffMins < 5) return 'bg-green-500';
    if (diffMins < 30) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${getFreshnessColor()} animate-pulse`} />
        <span className="text-gray-500">{sourceName}:</span>
        <span className="text-gray-700">{timeAgo}</span>
      </div>
      <button
        onClick={onRefresh}
        disabled={isRefreshing}
        className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 disabled:opacity-50"
      >
        <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        Refresh
      </button>
    </div>
  );
}
