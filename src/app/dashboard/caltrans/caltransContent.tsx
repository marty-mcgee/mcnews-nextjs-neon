// src/app/dashboard/caltrans/caltransContent.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { RefreshCw, AlertTriangle, MapPin, Construction, Car, Filter, X, Calendar, Clock, Route, Info, Activity, Map, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const SimpleMap = dynamic(() => import('@/components/map/simpleMap'), {
  ssr: false,
  loading: () => <div className="h-[400px] bg-muted flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>,
});

interface LaneClosure {
  id: number;
  sourceId: string;
  district: number;
  route: string;
  direction: string;
  closureType: string;
  lanesAffected: string;
  startTimestamp: string | null;
  endTimestamp: string | null;
  description: string;
  latitude: number | null;
  longitude: number | null;
  county: string;
  city: string;
  status: string;
  lastSeen: string;
}

const formatRelativeTime = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    const diffMins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} min ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    return `${Math.floor(diffHours / 24)} days ago`;
  } catch { return 'N/A'; }
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return 'N/A';
  try { return new Date(dateString).toLocaleString(); } catch { return 'Invalid date'; }
};

export default function CaltransContent() {
  const { showToast, ToastComponent } = useToast();
  const [allClosures, setAllClosures] = useState<LaneClosure[]>([]);
  const [closures, setClosures] = useState<LaneClosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [localOnly, setLocalOnly] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/caltrans/closures/raw?limit=100${localOnly ? '' : '&showAll=true'}`);
      const data = await response.json();
      if (data.success) {
        setAllClosures(data.data);
        setLastUpdated(new Date());
      } else {
        setError('Failed to load closures');
      }
    } catch (err) { setError('Failed to load data'); } finally { setLoading(false); }
  }, [localOnly]);

  const pollData = async () => {
    setIsPolling(true);
    try {
      const response = await fetch('/api/caltrans/poll');
      const data = await response.json();
      if (data.success) {
        await fetchData();
        showToast(`Poll complete! ${data.stats?.newCount || 0} new, ${data.stats?.closedCount || 0} completed.`, 'success');
      } else { showToast('Poll failed', 'error'); }
    } catch (err) { showToast('Poll failed', 'error'); } finally { setIsPolling(false); }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    let filtered = [...allClosures];
    if (localOnly) filtered = filtered.filter(c => c.district === 1);
    if (statusFilter !== 'all') filtered = filtered.filter(c => c.status === statusFilter);
    setClosures(filtered);
  }, [allClosures, localOnly, statusFilter]);

  const toggleRowExpansion = (id: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  const closuresWithCoords = closures.filter(c => c.latitude && c.longitude);
  const activeCount = closures.filter(c => c.status === 'active').length;
  const localCount = closures.filter(c => c.district === 1).length;

  const getClosureTypeBadge = (type: string) => {
    const lowerType = type?.toLowerCase() || '';
    if (lowerType.includes('full')) return 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300';
    if (lowerType.includes('lane')) return 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-300';
    return 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300';
  };

  const mapEvents = closuresWithCoords.map(c => ({ id: c.id, latitude: c.latitude!, longitude: c.longitude!, roadwayName: `${c.route} ${c.direction}`, eventType: c.closureType, description: c.description }));

  if (loading) return <div className="flex justify-center items-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;
  if (error) return <div className="text-center py-12 text-destructive"><AlertTriangle className="w-12 h-12 mx-auto mb-3" /><p>{error}</p><Button onClick={fetchData} className="mt-4">Retry</Button></div>;

  return (
    <div className="space-y-6">
      {ToastComponent}
      
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div><h1 className="text-2xl font-bold text-foreground">Caltrans Lane Closures</h1><p className="text-sm text-muted-foreground">{localOnly ? '📍 District 1 (Mendocino/Humboldt)' : '🌎 All Districts'} • {closures.length} closures{lastUpdated && ` • Updated ${lastUpdated.toLocaleTimeString()}`}</p></div>
        <div className="flex flex-wrap gap-2">
          <Button variant={localOnly ? "secondary" : "outline"} size="sm" onClick={() => setLocalOnly(!localOnly)}><MapPin className="w-3.5 h-3.5 mr-1.5" />{localOnly ? 'Local Only' : 'All Districts'}</Button>
          <Button variant={showFilters ? "secondary" : "outline"} size="sm" onClick={() => setShowFilters(!showFilters)}><Filter className="w-3.5 h-3.5 mr-1.5" />Filter</Button>
          <Button variant="outline" size="sm" onClick={() => setShowMap(!showMap)}><MapPin className="w-3.5 h-3.5 mr-1.5" />{showMap ? 'Hide Map' : 'Show Map'}</Button>
          <Button size="sm" onClick={pollData} disabled={isPolling}><RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isPolling ? 'animate-spin' : ''}`} />{isPolling ? 'Polling...' : 'Refresh'}</Button>
        </div>
      </div>

      {showFilters && (
        <Card><CardContent className="p-4"><div className="flex justify-between items-center mb-3"><h3 className="font-semibold">Filter Closures</h3><Button variant="ghost" size="sm" onClick={() => setShowFilters(false)}><X className="w-4 h-4" /></Button></div><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-background"><option value="all">All Status</option><option value="active">Active</option><option value="completed">Completed</option></select></CardContent></Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3"><div className="flex justify-between"><div><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold text-foreground">{closures.length}</p></div><Construction className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex justify-between"><div><p className="text-xs text-muted-foreground">Active</p><p className="text-xl font-bold text-green-600 dark:text-green-400">{activeCount}</p></div><Activity className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex justify-between"><div><p className="text-xs text-muted-foreground">District 1</p><p className="text-xl font-bold text-blue-600 dark:text-blue-400">{localCount}</p></div><MapPin className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex justify-between"><div><p className="text-xs text-muted-foreground">Full Closures</p><p className="text-xl font-bold text-amber-600 dark:text-amber-400">{closures.filter(c => c.closureType?.toLowerCase().includes('full')).length}</p></div><AlertTriangle className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex justify-between"><div><p className="text-xs text-muted-foreground">On Map</p><p className="text-xl font-bold text-purple-600 dark:text-purple-400">{closuresWithCoords.length}</p></div><Map className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
      </div>

      {showMap && mapEvents.length > 0 && (<Card><CardContent className="p-0 overflow-hidden rounded-xl"><SimpleMap events={mapEvents} center={[39.3, -123.5]} zoom={10} height="400px" /></CardContent></Card>)}

      <Card><div className="overflow-x-auto"><table className="w-full"><thead className="bg-muted/50 border-b"><tr><th className="px-4 py-3 w-8"></th><th className="px-4 py-3 text-left text-xs uppercase">Route</th><th className="px-4 py-3 text-left text-xs uppercase">Direction</th><th className="px-4 py-3 text-left text-xs uppercase">Type</th><th className="px-4 py-3 text-left text-xs uppercase">Lanes</th><th className="px-4 py-3 text-left text-xs uppercase">Status</th><th className="px-4 py-3 text-left text-xs uppercase">District</th><th className="px-4 py-3 text-left text-xs uppercase">Last Seen</th></tr></thead><tbody className="divide-y">{closures.slice(0, 50).map((closure) => (<React.Fragment key={closure.id}><tr className="hover:bg-muted/50 cursor-pointer" onClick={() => toggleRowExpansion(closure.id)}><td className="px-4 py-3"><Info className="w-4 h-4 text-muted-foreground" /></td><td className="px-4 py-3 text-sm font-medium">{closure.route || 'N/A'}</td><td className="px-4 py-3 text-sm">{closure.direction || '—'}</td><td className="px-4 py-3"><span className={`px-2 py-1 text-xs rounded-full ${getClosureTypeBadge(closure.closureType)}`}>{closure.closureType || 'Unknown'}</span></td><td className="px-4 py-3 text-sm">{closure.lanesAffected || '—'}</td><td className="px-4 py-3"><span className={`px-2 py-1 text-xs rounded-full ${closure.status === 'active' ? 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-gray-800'}`}>{closure.status}</span></td><td className="px-4 py-3 text-sm">{closure.district}</td><td className="px-4 py-3 text-sm text-muted-foreground">{formatRelativeTime(closure.lastSeen)}</td></tr>{expandedRows.has(closure.id) && (<tr className="bg-muted/30"><td colSpan={8} className="px-4 py-3"><div className="text-sm space-y-2"><div className="flex gap-2"><Info className="w-4 h-4 text-muted-foreground" /><div><p className="font-medium">Description</p><p>{closure.description || 'No description'}</p></div></div><div className="flex gap-2"><Calendar className="w-4 h-4 text-muted-foreground" /><div><p className="font-medium">Schedule</p><p>{formatDate(closure.startTimestamp)} → {formatDate(closure.endTimestamp)}</p></div></div><div className="flex gap-2"><Route className="w-4 h-4 text-muted-foreground" /><div><p className="font-medium">Location</p><p>{closure.county || closure.city || 'N/A'}</p></div></div></div></td></tr>)}</React.Fragment>))}</tbody></table></div></Card>
    </div>
  );
}