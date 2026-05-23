// src/app/dashboard/layout.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import * as Tabs from '@radix-ui/react-tabs';
import { Activity, Sun, Moon, MapPin, AlertTriangle, BarChart3, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

const tabs = [
  { path: '/dashboard', name: 'Overview', icon: AlertTriangle },
  { path: '/dashboard/511org', name: 'Bay Area 511', icon: Radio },
  { path: '/dashboard/caltrans', name: 'Caltrans', icon: MapPin },
  { path: '/dashboard/chp-live', name: 'CHP Live', icon: AlertTriangle },
  { path: '/dashboard/chp-historical', name: 'CHP Historical', icon: BarChart3 },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="min-h-screen bg-gray-50 dark:bg-gray-950" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-950 dark:to-gray-900">
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 flex items-center justify-center">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  California Traffic Monitor
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">Real-time data from Caltrans, 511.org, and CHP</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
                {theme === 'dark' ? <Sun className="w-4 h-4 text-yellow-500" /> : <Moon className="w-4 h-4" />}
              </Button>
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/30">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-xs text-green-600 dark:text-green-400 font-medium">Live</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs.Root value={pathname} className="mb-6">
          <Tabs.List className="flex flex-wrap gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            {tabs.map((tab) => (
              <Tabs.Trigger
                key={tab.path}
                value={tab.path}
                asChild
                className="px-5 py-2.5 rounded-lg text-sm font-medium transition-all data-[state=active]:bg-white dark:data-[state=active]:bg-gray-900 data-[state=active]:shadow-sm"
              >
                <Link href={tab.path} className="flex items-center gap-2">
                  <tab.icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.name}</span>
                </Link>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
        </Tabs.Root>

        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl border overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}