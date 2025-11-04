import assert from 'assert';
import { normalizeVisitLocationLabel, normalizeVisitLocationFilterValue } from '../src/services/visit-location.utils.js';

function filterByVisitLocation(licitaciones, filters) {
    const filterSet = new Set(
        filters
            .map(normalizeVisitLocationFilterValue)
            .filter(Boolean)
    );

    return licitaciones.filter(lic => {
        const normalized = normalizeVisitLocationFilterValue(lic.visitLocation);
        return normalized && filterSet.has(normalized);
    });
}

(function runTests() {
    const samples = [
        { visitLocation: 'EBAS ALTURAS DE VEGA BAJA' },
        { visitLocation: ' Ebas Alturas   de  Vega Baja ' },
        { visitLocation: 'No disponible' },
        { visitLocation: 'Plaza Pública de Barceloneta' },
        { visitLocation: 'Plaza  Publica   de  Barceloneta' },
        { visitLocation: 'N/A' },
    ];

    const filters = ['ebas alturas de vega baja', 'Plaza Pública de Barceloneta'];
    const filtered = filterByVisitLocation(samples, filters);

    assert.strictEqual(filtered.length, 4, 'Should match all normalized duplicates');

    const uniqueLabels = filtered
        .map(item => normalizeVisitLocationLabel(item.visitLocation))
        .filter(Boolean);

    assert.deepStrictEqual(
        uniqueLabels,
        [
            'EBAS ALTURAS DE VEGA BAJA',
            'Ebas Alturas de Vega Baja',
            'Plaza Pública de Barceloneta',
            'Plaza Publica de Barceloneta'
        ],
        'Normalization should preserve human-readable labels'
    );

    assert.strictEqual(normalizeVisitLocationLabel('  \nSector El Pastillo\t '), 'Sector El Pastillo');
    assert.strictEqual(normalizeVisitLocationLabel('no especificada'), '');
    assert.strictEqual(normalizeVisitLocationFilterValue('Plaza Pública'), 'plaza pública');

    console.log('✓ visit location filtering test passed');
})();
