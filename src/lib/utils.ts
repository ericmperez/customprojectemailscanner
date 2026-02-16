import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ---------------------------------------------------------------------------
// Date / Time formatting (ported from app.js)
// ---------------------------------------------------------------------------

export function parseSheetDateValue(value: string | null | undefined): Date | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toLowerCase() === 'no disponible') return null;

  const numericValue = Number(trimmed);
  if (!Number.isNaN(numericValue) && numericValue > 59) {
    const milliseconds = Math.round((numericValue - 25569) * 86400 * 1000);
    const dateFromSerial = new Date(milliseconds);
    if (!Number.isNaN(dateFromSerial.getTime())) return dateFromSerial;
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime())) return parsed;

  return null;
}

export function formatSiteVisitDate(value: string | null | undefined): string {
  const date = parseSheetDateValue(value);
  if (!date) return 'No disponible';
  return date.toLocaleDateString('es-PR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function normalizeTimeValue(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toLowerCase() === 'no disponible') return null;

  const numericValue = Number(trimmed);
  if (!Number.isNaN(numericValue) && numericValue >= 0 && numericValue < 24) {
    const totalMinutes =
      numericValue < 1 ? Math.round(numericValue * 24 * 60) : Math.round(numericValue * 60);
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  const sanitized = trimmed
    .replace(/a\.?\s*m\.?/gi, 'AM')
    .replace(/p\.?\s*m\.?/gi, 'PM')
    .replace(/[()]/g, ' ')
    .replace(/[,.;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const firstTokenMatch = sanitized.match(/(\d{1,2}[:.]\d{2}\s*(?:AM|PM)?)/i);
  const target = firstTokenMatch ? firstTokenMatch[1] : sanitized;

  const amPmMatch = target.match(/^(\d{1,2})[:.](\d{2})\s*(AM|PM)$/i);
  if (amPmMatch) {
    let hours = parseInt(amPmMatch[1], 10);
    const minutes = amPmMatch[2];
    const period = amPmMatch[3].toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  const hourPeriodMatch = target.match(/^(\d{1,2})\s*(AM|PM)$/i);
  if (hourPeriodMatch) {
    let hours = parseInt(hourPeriodMatch[1], 10);
    const period = hourPeriodMatch[2].toUpperCase();
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    return `${String(hours % 24).padStart(2, '0')}:00`;
  }

  const standardMatch = target.match(/^(\d{1,2})[:.](\d{2})(?::(\d{2}))?$/);
  if (standardMatch) {
    const hours = parseInt(standardMatch[1], 10);
    const minutes = standardMatch[2];
    return `${String(hours % 24).padStart(2, '0')}:${minutes}`;
  }

  return null;
}

export function formatTimeLabel(value: string | null | undefined): string | null {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  if (!trimmed || trimmed.toLowerCase() === 'no disponible') return null;

  const normalized = normalizeTimeValue(trimmed);
  if (!normalized) return trimmed || null;

  const [hoursStr, minutesStr] = normalized.split(':');
  const hours = Number(hoursStr);
  if (Number.isNaN(hours)) return normalized;

  const minutes = minutesStr ?? '00';
  const suffix = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;

  return `${displayHours}:${minutes} ${suffix}`;
}

export function truncate(text: string | null | undefined, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function extractTownFromLocation(location: string | null | undefined): string {
  if (!location || location === 'No disponible') return '';
  const parts = location.split(',');
  return (parts[0] || '').trim();
}

export function badgeText(status: string | null | undefined): string {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'approved') return 'Aprobada';
  if (normalized === 'rejected') return 'Rechazada';
  return 'Pendiente';
}

export function resolvePdfUrl(rawLink: string | null | undefined): string {
  if (!rawLink) return '#';
  const stringValue = String(rawLink).trim();
  if (!stringValue) return '#';

  const hyperlinkMatch = stringValue.match(/(?:HYPERLINK|HIPERVINCULO)\s*\(\s*"([^"]+)"/i);
  if (hyperlinkMatch) return hyperlinkMatch[1];

  const urlMatch = stringValue.match(/https?:\/\/[^\s"')]+/i);
  if (urlMatch) return urlMatch[0];

  if (stringValue.startsWith('http')) return stringValue;

  return '#';
}

// ---------------------------------------------------------------------------
// Confidence & Scoring helpers
// ---------------------------------------------------------------------------

import type { Licitacion } from './types';

/**
 * Extract confidence percentage from extractionMethod field.
 * Expects format like "GPT-4o (85%)" → 85
 */
/**
 * Parse estimated value string into a number.
 * Strips "$", commas, whitespace → returns number | null
 */
export function parseEstimatedValue(value: string | null | undefined): number | null {
  if (!value) return null;
  const cleaned = String(value).replace(/[$,\s]/g, '').trim();
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isNaN(num) ? null : num;
}

/**
 * Format number as currency string: $45,000
 */
export function formatCurrency(value: number): string {
  return '$' + value.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

export function parseConfidence(extractionMethod: string | null | undefined): number | null {
  if (!extractionMethod) return null;
  const match = String(extractionMethod).match(/(\d+)\s*%/);
  if (match) return parseInt(match[1], 10);
  return null;
}

/**
 * Compute a 1-10 "Worth It" score for quick prioritization.
 * - Priority: High=3, Medium=2, Low=1 (max 3 pts)
 * - Deadline proximity: ≤3 days=3, ≤7 days=2, ≤14 days=1 (max 3 pts)
 * - Has estimated value: +2 pts
 * - Has site visit: +2 pts
 * - Cap at 10
 */
export function computeWorthItScore(lic: Licitacion): number {
  let score = 0;

  if (lic.isEmergency) score += 4;

  // Priority points
  const priority = (lic.priority || '').toLowerCase();
  if (priority === 'high' || priority === 'alta') score += 3;
  else if (priority === 'medium' || priority === 'media') score += 2;
  else if (priority === 'low' || priority === 'baja') score += 1;

  // Deadline proximity
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  let deadline: Date | null = null;

  if (lic.biddingCloseDate && lic.biddingCloseDate !== 'No disponible') {
    const d = new Date(lic.biddingCloseDate);
    if (!Number.isNaN(d.getTime())) deadline = d;
  }
  if (lic.siteVisitDate && lic.siteVisitDate !== 'No disponible') {
    const d = new Date(lic.siteVisitDate);
    if (!Number.isNaN(d.getTime()) && (!deadline || d < deadline)) deadline = d;
  }

  if (deadline) {
    const daysRemaining = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (daysRemaining >= 0 && daysRemaining <= 3) score += 3;
    else if (daysRemaining >= 0 && daysRemaining <= 7) score += 2;
    else if (daysRemaining >= 0 && daysRemaining <= 14) score += 1;
  }

  // Estimated value bonus
  const ev = String(lic.estimatedValue || '').trim();
  if (ev && ev !== 'No disponible') score += 2;

  // Site visit bonus
  const vl = String(lic.visitLocation || '').trim();
  if (vl && vl.toLowerCase() !== 'no disponible') score += 2;

  return Math.min(score, 10);
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

export function sortLicitaciones(licitaciones: Licitacion[], sortBy: string): Licitacion[] {
  const sorted = [...licitaciones];

  switch (sortBy) {
    case 'visit-date-asc':
      return sorted.sort((a, b) => {
        const dateA = a.siteVisitDate && a.siteVisitDate !== 'No disponible' ? new Date(a.siteVisitDate) : new Date('9999-12-31');
        const dateB = b.siteVisitDate && b.siteVisitDate !== 'No disponible' ? new Date(b.siteVisitDate) : new Date('9999-12-31');
        return dateA.getTime() - dateB.getTime();
      });

    case 'close-date-asc':
      return sorted.sort((a, b) => {
        const dateA = a.biddingCloseDate && a.biddingCloseDate !== 'No disponible' ? new Date(a.biddingCloseDate) : new Date('9999-12-31');
        const dateB = b.biddingCloseDate && b.biddingCloseDate !== 'No disponible' ? new Date(b.biddingCloseDate) : new Date('9999-12-31');
        return dateA.getTime() - dateB.getTime();
      });

    case 'email-date-desc':
      return sorted.sort((a, b) => {
        const dateA = a.emailDate ? new Date(a.emailDate) : new Date(0);
        const dateB = b.emailDate ? new Date(b.emailDate) : new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

    case 'email-date-asc':
      return sorted.sort((a, b) => {
        const dateA = a.emailDate ? new Date(a.emailDate) : new Date(0);
        const dateB = b.emailDate ? new Date(b.emailDate) : new Date(0);
        return dateA.getTime() - dateB.getTime();
      });

    case 'title-asc':
      return sorted.sort((a, b) => (a.subject || '').localeCompare(b.subject || '', 'es'));

    case 'title-desc':
      return sorted.sort((a, b) => (b.subject || '').localeCompare(a.subject || '', 'es'));

    case 'score-desc':
      return sorted.sort((a, b) => computeWorthItScore(b) - computeWorthItScore(a));

    case 'score-asc':
      return sorted.sort((a, b) => computeWorthItScore(a) - computeWorthItScore(b));

    case 'close-date-desc':
      return sorted.sort((a, b) => {
        const dateA = a.biddingCloseDate && a.biddingCloseDate !== 'No disponible' ? new Date(a.biddingCloseDate) : new Date(0);
        const dateB = b.biddingCloseDate && b.biddingCloseDate !== 'No disponible' ? new Date(b.biddingCloseDate) : new Date(0);
        return dateB.getTime() - dateA.getTime();
      });

    case 'type-asc':
      return sorted.sort((a, b) => {
        const typeA = (String(a.visitLocation || '').trim() && String(a.visitLocation || '').trim().toLowerCase() !== 'no disponible') ? 0 : 1;
        const typeB = (String(b.visitLocation || '').trim() && String(b.visitLocation || '').trim().toLowerCase() !== 'no disponible') ? 0 : 1;
        return typeA - typeB;
      });

    case 'type-desc':
      return sorted.sort((a, b) => {
        const typeA = (String(a.visitLocation || '').trim() && String(a.visitLocation || '').trim().toLowerCase() !== 'no disponible') ? 0 : 1;
        const typeB = (String(b.visitLocation || '').trim() && String(b.visitLocation || '').trim().toLowerCase() !== 'no disponible') ? 0 : 1;
        return typeB - typeA;
      });

    case 'category-asc':
      return sorted.sort((a, b) => (a.category || '').localeCompare(b.category || '', 'es'));

    case 'category-desc':
      return sorted.sort((a, b) => (b.category || '').localeCompare(a.category || '', 'es'));

    case 'contact-asc':
      return sorted.sort((a, b) => (a.contactName || '').localeCompare(b.contactName || '', 'es'));

    case 'contact-desc':
      return sorted.sort((a, b) => (b.contactName || '').localeCompare(a.contactName || '', 'es'));

    case 'value-desc':
      return sorted.sort((a, b) => {
        const valA = parseEstimatedValue(a.estimatedValue);
        const valB = parseEstimatedValue(b.estimatedValue);
        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;
        return valB - valA;
      });

    case 'value-asc':
      return sorted.sort((a, b) => {
        const valA = parseEstimatedValue(a.estimatedValue);
        const valB = parseEstimatedValue(b.estimatedValue);
        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;
        return valA - valB;
      });

    default:
      return sorted;
  }
}

// ---------------------------------------------------------------------------
// CSV Export
// ---------------------------------------------------------------------------

export function arrayToCSV(data: Licitacion[]): string {
  if (!data || data.length === 0) return '';

  const columns = [
    { key: 'subject' as const, label: 'Título' },
    { key: 'category' as const, label: 'Categoría' },
    { key: 'approvalStatus' as const, label: 'Estado' },
    { key: 'location' as const, label: 'Ubicación' },
    { key: 'description' as const, label: 'Descripción' },
    { key: 'biddingCloseDate' as const, label: 'Fecha Cierre' },
    { key: 'biddingCloseTime' as const, label: 'Hora Cierre' },
    { key: 'siteVisitDate' as const, label: 'Fecha Visita' },
    { key: 'siteVisitTime' as const, label: 'Hora Visita' },
    { key: 'visitLocation' as const, label: 'Lugar Visita' },
    { key: 'contactName' as const, label: 'Contacto' },
    { key: 'contactPhone' as const, label: 'Teléfono' },
    { key: 'emailDate' as const, label: 'Fecha Email' },
    { key: 'pdfFilename' as const, label: 'Archivo PDF' },
    { key: 'estimatedValue' as const, label: 'Valor Estimado' },
  ];

  const headerRow = columns.map((col) => `"${col.label}"`).join(',');
  const dataRows = data.map((item) => {
    return columns
      .map((col) => {
        let value = String(item[col.key] || '');
        value = value.replace(/"/g, '""');
        return `"${value}"`;
      })
      .join(',');
  });

  return [headerRow, ...dataRows].join('\n');
}

export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// ICS Export
// ---------------------------------------------------------------------------

export function exportToICalendar(licitaciones: Licitacion[]): void {
  const visits = licitaciones.filter(
    (lic) => lic.siteVisitDate && lic.siteVisitDate !== 'No disponible'
  );

  if (visits.length === 0) return;

  const escapeICalText = (text: string) => {
    if (!text) return '';
    return String(text)
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  };

  const formatICalDate = (date: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      date.getFullYear() +
      pad(date.getMonth() + 1) +
      pad(date.getDate()) +
      'T' +
      pad(date.getHours()) +
      pad(date.getMinutes()) +
      pad(date.getSeconds())
    );
  };

  const icalContent: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Licitaciones Dashboard//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Visitas Licitaciones',
    'X-WR-TIMEZONE:America/Puerto_Rico',
  ];

  visits.forEach((lic) => {
    try {
      const visitDate = new Date(lic.siteVisitDate);
      const startDate = new Date(visitDate);

      if (lic.siteVisitTime && lic.siteVisitTime !== 'Sin hora') {
        const [hours, minutes] = lic.siteVisitTime.split(':');
        startDate.setHours(parseInt(hours) || 9, parseInt(minutes) || 0, 0, 0);
      } else {
        startDate.setHours(9, 0, 0, 0);
      }

      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);

      const uid = `lic-${lic.id}-${Date.now()}@licitaciones-dashboard`;
      const summary = escapeICalText(`Visita: ${lic.title || lic.subject || 'Sin título'}`);
      const location = escapeICalText(lic.visitLocation || '');
      const description = escapeICalText(
        `Licitación: ${lic.title || lic.subject || ''}\\nUbicación: ${lic.visitLocation || 'N/A'}\\nContacto: ${lic.contactName || 'N/A'}\\nTeléfono: ${lic.contactPhone || 'N/A'}\\nCategoría: ${lic.category || 'N/A'}`
      );

      icalContent.push('BEGIN:VEVENT');
      icalContent.push(`UID:${uid}`);
      icalContent.push(`DTSTAMP:${formatICalDate(new Date())}`);
      icalContent.push(`DTSTART:${formatICalDate(startDate)}`);
      icalContent.push(`DTEND:${formatICalDate(endDate)}`);
      icalContent.push(`SUMMARY:${summary}`);
      if (location) icalContent.push(`LOCATION:${location}`);
      icalContent.push(`DESCRIPTION:${description}`);
      icalContent.push('STATUS:CONFIRMED');
      icalContent.push('BEGIN:VALARM');
      icalContent.push('TRIGGER:-P1D');
      icalContent.push('ACTION:DISPLAY');
      icalContent.push(`DESCRIPTION:Visita mañana: ${summary}`);
      icalContent.push('END:VALARM');
      icalContent.push('END:VEVENT');
    } catch (error) {
      console.error(`Error creating iCal event:`, error);
    }
  });

  icalContent.push('END:VCALENDAR');

  const icalString = icalContent.join('\r\n');
  const blob = new Blob([icalString], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `visitas-licitaciones-${new Date().toISOString().split('T')[0]}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
