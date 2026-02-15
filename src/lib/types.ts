export interface Licitacion {
  id: string;
  rowNumber?: number;  // Legacy field for backwards compat, not used in Supabase
  processedAt: string;
  emailDate: string;
  subject: string;
  title: string;
  location: string;
  description: string;
  summary: string;
  category: string;
  priority: string;
  pdfFilename: string;
  pdfLink: string;
  pdfUrl: string;
  siteVisitDate: string;
  siteVisitTime: string;
  visitLocation: string;
  visitRequirements: string;
  contactName: string;
  contactPhone: string;
  contactEmail?: string;
  biddingCloseDate: string;
  biddingCloseTime: string;
  estimatedValue: string;
  extractionMethod: string;
  emailId: string;
  approvalStatus: 'pending' | 'approved' | 'rejected';
  approvalNotes: string;
  interested: boolean;
  isEmergency: boolean;
  decisionStatus: string;
}

export interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  interested: number;
}

export interface Visit {
  id: string;
  rowNumber?: number;
  subject: string;
  title?: string;
  location: string;
  visitLocation: string;
  category: string;
  approvalStatus: string;
  decisionStatus: string;
  visitRequirements?: string;
  visitDate: string;
  visitTime: string | null;
  rawVisitDate: string;
  rawVisitTime: string;
  pdfLink: string;
  pdfUrl: string;
  pdfFilename: string;
  emailDate: string;
}

export interface FilterOptions {
  towns: string[];
  categories: string[];
}

export interface Filters {
  status?: string;
  category?: string;
  type?: string;
  priority?: string;
  visitLocation?: string[];
  town?: string[];
  dateRange?: string;
  interested?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface QuoteItem {
  item: string;
  qty: number;
  unit: string;
}

export interface PriceResult {
  item: string;
  qty: number;
  unit: string;
  price: string;
  sourceUrl: string;
  sourceName: string;
  notes: string;
}

export interface PriceSearchResponse {
  results: PriceResult[];
  query: string;
  searchedAt: string;
}

// Confidence field classification
export const CONFIDENCE_FIELDS = [
  'title',
  'location',
  'description',
  'summary',
  'category',
  'siteVisitDate',
  'siteVisitTime',
  'visitLocation',
  'visitRequirements',
  'contactName',
  'contactPhone',
  'biddingCloseDate',
  'biddingCloseTime',
  'estimatedValue',
] as const;

export type ConfidenceFieldName = (typeof CONFIDENCE_FIELDS)[number];

export interface ConfidenceFieldSettings {
  critical: ConfidenceFieldName[];
  optional: ConfidenceFieldName[];
  ignored: ConfidenceFieldName[];
}

export interface CorrectionExample {
  field: string;
  original: string;
  corrected: string;
  context?: string;
  savedAt: string;
}
