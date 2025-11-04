export function normalizeVisitLocationLabel(value) {
    if (value === undefined || value === null) {
        return '';
    }

    const normalized = value
        .toString()
        .trim()
        .replace(/\s+/g, ' ');

    if (!normalized) {
        return '';
    }

    const lower = normalized.toLowerCase();
    if (lower === 'no disponible' || lower === 'no especificada' || lower === 'n/a') {
        return '';
    }

    return normalized;
}

export function normalizeVisitLocationFilterValue(value) {
    const label = normalizeVisitLocationLabel(value);
    return label ? label.toLowerCase() : '';
}
