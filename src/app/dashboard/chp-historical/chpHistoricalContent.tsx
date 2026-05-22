// src/app/dashboard/chp-historical/chpHistoricalContent.tsx
'use client';

import { useEffect, useState } from 'react';
import { 
  RefreshCw, 
  TrendingUp, 
  Calendar, 
  MapPin,
  AlertTriangle,
  BarChart3,
  Download
} from 'lucide-react';

interface Collision {
  id: number;
  caseId: string;
  collisionDate: string;
  collisionYear: number;
  severity: string;
  county: string;
  city: string;
  location: string;
  injuries: number;
  fatalities: number;
}

export default function CHPHistoricalContent() {
  const [collisions, setCollisions] = useState<Collision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [isPolling, setIsPolling] = useState(false);
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [stats, setStats] = useState<any>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      let url = '/api/chp-historical/collisions?limit=200';
      if (selectedYear && selectedYear !== 'all') {
        url += `&year=${selectedYear}`;
      }
      
      const [collisionsRes, statsRes] = await Promise.all([
        fetch(url),
        fetch('/api/chp-historical/collisions/stats')
      ]);
      
      const collisionsData = await collisionsRes.json();
      const statsData = await statsRes.json();
      
      if (collisionsData.success) {
        setCollisions(collisionsData.data);
        setTotalCount(collisionsData.pagination?.total || collisionsData.data.length);
      }
      
      if (statsData.success) {
        setStats(statsData.data);
        setAvailableYears(statsData.data.availableYears || []);
      }
    } catch (err) {
      console.error('Error fetching CHP data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const pollData = async () => {
    setIsPolling(true);
    try {
      const response = await fetch('/api/chp-historical/poll?action=poll&limit=100');
      const data = await response.json();
      if (data.success) {
        alert(`CHP Historical poll completed! ${data.stats?.newCount || 0} new records added.`);
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
  }, [selectedYear]);

  const getSeverityBadge = (severity: string) => {
    const s = severity?.toLowerCase() || '';
    if (s.includes('fatal')) return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300';
    if (s.includes('injury')) return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
    return 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300';
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-red-500">
        <AlertTriangle className="w-12 h-12 mx-auto mb-3" />
        <p>{error}</p>
        <button onClick={fetchData} className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg">
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">CHP Historical Collisions</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Historical collision records from CHP CCRS</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={pollData}
            disabled={isPolling}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${isPolling ? 'animate-spin' : ''}`} />
            {isPolling ? 'Fetching...' : 'Refresh Data'}
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-purple-600 dark:text-purple-400 text-sm font-medium">Total Collisions</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-300">{totalCount.toLocaleString()}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-purple-500 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-red-600 dark:text-red-400 text-sm font-medium">Total Fatalities</p>
              <p className="text-2xl font-bold text-red-900 dark:text-red-300">
                {collisions.reduce((sum, c) => sum + (c.fatalities || 0), 0).toLocaleString()}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-red-500 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-600 dark:text-orange-400 text-sm font-medium">Total Injuries</p>
              <p className="text-2xl font-bold text-orange-900 dark:text-orange-300">
                {collisions.reduce((sum, c) => sum + (c.injuries || 0), 0).toLocaleString()}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-500 opacity-50" />
          </div>
        </div>
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">Data Source</p>
              <p className="text-lg font-bold text-blue-900 dark:text-blue-300">CHP CCRS</p>
              <p className="text-xs text-blue-600 dark:text-blue-400">via data.ca.gov</p>
            </div>
            <Download className="w-8 h-8 text-blue-500 opacity-50" />
          </div>
        </div>
      </div>

      {/* Year Filter */}
      {availableYears.length > 0 && (
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-gray-500" />
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by Year:</label>
            </div>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-purple-500"
            >
              <option value="">All Years</option>
              {availableYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
            {selectedYear && (
              <button
                onClick={() => setSelectedYear('')}
                className="text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* Collisions Table */}
      {collisions.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg">No collision records found</p>
          <p className="text-sm mt-1">Click refresh to fetch data from CHP CCRS</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-800 rounded-xl">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Report #</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">City</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Severity</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Fatalities</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Injuries</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Primary Factor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {collisions.map((collision) => (
                <tr key={collision.id} className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                  <td className="px-6 py-4 text-sm font-mono text-gray-900 dark:text-white">{collision.caseId}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                    {collision.collisionDate ? new Date(collision.collisionDate).toLocaleDateString() : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{collision.city || 'N/A'}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded-full ${getSeverityBadge(collision.severity)}`}>
                      <AlertTriangle className="w-3 h-3" />
                      {collision.severity || 'Unknown'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span className={`font-semibold ${collision.fatalities > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-600 dark:text-gray-400'}`}>
                      {collision.fatalities || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">{collision.injuries || 0}</td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400 max-w-md truncate">
                    {collision.primaryFactor || 'N/A'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}