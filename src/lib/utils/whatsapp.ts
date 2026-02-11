import type { Licitacion } from '@/lib/types';
import { formatSiteVisitDate, formatTimeLabel, resolvePdfUrl } from '@/lib/utils';

/**
 * Returns true when a licitacion has enough visit info to share a card.
 */
export function hasVisitInfo(lic: Licitacion): boolean {
  const visitLocation = (lic.visitLocation || '').trim();
  const siteVisitDate = (lic.siteVisitDate || '').trim();
  return (
    (!!visitLocation && visitLocation.toLowerCase() !== 'no disponible') ||
    (!!siteVisitDate && siteVisitDate.toLowerCase() !== 'no disponible')
  );
}

/**
 * Builds a `https://wa.me/?text=...` URL containing a formatted visit card.
 * No phone number is embedded — the user picks a recipient in WhatsApp.
 */
export function buildWhatsAppVisitCardUrl(lic: Licitacion): string {
  const lines: string[] = [];

  lines.push('📋 *TARJETA DE VISITA*');
  lines.push('');
  lines.push(`📌 *${lic.title || lic.subject || 'Sin titulo'}*`);
  lines.push('');

  const dateDisplay = formatSiteVisitDate(lic.siteVisitDate);
  if (dateDisplay && dateDisplay !== 'No disponible') {
    lines.push(`🗓️ *Fecha:* ${dateDisplay}`);
  }

  const timeDisplay = formatTimeLabel(lic.siteVisitTime);
  if (timeDisplay) {
    lines.push(`🕐 *Hora:* ${timeDisplay}`);
  }

  const visitLocation = (lic.visitLocation || '').trim();
  if (visitLocation && visitLocation.toLowerCase() !== 'no disponible') {
    lines.push(`📍 *Lugar:* ${visitLocation}`);
  }

  lines.push('');

  const contactName = (lic.contactName || '').trim();
  if (contactName && contactName.toLowerCase() !== 'no disponible') {
    lines.push(`👤 *Contacto:* ${contactName}`);
  }

  const contactPhone = (lic.contactPhone || '').trim();
  if (contactPhone && contactPhone.toLowerCase() !== 'no disponible') {
    lines.push(`📞 *Telefono:* ${contactPhone}`);
  }

  const requirements = (lic.visitRequirements || '').trim();
  if (requirements && requirements.toLowerCase() !== 'no disponible') {
    lines.push('');
    lines.push(`🎒 *Requisitos:* ${requirements}`);
  }

  const pdfUrl = lic.pdfUrl || resolvePdfUrl(lic.pdfLink);
  if (pdfUrl && pdfUrl !== '#') {
    lines.push('');
    lines.push(`📄 *PDF:* ${pdfUrl}`);
  }

  const message = lines.join('\n');
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
