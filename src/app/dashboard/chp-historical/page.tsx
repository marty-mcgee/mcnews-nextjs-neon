// src/app/dashboard/chp-historical/page.tsx
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const CHPHistoricalContent = dynamic(
  () => import('./chpHistoricalContent'),
  { ssr: false, loading: () => <div className="p-12 text-center">Loading...</div> }
);

export default function CHPHistoricalPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="p-12 text-center">Loading...</div>;
  }

  return <CHPHistoricalContent />;
}