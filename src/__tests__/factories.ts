import type { Licitacion, Stats } from '@/lib/types';

let _id = 100;

export function buildLicitacion(overrides: Partial<Licitacion> = {}): Licitacion {
  const id = overrides.id ?? `lic-${++_id}`;
  return {
    id,
    processedAt: '2025-03-01T10:00:00Z',
    emailDate: '2025-03-01',
    subject: 'Licitación de prueba',
    title: 'Mantenimiento de A/C en EBAS',
    location: 'San Juan',
    description: 'Mantenimiento preventivo trimestral de unidades A/C.',
    summary: 'Fix the A/C units at the water plant.',
    category: 'Mantenimiento',
    priority: 'Medium',
    pdfFilename: 'licitacion.pdf',
    pdfLink: '=HYPERLINK("https://example.com/pdf","Ver PDF")',
    pdfUrl: 'https://example.com/pdf',
    siteVisitDate: '2025-03-15',
    siteVisitTime: '10:00',
    visitLocation: 'EBAS Torrecilla, Loíza',
    visitRequirements: 'No disponible',
    contactName: 'Juan Pérez',
    contactPhone: '(787) 555-1234',
    contactEmail: 'juan@example.com',
    biddingCloseDate: '2025-03-30',
    biddingCloseTime: '14:00',
    estimatedValue: '$45,000',
    extractionMethod: 'GPT-4o (85%)',
    emailId: `msg-${id}`,
    approvalStatus: 'pending',
    approvalNotes: '',
    interested: false,
    isEmergency: false,
    decisionStatus: 'researching',
    ...overrides,
  };
}

export function buildStats(overrides: Partial<Stats> = {}): Stats {
  return {
    total: 10,
    pending: 5,
    approved: 3,
    rejected: 2,
    interested: 1,
    ...overrides,
  };
}
