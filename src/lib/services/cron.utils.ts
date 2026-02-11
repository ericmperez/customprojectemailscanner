/**
 * Check if a bidding close date is still in the future (or today).
 * Supports MM/DD/YYYY and Spanish date formats.
 */
export function isBiddingOpen(closeDateStr: string): boolean {
  if (!closeDateStr || closeDateStr === 'No disponible') return true; // assume open if unknown

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Try MM/DD/YYYY
  const slashMatch = closeDateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slashMatch) {
    const month = parseInt(slashMatch[1], 10) - 1;
    const day = parseInt(slashMatch[2], 10);
    const year = parseInt(slashMatch[3], 10);
    const closeDate = new Date(year, month, day);
    closeDate.setHours(23, 59, 59, 999);
    return closeDate >= today;
  }

  // Try Spanish format: "15 de marzo de 2025"
  const spanishMonths: Record<string, number> = {
    enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
    julio: 6, agosto: 7, septiembre: 8, octubre: 9, noviembre: 10, diciembre: 11,
  };

  const spanishMatch = closeDateStr.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
  if (spanishMatch) {
    const day = parseInt(spanishMatch[1], 10);
    const monthName = spanishMatch[2].toLowerCase();
    const year = parseInt(spanishMatch[3], 10);
    const month = spanishMonths[monthName];
    if (month !== undefined) {
      const closeDate = new Date(year, month, day);
      closeDate.setHours(23, 59, 59, 999);
      return closeDate >= today;
    }
  }

  // Try generic Date.parse as fallback
  const parsed = new Date(closeDateStr);
  if (!isNaN(parsed.getTime())) {
    parsed.setHours(23, 59, 59, 999);
    return parsed >= today;
  }

  return true; // assume open if unparseable
}

/**
 * Check if a PDF filename indicates meeting minutes (skip these).
 */
export function isMinutaOrAsistencia(filename: string): boolean {
  const lower = filename.toLowerCase();
  return lower.includes('minuta') || lower.includes('asistencia');
}
