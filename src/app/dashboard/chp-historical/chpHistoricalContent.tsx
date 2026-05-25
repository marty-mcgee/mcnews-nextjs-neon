// src/app/dashboard/chp-historical/chpHistoricalContent.tsx
'use client';

import React, { useEffect, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { RefreshCw, AlertTriangle, MapPin, Filter, X, Calendar, Clock, Car, Info, Activity, TrendingUp, TrendingDown, Map } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const SimpleMap = dynamic(() => import('@/components/map/simpleMap'), { ssr: false, loading: () => <div className="h-[400px] bg-muted flex items-center justify-center"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div> });

interface Collision {
  id: number;
  caseId: string;
  collisionDate: string;
  severity: string;
  county: string;
  city: string;
  location: string;
  latitude: number | null;
  longitude: number | null;
  primaryFactor: string;
  injuries: number;
  fatalities: number;
}

const formatDate = (dateString: string | null) => dateString ? new Date(dateString).toLocaleDateString() : 'N/A';

export default function CHPHistoricalContent() {
  const { showToast, ToastComponent } = useToast();
  const [collisions, setCollisions] = useState<Collision[]>([]);
  const [filteredCollisions, setFilteredCollisions] = useState<Collision[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<string>('all');
  const [yearFilter, setYearFilter] = useState<string>('all');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/chp-historical/collisions?limit=100');
      const data = await response.json();
      if (data.success) { setCollisions(data.data); setLastUpdated(new Date()); }
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, []);

  const pollData = async () => {
    setIsPolling(true);
    try {
      const response = await fetch('/api/chp-historical/poll?action=poll&limit=500&startDate=2026-01-01');
      const data = await response.json();
      if (data.success) { await fetchData(); showToast(`Poll complete! ${data.stats?.newCount || 0} new collisions.`, 'success'); }
      else { showToast('Poll failed', 'error'); }
    } catch (err) { showToast('Poll failed', 'error'); } finally { setIsPolling(false); }
  };

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    let filtered = [...collisions];
    if (severityFilter !== 'all') filtered = filtered.filter(c => c.severity?.toLowerCase().includes(severityFilter));
    if (yearFilter !== 'all') filtered = filtered.filter(c => c.collisionDate?.startsWith(yearFilter));
    setFilteredCollisions(filtered);
  }, [collisions, severityFilter, yearFilter]);

  const toggleRowExpansion = (id: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id);
    else newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  const collisionsWithCoords = filteredCollisions.filter(c => c.latitude && c.longitude);
  const fatalCount = filteredCollisions.filter(c => c.severity === 'Fatal').length;
  const injuryCount = filteredCollisions.filter(c => c.severity === 'Injury').length;
  const years = [...new Set(collisions.map(c => c.collisionDate?.substring(0, 4)).filter(Boolean))].sort().reverse();

  const getSeverityBadge = (severity: string) => {
    if (severity === 'Fatal') return 'bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300';
    if (severity === 'Injury') return 'bg-yellow-100 dark:bg-yellow-950/50 text-yellow-700 dark:text-yellow-300';
    return 'bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300';
  };

  const mapEvents = collisionsWithCoords.map(c => ({ id: c.id, latitude: c.latitude!, longitude: c.longitude!, roadwayName: c.location, eventType: c.severity, description: c.primaryFactor }));

  if (loading) return <div className="flex justify-center items-center h-96"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>;

  return (
    <div className="space-y-6">
      {ToastComponent}
      <div className="flex flex-wrap justify-between items-center gap-4"><div><h1 className="text-2xl font-bold text-foreground">CHP Historical Collisions</h1><p className="text-sm text-muted-foreground">{filteredCollisions.length} collisions • {collisionsWithCoords.length} on map{lastUpdated && ` • Updated ${lastUpdated.toLocaleTimeString()}`}</p></div><div className="flex flex-wrap gap-2"><Button variant={showFilters ? "secondary" : "outline"} size="sm" onClick={() => setShowFilters(!showFilters)}><Filter className="w-3.5 h-3.5 mr-1.5" />Filter</Button><Button variant="outline" size="sm" onClick={() => setShowMap(!showMap)}><MapPin className="w-3.5 h-3.5 mr-1.5" />{showMap ? 'Hide Map' : 'Show Map'}</Button><Button size="sm" onClick={pollData} disabled={isPolling}><RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isPolling ? 'animate-spin' : ''}`} />{isPolling ? 'Polling...' : 'Refresh'}</Button></div></div>

      {showFilters && (<Card><CardContent className="p-4"><div className="flex justify-between items-center mb-3"><h3 className="font-semibold">Filter Collisions</h3><Button variant="ghost" size="sm" onClick={() => setShowFilters(false)}><X className="w-4 h-4" /></Button></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><div><label className="text-sm font-medium mb-1 block">Severity</label><select value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-background"><option value="all">All Severity</option><option value="fatal">Fatal</option><option value="injury">Injury</option><option value="property">Property Damage</option></select></div><div><label className="text-sm font-medium mb-1 block">Year</label><select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} className="w-full px-3 py-2 border rounded-lg bg-background"><option value="all">All Years</option>{years.map(y => <option key={y} value={y}>{y}</option>)}</select></div></div></CardContent></Card>)}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3"><div className="flex justify-between"><div><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold text-foreground">{filteredCollisions.length}</p></div><Car className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex justify-between"><div><p className="text-xs text-muted-foreground">Fatal</p><p className="text-xl font-bold text-red-600 dark:text-red-400">{fatalCount}</p></div><TrendingUp className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex justify-between"><div><p className="text-xs text-muted-foreground">Injury</p><p className="text-xl font-bold text-yellow-600 dark:text-yellow-400">{injuryCount}</p></div><Activity className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex justify-between"><div><p className="text-xs text-muted-foreground">On Map</p><p className="text-xl font-bold text-purple-600 dark:text-purple-400">{collisionsWithCoords.length}</p></div><Map className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="flex justify-between"><div><p className="text-xs text-muted-foreground">Avg Injuries</p><p className="text-xl font-bold text-blue-600 dark:text-blue-400">{((filteredCollisions.reduce((sum, c) => sum + (c.injuries || 0), 0) / filteredCollisions.length) || 0).toFixed(1)}</p></div><TrendingDown className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
      </div>

      {showMap && mapEvents.length > 0 && (<Card><CardContent className="p-0 overflow-hidden rounded-xl"><SimpleMap events={mapEvents} center={[39.3, -123.5]} zoom={10} height="400px" /></CardContent></Card>)}

      <Card><div className="overflow-x-auto"><table className="w-full"><thead className="bg-muted/50 border-b"><tr><th className="px-4 py-3 w-8"></th><th className="px-4 py-3 text-left text-xs uppercase">Date</th><th className="px-4 py-3 text-left text-xs uppercase">Severity</th><th className="px-4 py-3 text-left text-xs uppercase">Location</th><th className="px-4 py-3 text-left text-xs uppercase">City</th><th className="px-4 py-3 text-left text-xs uppercase">Injuries</th><th className="px-4 py-3 text-left text-xs uppercase">Fatalities</th></tr></thead><tbody className="divide-y">{filteredCollisions.slice(0, 50).map((collision) => (<React.Fragment key={collision.id}><tr className="hover:bg-muted/50 cursor-pointer" onClick={() => toggleRowExpansion(collision.id)}><td className="px-4 py-3"><Info className="w-4 h-4 text-muted-foreground" /></td><td className="px-4 py-3 text-sm">{formatDate(collision.collisionDate)}</td><td className="px-4 py-3"><span className={`px-2 py-1 text-xs rounded-full ${getSeverityBadge(collision.severity)}`}>{collision.severity || 'Unknown'}</span></td><td className="px-4 py-3 text-sm">{collision.location?.substring(0, 40)}</td><td className="px-4 py-3 text-sm">{collision.city || 'N/A'}</td><td className="px-4 py-3 text-sm">{collision.injuries || 0}</td><td className="px-4 py-3 text-sm">{collision.fatalities || 0}</td></tr>{expandedRows.has(collision.id) && (<tr className="bg-muted/30"><td colSpan={7} className="px-4 py-3"><div className="text-sm space-y-2"><div className="flex gap-2"><AlertTriangle className="w-4 h-4 text-muted-foreground" /><div><p className="font-medium">Primary Factor</p><p>{collision.primaryFactor || 'Not specified'}</p></div></div><div className="flex gap-2"><MapPin className="w-4 h-4 text-muted-foreground" /><div><p className="font-medium">Location</p><p>{collision.location}, {collision.city}, {collision.county || 'CA'}</p></div></div><div className="flex gap-2"><Clock className="w-4 h-4 text-muted-foreground" /><div><p className="font-medium">Case ID</p><p className="font-mono text-xs">{collision.caseId}</p></div></div></div></td></tr>)}</React.Fragment>))}</tbody></table></div></Card>
    </div>
  );
}