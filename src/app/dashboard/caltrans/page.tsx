// src/app/dashboard/caltrans/page.tsx
'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const Content = dynamic(
  () => import('./caltransContent'),
  { ssr: false, loading: () => <div className="p-12 text-center">Loading Caltrans data...</div> }
);

export default function CaltransPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="p-12 text-center">Loading...</div>;
  }

  return <Content />;
}