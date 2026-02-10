export interface Licitacion {
  id: number;
  rowNumber: number;
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
  id: number;
  rowNumber: number;
  subject: string;
  title?: string;
  location: string;
  visitLocation: string;
  category: string;
  approvalStatus: string;
  decisionStatus: string;
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

export interface PriceResult {
  item: string;
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
