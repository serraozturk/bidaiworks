import type { ProjectQuestionType } from '@/lib/types';

export interface ProjectBriefQuestion {
  key: string;
  label: string;
  type: ProjectQuestionType;
  required: boolean;
  options?: string[];
  helpText?: string;
}

export interface ProjectBriefPhoto {
  key: string;
  label: string;
  description: string;
  required: boolean;
}

export interface ProjectBriefMaterial {
  key: string;
  label: string;
  options: string[];
  qualityLevels: string[];
  allowCustom: boolean;
}

export interface ProjectBriefCategory {
  slug: string;
  aliases?: string[];
  label: string;
  description: string;
  questions: ProjectBriefQuestion[];
  requiredPhotos: ProjectBriefPhoto[];
  materials: ProjectBriefMaterial[];
}

const commonQuestions: ProjectBriefQuestion[] = [
  {
    key: 'property_type',
    label: 'What type of property is this?',
    type: 'single_select',
    required: true,
    options: [
      'Single-family house',
      'Townhouse',
      'Condo / apartment',
      'Multi-family property',
      'Commercial property',
      'Other',
    ],
  },
  {
    key: 'homeowner_readiness',
    label: 'How ready are you to start this project?',
    type: 'single_select',
    required: true,
    options: [
      'Ready to hire now',
      'Comparing offers',
      'Planning and budgeting',
      'Emergency / urgent repair',
    ],
  },
  {
    key: 'desired_start_timing',
    label: 'When would you like the work to start?',
    type: 'single_select',
    required: true,
    options: ['ASAP', 'Within 2 weeks', 'Within 1 month', 'Within 3 months', 'Flexible'],
  },
  {
    key: 'desired_completion_timing',
    label: 'When do you need it completed?',
    type: 'single_select',
    required: true,
    options: ['No strict deadline', 'As soon as possible', 'Before a specific date', 'Flexible'],
  },
  {
    key: 'property_age',
    label: 'Approximate property age',
    type: 'single_select',
    required: true,
    options: ['New construction', '0-5 years', '6-15 years', '16-30 years', '30+ years', 'Not sure'],
  },
  {
    key: 'occupied_during_work',
    label: 'Will anyone live in the home during the work?',
    type: 'single_select',
    required: true,
    options: ['Yes', 'No', 'Part-time / depends on schedule', 'Not sure yet'],
  },
  {
    key: 'decision_stage',
    label: 'Where are you in the decision process?',
    type: 'single_select',
    required: true,
    options: [
      'Need pricing only',
      'Choosing between contractors',
      'Ready after estimate looks right',
      'Insurance / lender approval needed',
      'Permit or design approval needed',
    ],
  },
  {
    key: 'design_status',
    label: 'Do you already have drawings, measurements, plans or inspiration?',
    type: 'multi_select',
    required: true,
    options: [
      'I have measurements',
      'I have drawings / plans',
      'I have inspiration photos',
      'I have product links',
      'I need design help',
      'None yet',
    ],
  },
  {
    key: 'materials_owner',
    label: 'Who should buy the main materials?',
    type: 'single_select',
    required: true,
    options: [
      'Contractor should include materials',
      'I will buy materials',
      'Some by me, some by contractor',
      'Not sure',
    ],
  },
  {
    key: 'permit_expectation',
    label: 'Do you think permits, HOA, condo or city approvals are needed?',
    type: 'single_select',
    required: true,
    options: ['No', 'Yes', 'Maybe / not sure', 'Contractor should advise'],
  },
  {
    key: 'site_visit_availability',
    label: 'Best times for site visit or measurement verification',
    type: 'textarea',
    required: true,
    helpText: 'List weekdays/weekends, morning/afternoon/evening, gate codes or preferred contact method.',
  },
  {
    key: 'access_notes',
    label: 'Access, parking, HOA, building rules, stairs, elevator or work-hour restrictions',
    type: 'textarea',
    required: true,
    helpText:
      'This helps contractors price labor, delivery, parking, cleanup and scheduling correctly.',
  },
  {
    key: 'utilities_and_constraints',
    label: 'Utilities, shutoff access, pets, children, tenants or other constraints',
    type: 'textarea',
    required: true,
    helpText:
      'Mention water/electrical/gas shutoffs, pets, tenants, security systems, noise limits or anything that affects scheduling.',
  },
  {
    key: 'measurement_notes',
    label: 'Measurements and dimensions you know',
    type: 'textarea',
    required: true,
    helpText:
      'Add square footage, length, width, height, linear feet, number of rooms, number of walls, doors, windows or anything relevant.',
  },
  {
    key: 'must_haves_and_dealbreakers',
    label: 'Must-haves, dealbreakers and expectations',
    type: 'textarea',
    required: true,
    helpText:
      'Write what matters most: budget cap, finish quality, dust control, brand preference, deadline, warranty, cleanup, communication style.',
  },
];

export const projectBriefCategories: ProjectBriefCategory[] = [
  {
    slug: 'kitchen',
  aliases: ['kitchen-remodel', 'kitchen-remodeling', 'kitchen-renovation', 'Kitchen Remodel'],
  label: 'Kitchen Remodel',
    description:
      'Cabinets, countertops, flooring, backsplash, plumbing, electrical, layout and full kitchen renovation.',
    questions: [
      ...commonQuestions,
      {
        key: 'kitchen_layout',
        label: 'Kitchen layout',
        type: 'single_select',
        required: true,
        options: ['L-shaped', 'U-shaped', 'Galley', 'Open kitchen', 'Island kitchen', 'Not sure'],
      },
      {
        key: 'work_scope',
        label: 'What should be included?',
        type: 'multi_select',
        required: true,
        options: [
          'Cabinets',
          'Countertops',
          'Backsplash',
          'Flooring',
          'Sink',
          'Faucet',
          'Lighting',
          'Electrical',
          'Plumbing',
          'Appliance installation',
          'Wall removal',
          'Island installation',
          'Painting',
          'Demolition',
          'Cleanup',
        ],
      },
      {
        key: 'current_condition',
        label: 'Current kitchen condition',
        type: 'single_select',
        required: true,
        options: [
          'Functional but outdated',
          'Damaged',
          'Water damage suspected',
          'Partially demolished',
          'New construction',
          'Not sure',
        ],
      },
      {
        key: 'plumbing_change',
        label: 'Will sink, dishwasher, refrigerator water line or plumbing location change?',
        type: 'single_select',
        required: true,
        options: ['No', 'Yes', 'Maybe / not sure'],
      },
      {
        key: 'electrical_change',
        label: 'Will lighting, outlets, panel, appliance wiring or electrical layout change?',
        type: 'single_select',
        required: true,
        options: ['No', 'Yes', 'Maybe / not sure'],
      },
      {
        key: 'appliances',
        label: 'Appliances',
        type: 'single_select',
        required: true,
        options: [
          'Homeowner will buy appliances',
          'Contractor should include appliances',
          'Install only',
          'No appliance work',
          'Not sure',
        ],
      },
      {
        key: 'cabinet_scope',
        label: 'Cabinet plan',
        type: 'single_select',
        required: true,
        options: ['Replace all cabinets', 'Refacing only', 'Paint existing cabinets', 'Add a few cabinets', 'Not sure'],
      },
      {
        key: 'countertop_linear_feet',
        label: 'Approximate countertop length or square footage',
        type: 'text',
        required: true,
        helpText: 'Example: 42 linear feet, 55 sq ft, or "not sure".',
      },
      {
        key: 'layout_changes',
        label: 'Layout changes needed',
        type: 'multi_select',
        required: true,
        options: [
          'Move sink',
          'Move stove',
          'Move fridge',
          'Add island',
          'Remove wall',
          'Add pantry',
          'No layout changes',
          'Not sure',
        ],
      },
      {
        key: 'finish_style',
        label: 'Desired kitchen style',
        type: 'single_select',
        required: true,
        options: ['Modern', 'Transitional', 'Traditional', 'Farmhouse', 'Minimal', 'Luxury', 'Not sure'],
      },
      {
        key: 'demo_and_disposal',
        label: 'Demolition and disposal expectations',
        type: 'single_select',
        required: true,
        options: ['Contractor handles all demo/disposal', 'I can do some demo', 'No demolition needed', 'Not sure'],
      },
    ],
    requiredPhotos: [
      {
        key: 'full_kitchen_front',
        label: 'Full kitchen view - front angle',
        description: 'Stand back and capture the whole kitchen from the main entrance.',
        required: true,
      },
      {
        key: 'full_kitchen_back',
        label: 'Full kitchen view - opposite angle',
        description: 'Capture the kitchen from the opposite side so contractors understand the layout.',
        required: true,
      },
      {
        key: 'cabinets',
        label: 'Cabinets',
        description: 'Show upper and lower cabinets clearly.',
        required: true,
      },
      {
        key: 'countertops',
        label: 'Countertops',
        description: 'Show countertop condition and length as much as possible.',
        required: true,
      },
      {
        key: 'sink_plumbing',
        label: 'Sink and plumbing area',
        description: 'Open the under-sink cabinet if possible and show plumbing condition.',
        required: true,
      },
      {
        key: 'flooring',
        label: 'Flooring',
        description: 'Show the floor surface and damaged areas if any.',
        required: true,
      },
      {
        key: 'lighting_electrical',
        label: 'Lighting and electrical areas',
        description: 'Show ceiling lights, outlets, switches and appliance electrical areas.',
        required: true,
      },
      {
        key: 'damage_or_problem_area',
        label: 'Damage or problem area',
        description:
          'Upload close-up photos of water damage, cracks, mold, broken parts or anything unusual.',
        required: true,
      },
      {
        key: 'inspiration',
        label: 'Inspiration / desired style',
        description: 'Upload a reference image or screenshot showing the style you want.',
        required: true,
      },
    ],
    materials: [
      {
        key: 'cabinets',
        label: 'Cabinets',
        options: ['Stock cabinets', 'Semi-custom cabinets', 'Custom cabinets', 'Refacing / repainting', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
      {
        key: 'countertops',
        label: 'Countertops',
        options: ['Laminate', 'Quartz', 'Granite', 'Marble', 'Butcher block', 'Concrete', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
      {
        key: 'flooring',
        label: 'Flooring',
        options: ['Vinyl plank', 'Tile', 'Hardwood', 'Engineered wood', 'Laminate', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
      {
        key: 'backsplash',
        label: 'Backsplash',
        options: ['Ceramic tile', 'Porcelain tile', 'Glass tile', 'Stone', 'Slab backsplash', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
    ],
  },

  {
    slug: 'bathroom',
  aliases: ['bathroom-remodel', 'bathroom-remodeling', 'bathroom-renovation', 'Bathroom Remodel'],
  label: 'Bathroom Remodel',
    description:
      'Shower, tub, tile, vanity, toilet, plumbing, electrical and full bathroom renovation.',
    questions: [
      ...commonQuestions,
      {
        key: 'bathroom_type',
        label: 'Bathroom type',
        type: 'single_select',
        required: true,
        options: ['Powder room', 'Guest bathroom', 'Master bathroom', 'Basement bathroom', 'Other'],
      },
      {
        key: 'work_scope',
        label: 'What should be included?',
        type: 'multi_select',
        required: true,
        options: [
          'Shower',
          'Bathtub',
          'Vanity',
          'Toilet',
          'Floor tile',
          'Wall tile',
          'Plumbing',
          'Electrical',
          'Lighting',
          'Ventilation fan',
          'Waterproofing',
          'Demolition',
          'Painting',
          'Cleanup',
        ],
      },
      {
        key: 'current_condition',
        label: 'Current bathroom condition',
        type: 'single_select',
        required: true,
        options: [
          'Functional but outdated',
          'Leak / water damage',
          'Mold suspected',
          'Partially demolished',
          'New construction',
          'Not sure',
        ],
      },
      {
        key: 'plumbing_relocation',
        label: 'Will toilet, shower, tub, or vanity plumbing move?',
        type: 'single_select',
        required: true,
        options: ['No', 'Yes', 'Maybe / not sure'],
      },
      {
        key: 'shower_tub_plan',
        label: 'Shower / tub plan',
        type: 'single_select',
        required: true,
        options: [
          'Keep existing layout',
          'Tub to shower conversion',
          'Shower to tub',
          'Walk-in shower',
          'Add second sink',
          'Not sure',
        ],
      },
      {
        key: 'waterproofing_scope',
        label: 'Waterproofing and tile scope',
        type: 'multi_select',
        required: true,
        options: [
          'Shower waterproofing',
          'Floor waterproofing',
          'Full-height wall tile',
          'Half-wall tile',
          'Tile niche / bench',
          'No tile work',
          'Not sure',
        ],
      },
      {
        key: 'fixture_count',
        label: 'How many fixtures are involved?',
        type: 'text',
        required: true,
        helpText: 'Example: 1 toilet, 1 vanity, 1 shower, 2 lights, exhaust fan.',
      },
      {
        key: 'ventilation_status',
        label: 'Ventilation / fan status',
        type: 'single_select',
        required: true,
        options: ['Existing fan works', 'Need new fan', 'Need fan added', 'Window only', 'Not sure'],
      },
    ],
    requiredPhotos: [
      {
        key: 'full_bathroom_front',
        label: 'Full bathroom view - front angle',
        description: 'Capture the entire bathroom from the doorway.',
        required: true,
      },
      {
        key: 'full_bathroom_back',
        label: 'Full bathroom view - opposite angle',
        description: 'Capture the opposite angle so layout is clear.',
        required: true,
      },
      {
        key: 'shower_tub',
        label: 'Shower / tub area',
        description: 'Show tile, tub, shower pan, glass, fixtures and damage if any.',
        required: true,
      },
      {
        key: 'vanity_sink',
        label: 'Vanity and sink',
        description: 'Show vanity, sink, faucet, plumbing and mirror area.',
        required: true,
      },
      {
        key: 'toilet',
        label: 'Toilet area',
        description: 'Show toilet location and surrounding floor/wall condition.',
        required: true,
      },
      {
        key: 'floor',
        label: 'Bathroom floor',
        description: 'Show existing flooring and any damage.',
        required: true,
      },
      {
        key: 'damage',
        label: 'Damage / leak / mold area',
        description: 'Close-up photo of any problem area.',
        required: true,
      },
      {
        key: 'inspiration',
        label: 'Inspiration / desired style',
        description: 'Upload a reference image or screenshot showing the style you want.',
        required: true,
      },
    ],
    materials: [
      {
        key: 'tile',
        label: 'Tile',
        options: ['Ceramic', 'Porcelain', 'Natural stone', 'Luxury tile', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
      {
        key: 'vanity',
        label: 'Vanity',
        options: ['Prefab vanity', 'Custom vanity', 'Floating vanity', 'Double vanity', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
      {
        key: 'fixtures',
        label: 'Fixtures',
        options: ['Chrome', 'Brushed nickel', 'Matte black', 'Brass', 'Premium designer fixtures', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
    ],
  },

  {
    slug: 'roofing',
  aliases: ['roof', 'roof-repair', 'roof-replacement', 'Roofing'],
  label: 'Roofing',
    description:
      'Roof replacement, repair, leaks, gutters, shingles, flashing and roof inspection.',
    questions: [
      ...commonQuestions,
      {
        key: 'roof_work_type',
        label: 'Roofing work type',
        type: 'single_select',
        required: true,
        options: ['Full replacement', 'Partial repair', 'Leak repair', 'Inspection', 'Gutters', 'Not sure'],
      },
      {
        key: 'roof_material',
        label: 'Current roof material',
        type: 'single_select',
        required: true,
        options: ['Asphalt shingles', 'Metal', 'Tile', 'Flat roof', 'Slate', 'Not sure'],
      },
      {
        key: 'roof_age',
        label: 'Approximate roof age',
        type: 'single_select',
        required: true,
        options: ['0-5 years', '6-10 years', '11-20 years', '20+ years', 'Not sure'],
      },
      {
        key: 'leak_present',
        label: 'Is there an active leak?',
        type: 'single_select',
        required: true,
        options: ['No', 'Yes', 'Only during heavy rain', 'Not sure'],
      },
      {
        key: 'roof_size_pitch',
        label: 'Roof size, stories and pitch if known',
        type: 'textarea',
        required: true,
        helpText: 'Add square footage, number of stories, steep/flat sections, dormers, skylights or chimneys.',
      },
      {
        key: 'roof_layers',
        label: 'How many roof layers are currently installed?',
        type: 'single_select',
        required: true,
        options: ['One layer', 'Two layers', 'More than two', 'Not sure'],
      },
      {
        key: 'related_scope',
        label: 'Related exterior work',
        type: 'multi_select',
        required: true,
        options: ['Gutters', 'Fascia', 'Soffit', 'Skylight', 'Chimney flashing', 'Attic ventilation', 'None', 'Not sure'],
      },
    ],
    requiredPhotos: [
      {
        key: 'front_roof',
        label: 'Front roof view',
        description: 'Take a clear photo of the front side of the roof from ground level.',
        required: true,
      },
      {
        key: 'back_roof',
        label: 'Back roof view',
        description: 'Take a clear photo of the back side of the roof.',
        required: true,
      },
      {
        key: 'left_roof',
        label: 'Left side roof view',
        description: 'Show the left side angle if accessible.',
        required: true,
      },
      {
        key: 'right_roof',
        label: 'Right side roof view',
        description: 'Show the right side angle if accessible.',
        required: true,
      },
      {
        key: 'damage_closeup',
        label: 'Damage close-up',
        description: 'Close-up photo of missing shingles, cracks, leaks or visible damage.',
        required: true,
      },
      {
        key: 'gutters_edges',
        label: 'Gutters and roof edges',
        description: 'Show gutters, fascia, edges and drainage areas.',
        required: true,
      },
      {
        key: 'inside_leak',
        label: 'Inside leak / ceiling stain',
        description: 'Upload interior ceiling or attic photos if there is a leak.',
        required: true,
      },
    ],
    materials: [
      {
        key: 'roof_material_preference',
        label: 'Preferred roofing material',
        options: [
          'Asphalt shingles',
          'Architectural shingles',
          'Metal roofing',
          'Tile roofing',
          'Flat roof membrane',
          'Not sure',
        ],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
    ],
  },
];

export function getProjectBriefCategory(slug?: string | null) {
  if (!slug) return null;

  const cleanSlug = normalizeCategoryKey(slug);

  return (
    projectBriefCategories.find((category) => {
      const categorySlug = normalizeCategoryKey(category.slug);
      const categoryLabel = normalizeCategoryKey(category.label);

      if (categorySlug === cleanSlug) return true;
      if (categoryLabel === cleanSlug) return true;

      return category.aliases?.some((alias) => {
        return normalizeCategoryKey(alias) === cleanSlug;
      });
    }) ?? null
  );
}

function normalizeCategoryKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/\//g, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getProjectQuestions(slug?: string | null) {
  return getProjectBriefCategory(slug)?.questions ?? [];
}

export function getProjectRequiredPhotos(slug?: string | null) {
  return getProjectBriefCategory(slug)?.requiredPhotos ?? [];
}

export function getProjectMaterials(slug?: string | null) {
  return getProjectBriefCategory(slug)?.materials ?? [];
}
