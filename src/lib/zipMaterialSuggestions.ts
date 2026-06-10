export interface ZipMaterialSuggestions {
  regionLabel: string;
  note: string;
  suggestions: Record<string, string[]>;
}

export function getZipMaterialSuggestions(zipCode?: string | null): ZipMaterialSuggestions {
  const zip = zipCode?.trim() ?? '';

  if (zip.startsWith('78')) {
    return {
      regionLabel: 'Central Texas',
      note:
        'Material preferences and pricing may vary by ZIP code, local availability, labor market and supplier stock.',
      suggestions: {
        cabinets: ['Shaker style cabinets', 'Semi-custom cabinets', 'Painted cabinets'],
        countertops: ['Quartz', 'Granite', 'Butcher block'],
        flooring: ['Luxury vinyl plank', 'Porcelain tile', 'Engineered wood'],
        roofing: ['Architectural shingles', 'Metal roofing'],
        bathroomTile: ['Porcelain tile', 'Ceramic tile', 'Natural stone look tile'],
      },
    };
  }

  if (zip.startsWith('90') || zip.startsWith('91')) {
    return {
      regionLabel: 'Southern California',
      note:
        'Material choices may be affected by local codes, design trends, supplier availability and labor costs.',
      suggestions: {
        cabinets: ['Custom cabinets', 'Flat-panel cabinets', 'White oak cabinets'],
        countertops: ['Quartz', 'Porcelain slab', 'Premium stone'],
        flooring: ['Engineered wood', 'Luxury vinyl plank', 'Porcelain tile'],
        roofing: ['Tile roofing', 'Cool roof shingles', 'Flat roof membrane'],
        bathroomTile: ['Large-format porcelain tile', 'Designer tile', 'Natural stone'],
      },
    };
  }

  if (zip.startsWith('10') || zip.startsWith('11') || zip.startsWith('12')) {
    return {
      regionLabel: 'New York area',
      note:
        'Material and labor pricing may be affected by building access, permits, union labor, delivery limits and local code requirements.',
      suggestions: {
        cabinets: ['Semi-custom cabinets', 'Custom cabinets', 'Flat-panel cabinets'],
        countertops: ['Quartz', 'Granite', 'Porcelain slab'],
        flooring: ['Engineered wood', 'Luxury vinyl plank', 'Porcelain tile'],
        roofing: ['Flat roof membrane', 'Architectural shingles', 'Metal roofing'],
        bathroomTile: ['Porcelain tile', 'Large-format tile', 'Designer tile'],
      },
    };
  }

  if (zip.startsWith('33') || zip.startsWith('34')) {
    return {
      regionLabel: 'South Florida',
      note:
        'Material choices may be affected by humidity, hurricane requirements, local code and coastal conditions.',
      suggestions: {
        cabinets: ['Moisture-resistant cabinets', 'Semi-custom cabinets', 'Painted cabinets'],
        countertops: ['Quartz', 'Granite', 'Porcelain slab'],
        flooring: ['Porcelain tile', 'Luxury vinyl plank', 'Water-resistant laminate'],
        roofing: ['Metal roofing', 'Tile roofing', 'Architectural shingles'],
        bathroomTile: ['Porcelain tile', 'Ceramic tile', 'Natural stone look tile'],
      },
    };
  }

  return {
    regionLabel: 'Your ZIP area',
    note:
      'Material preferences and pricing can vary by ZIP code, local labor rates, building codes and supplier availability.',
    suggestions: {
      cabinets: ['Stock cabinets', 'Semi-custom cabinets', 'Custom cabinets'],
      countertops: ['Laminate', 'Quartz', 'Granite', 'Butcher block'],
      flooring: ['Vinyl plank', 'Tile', 'Laminate', 'Engineered wood'],
      roofing: ['Asphalt shingles', 'Architectural shingles', 'Metal roofing'],
      bathroomTile: ['Ceramic tile', 'Porcelain tile', 'Natural stone'],
    },
  };
}