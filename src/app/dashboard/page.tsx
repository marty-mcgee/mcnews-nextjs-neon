// src/app/dashboard/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { RefreshCw, Filter, X, Car, Radio, AlertTriangle, Calendar, MapPin, Download, Globe, Eye, EyeOff, Layers } from 'lucide-react';
import { useToast } from '@/components/ui/toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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

// Layer configuration
interface LayerConfig {
  id: string;
  name: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  activeColor: string;
  activeBgColor: string;
  enabled: boolean;
  count: number;
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
  
  // Layer visibility state
  const [layers, setLayers] = useState<LayerConfig[]>([
    { id: 'chp-live', name: 'CHP Live', icon: <AlertTriangle className="w-4 h-4" />, color: 'red', bgColor: 'bg-red-50 dark:bg-red-950/30', activeColor: 'text-red-600 dark:text-red-400', activeBgColor: 'bg-red-100 dark:bg-red-900/50', enabled: true, count: 0 },
    { id: 'bayarea511', name: '511.org', icon: <Radio className="w-4 h-4" />, color: 'emerald', bgColor: 'bg-emerald-50 dark:bg-emerald-950/30', activeColor: 'text-emerald-600 dark:text-emerald-400', activeBgColor: 'bg-emerald-100 dark:bg-emerald-900/50', enabled: true, count: 0 },
    { id: 'caltrans', name: 'Caltrans', icon: <Car className="w-4 h-4" />, color: 'blue', bgColor: 'bg-blue-50 dark:bg-blue-950/30', activeColor: 'text-blue-600 dark:text-blue-400', activeBgColor: 'bg-blue-100 dark:bg-blue-900/50', enabled: true, count: 0 },
    { id: 'chp-historical', name: 'Historical', icon: <Calendar className="w-4 h-4" />, color: 'purple', bgColor: 'bg-purple-50 dark:bg-purple-950/30', activeColor: 'text-purple-600 dark:text-purple-400', activeBgColor: 'bg-purple-100 dark:bg-purple-900/50', enabled: false, count: 0 },
  ]);

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
      let counts = { caltrans: 0, bayarea511: 0, 'chp-live': 0, 'chp-historical': 0 };
      
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
          counts.caltrans++;
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
          counts.bayarea511++;
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
          counts['chp-live']++;
        }
      });
      
      // CHP Historical events
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
            counts['chp-historical']++;
          }
        });
      }
      
      setAllEvents(events);
      setLastUpdated(new Date());
      
      // Update layer counts
      setLayers(prev => prev.map(layer => ({
        ...layer,
        count: layer.id === 'caltrans' ? counts.caltrans :
               layer.id === 'bayarea511' ? counts.bayarea511 :
               layer.id === 'chp-live' ? counts['chp-live'] :
               layer.id === 'chp-historical' ? counts['chp-historical'] : 0
      })));
      
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
    
    // Apply source filter
    if (sourceFilter !== 'all') {
      filtered = filtered.filter(e => e.source === sourceFilter);
    }
    
    // Apply layer visibility filters (show/hide by source)
    const enabledSourceIds = layers.filter(l => l.enabled).map(l => l.id);
    filtered = filtered.filter(e => enabledSourceIds.includes(e.source));
    
    // Apply date range filter
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
  }, [allEvents, sourceFilter, dateRange, layers]);

  const toggleLayer = (layerId: string) => {
    setLayers(prev => prev.map(layer => 
      layer.id === layerId ? { ...layer, enabled: !layer.enabled } : layer
    ));
  };

  // Toggle all layers on/off
  const toggleAllLayers = () => {
    const allEnabled = layers.every(l => l.enabled);
    setLayers(prev => prev.map(layer => ({ ...layer, enabled: !allEnabled })));
  };

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

  const totalEvents = filteredEvents.length;
  const totalMapEvents = mapEvents.length;

  return (
    <div className="space-y-4">
      {ToastComponent}
      
      {/* Header with title and controls */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Traffic Map</h1>
          <p className="text-sm text-muted-foreground">
            {totalEvents} events on map • {totalMapEvents} markers visible
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
          
          <Button variant="outline" size="sm" onClick={toggleAllLayers}>
            <Layers className="w-3.5 h-3.5 mr-1.5" />
            {layers.every(l => l.enabled) ? 'Hide All' : 'Show All'}
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
          <CardContent className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold text-foreground">Filter Events</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowFilters(false)}><X className="w-4 h-4" /></Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Data Source</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { value: 'all', label: 'All', icon: <MapPin className="w-3.5 h-3.5" /> },
                    { value: 'caltrans', label: 'Caltrans', icon: <Car className="w-3.5 h-3.5" /> },
                    { value: 'bayarea511', label: '511.org', icon: <Radio className="w-3.5 h-3.5" /> },
                    { value: 'chp-live', label: 'CHP Live', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
                    { value: 'chp-historical', label: 'Historical', icon: <Calendar className="w-3.5 h-3.5" /> },
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

      {/* Layer Toggle Cards - Color coded, click to show/hide markers */}
      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-5 gap-2">
        {/* Layer Toggle Buttons */}
        {layers.map((layer) => (
          <button
            key={layer.id}
            onClick={() => toggleLayer(layer.id)}
            className={`rounded-xl p-1 text-center transition-all duration-200 hover:shadow-md ${
              layer.enabled 
                ? `${layer.activeBgColor} border-2 border-${layer.color}-400 dark:border-${layer.color}-500` 
                : 'bg-muted/30 border border-border hover:bg-muted/50'
            }`}
          >
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className={layer.enabled ? layer.activeColor : 'text-muted-foreground'}>
                {layer.icon}
              </span>
              <p className={`text-2xl font-bold ${layer.enabled ? layer.activeColor : 'text-muted-foreground'}`}>
                {layer.count}
              </p>
            </div>
            <p className={`text-sm font-medium ${layer.enabled ? layer.activeColor : 'text-muted-foreground'}`}>
              {layer.name}
            </p>
            <div className="flex items-center justify-center gap-1 mt-1">
              {layer.enabled ? (
                <Eye className="w-3 h-3 text-green-500" />
              ) : (
                <EyeOff className="w-3 h-3 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">
                {layer.enabled ? 'Visible' : 'Hidden'}
              </span>
            </div>
          </button>
        ))}
        {/* Total Events Card */}
        <Card className="text-center hover:shadow-md transition-shadow">
          <CardContent className="p-1">
            <p className="text-3xl font-bold text-foreground">{totalEvents}</p>
            <p className="text-xs text-muted-foreground">Current Events</p>
            {/* <p className="text-xs text-muted-foreground mt-1">{totalMapEvents} on map</p> */}
            <div className="flex items-center justify-center gap-1 mt-1">
              <Eye className="w-3 h-3 text-green-500" />
              <span className="text-xs text-muted-foreground">
                  Visible
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Map Legend */}
      <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
        {layers.map((layer) => (
          layer.enabled && (
            <div key={layer.id} className="flex items-center gap-1.5">
              <div className={`w-3 h-3 rounded-full bg-${layer.color}-500`}></div>
              <span>{layer.name}</span>
            </div>
          )
        ))}
        <div className="flex items-center gap-1.5">
          <MapPin className="w-3 h-3" />
          <span>Click any marker to view service details</span>
        </div>
      </div>

      {/* Master Map */}
      <Card>
        <CardContent className="p-0 overflow-hidden rounded-xl">
          {mapEvents.length > 0 ? (
            <SimpleMap events={mapEvents} center={[39.3, -123.5]} zoom={10} height="400px" />
          ) : (
            <div className="h-[600px] bg-muted flex flex-col items-center justify-center">
              <MapPin className="w-12 h-12 text-muted-foreground mb-2" />
              <p className="text-muted-foreground">No events with location data</p>
              <p className="text-sm text-muted-foreground mt-1">
                Try enabling data layers above or adjusting filters
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}