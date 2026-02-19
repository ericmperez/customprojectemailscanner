import type { PRSupplier, QuoteItem } from '@/lib/types';

export const PR_SUPPLIERS: PRSupplier[] = [
  {
    name: 'Grainger Caribe',
    phone: '787-275-3500',
    website: 'https://www.grainger.com',
    categories: ['industrial', 'electrical', 'plumbing', 'safety'],
    town: 'Catano',
  },
  {
    name: 'Home Depot (Bayamon)',
    phone: '787-778-2580',
    website: 'https://www.homedepot.com',
    categories: ['construction', 'hardware', 'electrical', 'plumbing', 'paint'],
    town: 'Bayamon',
  },
  {
    name: 'Home Depot (Caguas)',
    phone: '787-703-1400',
    website: 'https://www.homedepot.com',
    categories: ['construction', 'hardware', 'electrical', 'plumbing', 'paint'],
    town: 'Caguas',
  },
  {
    name: 'Home Depot (Carolina)',
    phone: '787-776-1000',
    website: 'https://www.homedepot.com',
    categories: ['construction', 'hardware', 'electrical', 'plumbing', 'paint'],
    town: 'Carolina',
  },
  {
    name: 'National Lumber & Hardware',
    phone: '787-765-1830',
    categories: ['construction', 'lumber', 'hardware', 'paint', 'tools'],
    town: 'San Juan',
  },
  {
    name: 'Fastenal (Caguas)',
    phone: '787-745-3444',
    website: 'https://www.fastenal.com',
    categories: ['industrial', 'fasteners', 'safety', 'tools'],
    town: 'Caguas',
  },
  {
    name: 'Fastenal (Rio Grande)',
    phone: '787-809-0055',
    website: 'https://www.fastenal.com',
    categories: ['industrial', 'fasteners', 'safety', 'tools'],
    town: 'Rio Grande',
  },
  {
    name: 'United Electrical Supply',
    phone: '787-763-0779',
    categories: ['electrical'],
    town: 'San Juan',
  },
  {
    name: 'Bayamon Plumbing & Industrial',
    phone: '787-798-3130',
    categories: ['plumbing', 'industrial'],
    town: 'Bayamon',
  },
  {
    name: 'Fast Office Supply',
    phone: '787-766-0067',
    categories: ['office supplies', 'equipment'],
    town: 'San Juan',
  },
  {
    name: 'MSC Industrial',
    phone: '1-800-432-4044',
    website: 'https://www.mscdirect.com',
    categories: ['industrial', 'tools', 'metalworking'],
    town: 'Ship to PR',
  },
];

/** Maps supplier category names to item keywords for matching */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  electrical: ['electrical', 'wire', 'cable', 'conduit', 'breaker', 'panel', 'switch', 'outlet', 'light', 'lamp', 'led', 'transformer', 'generator'],
  plumbing: ['plumbing', 'pipe', 'valve', 'faucet', 'pump', 'drain', 'toilet', 'sink', 'water', 'pvc', 'copper'],
  construction: ['concrete', 'cement', 'rebar', 'steel', 'block', 'mason', 'roofing', 'drywall', 'insulation', 'foundation'],
  hardware: ['screw', 'bolt', 'nail', 'nut', 'washer', 'anchor', 'bracket', 'hinge', 'lock', 'door', 'window'],
  paint: ['paint', 'primer', 'coating', 'stain', 'sealant', 'epoxy'],
  safety: ['safety', 'glove', 'helmet', 'vest', 'goggle', 'harness', 'cone', 'extinguisher', 'first aid'],
  industrial: ['motor', 'bearing', 'belt', 'compressor', 'hydraulic', 'pneumatic', 'welding', 'machine'],
  lumber: ['wood', 'lumber', 'plywood', 'board', 'timber', '2x4', '4x4'],
  tools: ['drill', 'saw', 'hammer', 'wrench', 'screwdriver', 'tool', 'level', 'tape measure'],
  fasteners: ['screw', 'bolt', 'nut', 'washer', 'rivet', 'anchor', 'fastener', 'clamp'],
  'office supplies': ['paper', 'printer', 'toner', 'ink', 'folder', 'binder', 'desk', 'chair', 'office'],
  equipment: ['equipment', 'machine', 'device', 'system', 'unit'],
  metalworking: ['metal', 'steel', 'aluminum', 'weld', 'cut', 'grind', 'lathe'],
};

/**
 * Match PR suppliers to extracted items based on category keyword overlap.
 * Returns matching suppliers sorted by relevance (number of matching categories).
 * Falls back to all suppliers if no matches found.
 */
export function matchSuppliersToItems(items: QuoteItem[]): PRSupplier[] {
  if (items.length === 0) return PR_SUPPLIERS;

  const itemText = items.map((it) => it.item.toLowerCase()).join(' ');

  const scored = PR_SUPPLIERS.map((supplier) => {
    let matchCount = 0;
    for (const cat of supplier.categories) {
      const keywords = CATEGORY_KEYWORDS[cat] || [];
      for (const kw of keywords) {
        if (itemText.includes(kw)) {
          matchCount++;
          break; // one match per category is enough
        }
      }
    }
    return { supplier, matchCount };
  });

  const matched = scored
    .filter((s) => s.matchCount > 0)
    .sort((a, b) => b.matchCount - a.matchCount)
    .map((s) => s.supplier);

  return matched.length > 0 ? matched : PR_SUPPLIERS;
}
