'use client';

import { use } from 'react';
import { CotizacionWorksheet } from '@/components/licitaciones/CotizacionWorksheet';

export default function CotizacionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <CotizacionWorksheet licitacionId={id} />;
}
