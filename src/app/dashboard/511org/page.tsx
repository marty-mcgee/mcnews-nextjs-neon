// src/app/dashboard/511org/page.tsx
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import the content component with no SSR
const Content = dynamic(
  () => import('./511orgContent'),
  { ssr: false, loading: () => <div className="p-12 text-center">Loading Bay Area 511 data...</div> }
);

export default function BayArea511Page() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="p-12 text-center">Loading...</div>;
  }

  return <Content />;
}