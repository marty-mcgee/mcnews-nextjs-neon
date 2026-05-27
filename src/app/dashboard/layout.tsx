// src/app/dashboard/layout.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import * as Tabs from '@radix-ui/react-tabs';
import { 
  Flame, Activity, Sun, Moon, MapPin, AlertTriangle, BarChart3, Radio, Car, 
  Gauge, TrendingUp, Droplets 
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const dynamic = 'force-dynamic';

const tabs = [
  { path: '/dashboard', name: 'Overview', icon: <MapPin className="w-4 h-4 text-blue-500" />, color: 'blue' },
  { path: '/dashboard/chp-live', name: 'CHP Live', icon: <AlertTriangle className="w-4 h-4 text-red-500" />, color: 'red' },
  { path: '/dashboard/511org', name: 'Bay Area 511', icon: <Radio className="w-4 h-4 text-emerald-500" />, color: 'emerald' },
  { path: '/dashboard/caltrans', name: 'Caltrans', icon: <Car className="w-4 h-4 text-blue-500" />, color: 'blue' },
  { path: '/dashboard/calfire', name: 'CalFire', icon: <Flame className="w-4 h-4 text-orange-500" />, color: 'orange' },
  { path: '/dashboard/chp-historical', name: 'CHP Historical', icon: <BarChart3 className="w-4 h-4 text-purple-500" />, color: 'purple' },
];

const getTabColor = (color: string) => {
  const colors: Record<string, string> = {
    blue: 'data-[state=active]:bg-blue-50 dark:data-[state=active]:bg-blue-950/30 data-[state=active]:text-blue-700 dark:data-[state=active]:text-blue-400',
    red: 'data-[state=active]:bg-red-50 dark:data-[state=active]:bg-red-950/30 data-[state=active]:text-red-700 dark:data-[state=active]:text-red-400',
    emerald: 'data-[state=active]:bg-emerald-50 dark:data-[state=active]:bg-emerald-950/30 data-[state=active]:text-emerald-700 dark:data-[state=active]:text-emerald-400',
    orange: 'data-[state=active]:bg-orange-50 dark:data-[state=active]:bg-orange-950/30 data-[state=active]:text-orange-700 dark:data-[state=active]:text-orange-400',
    purple: 'data-[state=active]:bg-purple-50 dark:data-[state=active]:bg-purple-950/30 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-400',
  };
  return colors[color] || colors.blue;
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-background" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/20">
      {/* Header */}
      <header className="bg-background/80 backdrop-blur-md border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center shadow-lg">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  NorCal Traffic & Incident Monitor
                </h1>
                <p className="text-xs text-muted-foreground">
                  Real-time data from Caltrans, 511.org, CHP, and CalFire
                </p>
              </div>
            </div>
            
            {/* Right side controls */}
            <div className="flex items-center gap-3">
              {/* Status Indicator */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/30">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">Live Data</span>
              </div>
              
              {/* Theme Toggle */}
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="rounded-full"
              >
                {theme === 'dark' ? (
                  <Sun className="w-4 h-4 text-yellow-500" />
                ) : (
                  <Moon className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Tab Navigation */}
        <Tabs.Root value={pathname} className="mb-6">
          <Tabs.List className="flex flex-wrap gap-1.5 bg-muted/50 p-1 rounded-xl">
            {tabs.map((tab) => (
              <Tabs.Trigger
                key={tab.path}
                value={tab.path}
                asChild
                className={`
                  px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200
                  text-muted-foreground hover:text-foreground hover:bg-muted
                  data-[state=active]:shadow-sm data-[state=active]:ring-1 data-[state=active]:ring-border
                  ${getTabColor(tab.color)}
                `}
              >
                <Link href={tab.path} className="flex items-center gap-2">
                  {tab.icon}
                  <span className="hidden sm:inline">{tab.name}</span>
                  {/* Optional: Add active indicator dot */}
                  {pathname === tab.path && (
                    <span className="w-1.5 h-1.5 rounded-full bg-current ml-1" />
                  )}
                </Link>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>

        {/* Page Content */}
        <div className="rounded-2xl bg-background/50 backdrop-blur-sm border shadow-sm overflow-hidden">
          {children}
        </div>
        
        {/* Footer */}
        <footer className="mt-8 py-4 text-center text-xs text-muted-foreground border-t">
          <p>
            Data sourced from Caltrans CWWP2, 511.org, CHP CAD, CHP CKAN, and CalFire APIs.
            Updated in real-time. Map data © OpenStreetMap contributors.
          </p>
          <p className="mt-1">
            Last fetch times vary by source. Use refresh buttons to manually update.
          </p>
        </footer>
      </div>
    </div>
  );
}