/**
 * Prefix a note with user attribution and timestamp.
 *
 * Example output:
 *   [Eric Perez · 11 feb 2026, 10:30 AM] Esta licitación es buena
 */
export function formatNoteWithAttribution(text: string, userName: string): string {
  const now = new Date();
  const date = now.toLocaleDateString('es-PR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const time = now.toLocaleTimeString('es-PR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `[${userName} · ${date}, ${time}] ${text}`;
}
