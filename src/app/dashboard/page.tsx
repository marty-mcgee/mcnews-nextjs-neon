// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { RefreshCw, Filter, X, Car, Radio, AlertTriangle, Calendar, MapPin, Download, Globe, Eye, EyeOff } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const SimpleMap = dynamic(() => import('@/components/map/simpleMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[600px] rounded-xl bg-muted flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  ),
});

type SourceFilter = 'all' | 'caltrans' | 'bayarea511' | 'chp-live' | 'chp-historical';
type DateRange = '1d' | '7d' | '30d' | 'all';

interface MapEvent {
  id: string;
  source: string;
  type: string;
  location: string;
  description: string;
  latitude: number;
  longitude: number;
  timestamp?: string;
  severity?: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  
  const [allEvents, setAllEvents] = useState<MapEvent[]>([]);
  const [filteredEvents, setFilteredEvents] = useState<MapEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [dateRange, setDateRange] = useState<DateRange>('7d');
  const [showFilters, setShowFilters] = useState(false);
  const [showHistorical, setShowHistorical] = useState(false);
  const [showAllRegions, setShowAllRegions] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchAllData = useCallback(async () => {
    try {
      const [caltransRes, bayAreaRes, chpLiveRes, chpHistoricalRes] = await Promise.all([
        fetch(`/api/caltrans/closures/raw?limit=2000&showAll=${showAllRegions}`),
        fetch(`/api/bay-area-511?limit=2000&showAll=${showAllRegions}`),
        fetch('/api/chp-cad?limit=2000'),
        fetch(`/api/chp-historical/collisions?limit=2000&showAll=${showAllRegions}`),
      ]);
      
      const caltransData = await caltransRes.json();
      const bayAreaData = await bayAreaRes.json();
      const chpLiveData = await chpLiveRes.json();
      const chpHistoricalData = await chpHistoricalRes.json();
      
      const events: MapEvent[] = [];
      
      // Caltrans events
      (caltransData.data || []).forEach((item: any) => {
        if (item.latitude && item.longitude) {
          events.push({
            id: `caltrans_${item.closure_id}`,
            source: 'caltrans',
            type: item.closure_type || 'Lane Closure',
            location: item.route || 'Unknown',
            description: item.description || '',
            latitude: parseFloat(item.latitude),
            longitude: parseFloat(item.longitude),
            timestamp: item.end_timestamp,
            severity: item.status,
          });
        }
      });
      
      // Bay Area 511 events
      (bayAreaData.data || []).forEach((item: any) => {
        if (item.latitude && item.longitude) {
          events.push({
            id: `bayarea_${item.id}`,
            source: 'bayarea511',
            type: item.eventType || 'Traffic Event',
            location: item.roadwayName || 'Unknown',
            description: item.description || '',
            latitude: parseFloat(item.latitude),
            longitude: parseFloat(item.longitude),
            timestamp: item.startTime,
            severity: item.severity,
          });
        }
      });
      
      // CHP Live events
      (chpLiveData.data || []).forEach((item: any) => {
        if (item.latitude && item.longitude) {
          events.push({
            id: `chplive_${item.id}`,
            source: 'chp-live',
            type: item.incidentType || 'Incident',
            location: item.location || 'Unknown',
            description: item.details || '',
            latitude: parseFloat(item.latitude),
            longitude: parseFloat(item.longitude),
            timestamp: item.logTime,
          });
        }
      });
      
      // CHP Historical events (only if toggle is on)
      if (showHistorical) {
        (chpHistoricalData.data || []).forEach((item: any) => {
          if (item.latitude && item.longitude) {
            events.push({
              id: `chphist_${item.id}`,
              source: 'chp-historical',
              type: 'Collision',
              location: item.location || 'Unknown',
              description: item.primaryFactor || '',
              latitude: parseFloat(item.latitude),
              longitude: parseFloat(item.longitude),
              timestamp: item.collisionDate,
              severity: item.severity,
            });
          }
        });
      }
      
      setAllEvents(events);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching data:', error);
      showToast('Failed to load dashboard data', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showAllRegions, showHistorical, showToast]);

  const applyFilters = useCallback(() => {
    let filtered = [...allEvents];
    
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(e => e.source === sourceFilter);
    }
    
    if (dateRange !== 'all') {
      const now = new Date();
      let cutoffDate: Date;
      switch (dateRange) {
        case '1d': cutoffDate = new Date(now.setDate(now.getDate() - 1)); break;
        case '7d': cutoffDate = new Date(now.setDate(now.getDate() - 7)); break;
        case '30d': cutoffDate = new Date(now.setDate(now.getDate() - 30)); break;
        default: cutoffDate = new Date(0);
      }
      filtered = filtered.filter(e => e.timestamp ? new Date(e.timestamp) > cutoffDate : true);
    }
    
    setFilteredEvents(filtered);
  }, [allEvents, sourceFilter, dateRange]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  useEffect(() => {
    applyFilters();
  }, [applyFilters]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      fetchAllData();
    }, 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchAllData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchAllData();
    showToast('Dashboard refreshed', 'success');
  };

  const getSourceCount = (source: string) => allEvents.filter(e => e.source === source).length;

  const exportToCSV = () => {
    const headers = ['Source', 'Type', 'Location', 'Description', 'Latitude', 'Longitude', 'Timestamp', 'Severity'];
    const rows = filteredEvents.map(e => [
      e.source, e.type, e.location, e.description, e.latitude, e.longitude, e.timestamp || '', e.severity || ''
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `traffic-events-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export complete', 'success');
  };

  const mapEvents = filteredEvents.filter(e => e.latitude && e.longitude).map(e => ({
    id: e.id,
    latitude: e.latitude,
    longitude: e.longitude,
    roadwayName: e.location,
    eventType: `${e.source === 'caltrans' ? '🚧' : e.source === 'bayarea511' ? '🚗' : e.source === 'chp-live' ? '🚨' : '📊'} ${e.type}`,
    description: e.description,
    onClick: () => router.push(`/dashboard/${e.source === 'bayarea511' ? '511org' : e.source}`),
  }));

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {ToastComponent}
      
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Traffic Map</h1>
          <p className="text-sm text-muted-foreground">
            {filteredEvents.length} events on map • {allEvents.length} total
            {lastUpdated && ` • Updated ${lastUpdated.toLocaleTimeString()}`}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <Button variant={autoRefresh ? "default" : "outline"} size="sm" onClick={() => setAutoRefresh(!autoRefresh)}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${autoRefresh ? 'animate-pulse' : ''}`} />
            Auto {autoRefresh ? 'ON' : 'OFF'}
          </Button>
          
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <Download className="w-3.5 h-3.5 mr-1.5" />
            Export
          </Button>
          
          <Button variant={sourceFilter !== 'all' || dateRange !== '7d' ? "secondary" : "outline"} size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-3.5 h-3.5 mr-1.5" />
            Filter
          </Button>
          
          <Button variant={showHistorical ? "secondary" : "outline"} size="sm" onClick={() => setShowHistorical(!showHistorical)}>
            <Calendar className="w-3.5 h-3.5 mr-1.5" />
            Historical {showHistorical ? 'ON' : 'OFF'}
          </Button>
          
          <Button variant={showAllRegions ? "secondary" : "outline"} size="sm" onClick={() => setShowAllRegions(!showAllRegions)}>
            <Globe className="w-3.5 h-3.5 mr-1.5" />
            {showAllRegions ? 'All Regions' : 'Local Only'}
          </Button>
          
          <Button size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm font-medium">Filters</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)}><X className="w-4 h-4" /></Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Data Source</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { value: 'all', label: 'All', icon: <MapPin className="w-3.5 h-3.5" />, count: allEvents.length },
                    { value: 'caltrans', label: 'Caltrans', icon: <Car className="w-3.5 h-3.5" />, count: getSourceCount('caltrans') },
                    { value: 'bayarea511', label: '511.org', icon: <Radio className="w-3.5 h-3.5" />, count: getSourceCount('bayarea511') },
                    { value: 'chp-live', label: 'CHP Live', icon: <AlertTriangle className="w-3.5 h-3.5" />, count: getSourceCount('chp-live') },
                    { value: 'chp-historical', label: 'Historical', icon: <Calendar className="w-3.5 h-3.5" />, count: getSourceCount('chp-historical') },
                  ].map(filter => (
                    <Button
                      key={filter.value}
                      variant={sourceFilter === filter.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setSourceFilter(filter.value as SourceFilter)}
                      className="justify-start"
                    >
                      {filter.icon}
                      <span className="ml-1">{filter.label}</span>
                      <Badge variant="secondary" className="ml-1 text-xs">{filter.count}</Badge>
                    </Button>
                  ))}
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-1 block">Date Range</label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { value: '1d', label: '24h' },
                    { value: '7d', label: '7 days' },
                    { value: '30d', label: '30 days' },
                    { value: 'all', label: 'All' },
                  ].map(range => (
                    <Button
                      key={range.value}
                      variant={dateRange === range.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => setDateRange(range.value as DateRange)}
                    >
                      {range.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3"><div className="flex justify-between items-center"><div><p className="text-xs text-muted-foreground">Total</p><p className="text-xl font-bold text-foreground">{filteredEvents.length}</p></div><MapPin className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
        <Card className="border-green-200 dark:border-green-900"><CardContent className="p-3"><div className="flex justify-between items-center"><div><p className="text-xs text-muted-foreground">Caltrans</p><p className="text-xl font-bold text-green-600 dark:text-green-400">{getSourceCount('caltrans')}</p></div><Car className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
        <Card className="border-blue-200 dark:border-blue-900"><CardContent className="p-3"><div className="flex justify-between items-center"><div><p className="text-xs text-muted-foreground">511.org</p><p className="text-xl font-bold text-blue-600 dark:text-blue-400">{getSourceCount('bayarea511')}</p></div><Radio className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
        <Card className="border-red-200 dark:border-red-900"><CardContent className="p-3"><div className="flex justify-between items-center"><div><p className="text-xs text-muted-foreground">CHP Live</p><p className="text-xl font-bold text-red-600 dark:text-red-400">{getSourceCount('chp-live')}</p></div><AlertTriangle className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
        <Card className="border-purple-200 dark:border-purple-900"><CardContent className="p-3"><div className="flex justify-between items-center"><div><p className="text-xs text-muted-foreground">CHP Historical</p><p className="text-xl font-bold text-purple-600 dark:text-purple-400">{getSourceCount('chp-historical')}</p></div><Calendar className="w-5 h-5 text-muted-foreground" /></div></CardContent></Card>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-500"></div>Caltrans</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-emerald-500"></div>511.org</div>
        <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-red-500"></div>CHP Live</div>
        <div className="flex items-center gap-1.5"><div className={`w-3 h-3 rounded-full ${showHistorical ? 'bg-purple-500' : 'bg-gray-300'}`}></div>CHP Historical {!showHistorical && '(hidden)'}</div>
      </div>

      {/* Map */}
      <Card>
        <CardContent className="p-0 overflow-hidden rounded-xl">
          {mapEvents.length > 0 ? (
            <SimpleMap events={mapEvents} center={[39.3, -123.5]} zoom={10} height="600px" />
          ) : (
            <div className="h-[600px] bg-muted flex flex-col items-center justify-center">
              <MapPin className="w-12 h-12 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No events with location data</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Source Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => router.push('/dashboard/caltrans')}>
          <CardContent className="p-3"><div className="flex justify-between items-center"><div><p className="text-xs text-muted-foreground">Caltrans</p><p className="text-xl font-bold text-foreground">{getSourceCount('caltrans')}</p></div><Car className="w-5 h-5 text-muted-foreground" /></div><p className="text-xs text-muted-foreground mt-1">Click to view details →</p></CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => router.push('/dashboard/511org')}>
          <CardContent className="p-3"><div className="flex justify-between items-center"><div><p className="text-xs text-muted-foreground">511.org</p><p className="text-xl font-bold text-foreground">{getSourceCount('bayarea511')}</p></div><Radio className="w-5 h-5 text-muted-foreground" /></div><p className="text-xs text-muted-foreground mt-1">Click to view details →</p></CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => router.push('/dashboard/chp-live')}>
          <CardContent className="p-3"><div className="flex justify-between items-center"><div><p className="text-xs text-muted-foreground">CHP Live</p><p className="text-xl font-bold text-foreground">{getSourceCount('chp-live')}</p></div><AlertTriangle className="w-5 h-5 text-muted-foreground" /></div><p className="text-xs text-muted-foreground mt-1">Click to view details →</p></CardContent>
        </Card>
        <Card className="cursor-pointer hover:bg-accent transition-colors" onClick={() => router.push('/dashboard/chp-historical')}>
          <CardContent className="p-3"><div className="flex justify-between items-center"><div><p className="text-xs text-muted-foreground">CHP Historical</p><p className="text-xl font-bold text-foreground">{getSourceCount('chp-historical')}</p></div><Calendar className="w-5 h-5 text-muted-foreground" /></div><p className="text-xs text-muted-foreground mt-1">Click to view details →</p></CardContent>
        </Card>
      </div>
    </div>
  );
}