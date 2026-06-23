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

  {
    slug: 'addition',
    aliases: ['addition-extension', 'home-addition', 'room-addition', 'Addition / Extension'],
    label: 'Addition / Extension',
    description:
      'Room additions, second-story additions, garage conversions and structural extensions.',
    questions: [
      ...commonQuestions,
      {
        key: 'addition_type',
        label: 'Type of addition',
        type: 'single_select',
        required: true,
        options: ['Room addition', 'Second-story addition', 'Garage conversion', 'Sunroom', 'In-law suite / ADU', 'Other'],
      },
      {
        key: 'addition_purpose',
        label: 'What will the new space be used for?',
        type: 'single_select',
        required: true,
        options: ['Bedroom', 'Bathroom', 'Living space', 'Office', 'Rental / ADU', 'Storage', 'Other'],
      },
      {
        key: 'foundation_status',
        label: 'Foundation work needed',
        type: 'single_select',
        required: true,
        options: ['New foundation required', 'Existing foundation extends', 'Not sure', 'Contractor should advise'],
      },
      {
        key: 'square_footage',
        label: 'Approximate added square footage',
        type: 'text',
        required: true,
        helpText: 'Example: 250 sq ft, or "not sure".',
      },
      {
        key: 'utilities_extension',
        label: 'Utilities that need to extend into the new space',
        type: 'multi_select',
        required: true,
        options: ['Electrical', 'Plumbing', 'HVAC', 'Gas line', 'None known', 'Not sure'],
      },
      {
        key: 'permit_complexity',
        label: 'Do you expect this needs architectural plans / engineering?',
        type: 'single_select',
        required: true,
        options: ['Yes, I have plans', 'Yes, need help getting plans', 'Not sure', 'No, simple structure'],
      },
    ],
    requiredPhotos: [
      {
        key: 'exterior_addition_site',
        label: 'Exterior site of the planned addition',
        description: 'Show the area where the addition will be built, from outside.',
        required: true,
      },
      {
        key: 'adjacent_structure',
        label: 'Adjacent structure / wall to be connected',
        description: 'Show the existing wall or structure the addition will connect to.',
        required: true,
      },
      {
        key: 'property_boundaries',
        label: 'Property boundary / yard view',
        description: 'Wide shot showing available space and property lines if visible.',
        required: true,
      },
      {
        key: 'existing_foundation',
        label: 'Existing foundation (if visible)',
        description: 'Show the foundation type near the build area.',
        required: true,
      },
      {
        key: 'interior_connection_point',
        label: 'Interior wall / door where addition connects',
        description: 'Show the interior side of the wall that will open into the new space.',
        required: true,
      },
      {
        key: 'inspiration',
        label: 'Inspiration / desired style',
        description: 'Upload a reference image or sketch showing what you want.',
        required: true,
      },
    ],
    materials: [
      {
        key: 'framing',
        label: 'Framing / structure',
        options: ['Wood frame', 'Steel frame', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
      {
        key: 'exterior_finish',
        label: 'Exterior finish to match',
        options: ['Siding', 'Brick', 'Stucco', 'Mixed / not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
      {
        key: 'interior_finish',
        label: 'Interior finish level',
        options: ['Drywall + paint only', 'Full interior finish (flooring, trim, paint)', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
    ],
  },

  {
    slug: 'basement',
    aliases: ['basement-finishing', 'basement-remodel', 'Basement Finishing'],
    label: 'Basement Finishing',
    description:
      'Finishing or remodeling a basement: framing, drywall, flooring, electrical, egress and waterproofing.',
    questions: [
      ...commonQuestions,
      {
        key: 'basement_current_state',
        label: 'Current basement condition',
        type: 'single_select',
        required: true,
        options: ['Unfinished / raw', 'Partially finished', 'Previously finished, needs update', 'Wet / leak issues', 'Not sure'],
      },
      {
        key: 'intended_use',
        label: 'Intended use of finished space',
        type: 'multi_select',
        required: true,
        options: ['Family room', 'Bedroom', 'Bathroom', 'Home office', 'Home gym', 'Rental unit', 'Storage', 'Other'],
      },
      {
        key: 'moisture_status',
        label: 'Any known moisture, leak or flooding history?',
        type: 'single_select',
        required: true,
        options: ['No issues', 'Minor dampness', 'Active leaks', 'Past flooding, now resolved', 'Not sure'],
      },
      {
        key: 'ceiling_height',
        label: 'Approximate ceiling height',
        type: 'single_select',
        required: true,
        options: ['Under 7 ft', '7-8 ft', '8+ ft', 'Not sure'],
      },
      {
        key: 'egress_status',
        label: 'Egress window / exit status (required for bedrooms in most areas)',
        type: 'single_select',
        required: true,
        options: ['Already has egress', 'Needs new egress window', 'Not applicable', 'Not sure'],
      },
      {
        key: 'basement_systems',
        label: 'Visible systems in the space (furnace, water heater, sump pump, etc.)',
        type: 'textarea',
        required: true,
        helpText: 'List anything that needs to be worked around or boxed in.',
      },
    ],
    requiredPhotos: [
      {
        key: 'full_basement_wide',
        label: 'Full basement - wide shot',
        description: 'Capture as much of the basement as possible from one corner.',
        required: true,
      },
      {
        key: 'full_basement_opposite',
        label: 'Full basement - opposite angle',
        description: 'Capture from the opposite corner.',
        required: true,
      },
      {
        key: 'ceiling_mechanicals',
        label: 'Ceiling and exposed mechanicals',
        description: 'Show ductwork, pipes, wiring and ceiling height.',
        required: true,
      },
      {
        key: 'walls_foundation',
        label: 'Walls / foundation condition',
        description: 'Show foundation walls, any cracks, dampness or efflorescence.',
        required: true,
      },
      {
        key: 'stairs_entry',
        label: 'Stairs / entry point',
        description: 'Show the stairway or entrance to the basement.',
        required: true,
      },
      {
        key: 'damage_or_problem_area',
        label: 'Damage or problem area',
        description: 'Close-up of any moisture, mold, cracks or damage.',
        required: true,
      },
    ],
    materials: [
      {
        key: 'flooring',
        label: 'Flooring',
        options: ['Vinyl plank', 'Carpet', 'Tile', 'Engineered wood', 'Epoxy', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
      {
        key: 'wall_finish',
        label: 'Wall finish',
        options: ['Drywall + paint', 'Paneling', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
      {
        key: 'ceiling_finish',
        label: 'Ceiling finish',
        options: ['Drywall', 'Drop / suspended ceiling', 'Exposed / painted', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
    ],
  },

  {
    slug: 'deck-patio',
    aliases: ['deck', 'patio', 'deck-and-patio', 'decks-and-patios', 'Deck & Patio', 'Decks & Patios'],
    label: 'Deck & Patio',
    description:
      'New deck or patio construction, replacement, resurfacing, railings and outdoor living spaces.',
    questions: [
      ...commonQuestions,
      {
        key: 'structure_type',
        label: 'What are you building?',
        type: 'single_select',
        required: true,
        options: ['Deck', 'Patio', 'Both', 'Porch', 'Pergola / covered structure'],
      },
      {
        key: 'project_type',
        label: 'Project type',
        type: 'single_select',
        required: true,
        options: ['New build', 'Replace existing', 'Resurface / repair existing', 'Expand existing'],
      },
      {
        key: 'approx_size',
        label: 'Approximate size',
        type: 'text',
        required: true,
        helpText: 'Example: 12x16 ft, or "not sure".',
      },
      {
        key: 'height_above_grade',
        label: 'Height above ground (for decks)',
        type: 'single_select',
        required: true,
        options: ['Ground level', 'Under 3 ft', '3-8 ft', 'Over 8 ft', 'Not applicable / not sure'],
      },
      {
        key: 'railing_needed',
        label: 'Railing / stairs needed?',
        type: 'multi_select',
        required: true,
        options: ['Railing needed', 'Stairs needed', 'Neither needed', 'Not sure'],
      },
      {
        key: 'roof_cover',
        label: 'Should it be covered / roofed?',
        type: 'single_select',
        required: true,
        options: ['No cover', 'Pergola', 'Solid roof', 'Screened-in', 'Not sure'],
      },
    ],
    requiredPhotos: [
      {
        key: 'site_wide_shot',
        label: 'Wide shot of the build area',
        description: 'Capture the full area where the deck/patio will be built.',
        required: true,
      },
      {
        key: 'house_connection_point',
        label: 'House connection point',
        description: 'Show where the structure will attach to or sit near the house.',
        required: true,
      },
      {
        key: 'existing_structure',
        label: 'Existing deck/patio (if replacing)',
        description: 'Show the current structure and its condition.',
        required: true,
      },
      {
        key: 'ground_slope',
        label: 'Ground slope / terrain',
        description: 'Show the ground level and any slope across the area.',
        required: true,
      },
      {
        key: 'inspiration',
        label: 'Inspiration / desired style',
        description: 'Upload a reference photo showing the style you want.',
        required: true,
      },
    ],
    materials: [
      {
        key: 'decking_material',
        label: 'Decking / surface material',
        options: ['Pressure-treated wood', 'Composite decking', 'PVC decking', 'Pavers', 'Poured concrete', 'Natural stone', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
      {
        key: 'railing_material',
        label: 'Railing material',
        options: ['Wood', 'Composite', 'Aluminum', 'Cable rail', 'Glass panel', 'None', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
    ],
  },

  {
    slug: 'electrical',
    aliases: ['electrical-work', 'Electrical'],
    label: 'Electrical',
    description:
      'Panel upgrades, rewiring, outlets, lighting, EV chargers and general electrical work.',
    questions: [
      ...commonQuestions,
      {
        key: 'electrical_work_type',
        label: 'What kind of electrical work do you need?',
        type: 'multi_select',
        required: true,
        options: [
          'Panel upgrade',
          'Rewiring',
          'New outlets / switches',
          'Lighting installation',
          'Ceiling fan installation',
          'EV charger installation',
          'Generator hookup',
          'Troubleshooting / repair',
          'Code violation fix',
          'Other',
        ],
      },
      {
        key: 'panel_amperage',
        label: 'Current panel amperage (if known)',
        type: 'single_select',
        required: true,
        options: ['60 amp', '100 amp', '150 amp', '200 amp', '200+ amp', 'Not sure'],
      },
      {
        key: 'issue_description',
        label: 'Describe the issue or work needed',
        type: 'textarea',
        required: true,
        helpText: 'Flickering lights, tripped breakers, burning smell, new circuits needed, etc.',
      },
      {
        key: 'urgency_level',
        label: 'How urgent is this?',
        type: 'single_select',
        required: true,
        options: ['Emergency / safety concern', 'Soon, not urgent', 'Planned upgrade', 'Not sure'],
      },
      {
        key: 'rooms_affected',
        label: 'Which rooms or areas are affected?',
        type: 'textarea',
        required: true,
        helpText: 'List rooms, number of outlets/fixtures, and any specific locations.',
      },
    ],
    requiredPhotos: [
      {
        key: 'electrical_panel',
        label: 'Electrical panel',
        description: 'Open the panel door and take a clear photo of breakers and labels.',
        required: true,
      },
      {
        key: 'affected_area_wide',
        label: 'Affected area - wide shot',
        description: 'Show the room or area where work is needed.',
        required: true,
      },
      {
        key: 'outlet_or_fixture_closeup',
        label: 'Outlet / switch / fixture close-up',
        description: 'Close-up of the specific outlet, switch or fixture in question.',
        required: true,
      },
      {
        key: 'damage_or_issue',
        label: 'Damage or issue close-up',
        description: 'Show any scorch marks, exposed wiring or visible problems.',
        required: true,
      },
    ],
    materials: [
      {
        key: 'fixture_quality',
        label: 'Fixtures / devices',
        options: ['Standard builder-grade', 'Mid-range', 'Designer / smart fixtures', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
    ],
  },

  {
    slug: 'flooring',
    aliases: ['flooring-installation', 'Flooring'],
    label: 'Flooring',
    description:
      'Flooring installation or replacement: hardwood, tile, vinyl, laminate, carpet and refinishing.',
    questions: [
      ...commonQuestions,
      {
        key: 'rooms_to_floor',
        label: 'Which rooms or areas need flooring?',
        type: 'textarea',
        required: true,
        helpText: 'List rooms and approximate square footage if known.',
      },
      {
        key: 'flooring_work_type',
        label: 'Type of work',
        type: 'single_select',
        required: true,
        options: ['New installation', 'Replace existing', 'Refinish existing hardwood', 'Repair section'],
      },
      {
        key: 'current_flooring',
        label: 'Current flooring being removed (if any)',
        type: 'single_select',
        required: true,
        options: ['Carpet', 'Tile', 'Hardwood', 'Vinyl / laminate', 'Concrete / bare subfloor', 'Other', 'None / new construction'],
      },
      {
        key: 'subfloor_condition',
        label: 'Subfloor condition (if known)',
        type: 'single_select',
        required: true,
        options: ['Good / level', 'Uneven', 'Water damaged', 'Not sure'],
      },
      {
        key: 'total_square_footage',
        label: 'Approximate total square footage',
        type: 'text',
        required: true,
        helpText: 'Example: 600 sq ft, or "not sure".',
      },
    ],
    requiredPhotos: [
      {
        key: 'room_wide_shot',
        label: 'Room(s) - wide shot',
        description: 'Capture each room that needs flooring work.',
        required: true,
      },
      {
        key: 'current_floor_closeup',
        label: 'Current floor close-up',
        description: 'Show the existing flooring material and condition.',
        required: true,
      },
      {
        key: 'transition_areas',
        label: 'Transition areas / doorways',
        description: 'Show thresholds and transitions between rooms or flooring types.',
        required: true,
      },
      {
        key: 'damage_areas',
        label: 'Damaged areas (if any)',
        description: 'Close-up of any warping, stains, cracks or damage.',
        required: true,
      },
    ],
    materials: [
      {
        key: 'flooring_type',
        label: 'Flooring type',
        options: ['Hardwood', 'Engineered wood', 'Laminate', 'Vinyl plank (LVP)', 'Tile', 'Carpet', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
    ],
  },

  {
    slug: 'handyman',
    aliases: ['handyman-small-repairs', 'small-repairs', 'Handyman / Small Repairs'],
    label: 'Handyman / Small Repairs',
    description:
      'General handyman work and small repairs: drywall, fixtures, doors, mounting, minor fixes.',
    questions: [
      ...commonQuestions,
      {
        key: 'task_list',
        label: 'List the tasks you need done',
        type: 'textarea',
        required: true,
        helpText: 'Be as specific as possible - e.g. "patch drywall hole in hallway, fix squeaky door, mount TV in living room".',
      },
      {
        key: 'task_count',
        label: 'How many separate tasks/items?',
        type: 'single_select',
        required: true,
        options: ['1-2 tasks', '3-5 tasks', '6-10 tasks', 'More than 10', 'Not sure'],
      },
      {
        key: 'materials_provided',
        label: 'Will you provide materials/parts, or should the contractor bring everything?',
        type: 'single_select',
        required: true,
        options: ['I have materials/parts', 'Contractor should bring everything', 'Mix of both', 'Not sure'],
      },
      {
        key: 'estimated_time',
        label: 'How long do you think this will take?',
        type: 'single_select',
        required: true,
        options: ['Under 2 hours', 'Half day', 'Full day', 'Multiple days', 'Not sure'],
      },
    ],
    requiredPhotos: [
      {
        key: 'task_area_1',
        label: 'Task area #1',
        description: 'Photo of the first item/area that needs work.',
        required: true,
      },
      {
        key: 'task_area_2',
        label: 'Task area #2 (if applicable)',
        description: 'Photo of another item/area that needs work.',
        required: true,
      },
      {
        key: 'overview_room',
        label: 'Overview of the room(s)',
        description: 'Wide shot of the general area for context.',
        required: true,
      },
    ],
    materials: [
      {
        key: 'general_materials',
        label: 'Parts / materials needed (if known)',
        options: ['Hardware / fasteners', 'Paint / drywall supplies', 'Replacement fixtures', 'Not sure / contractor to advise'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
    ],
  },

  {
    slug: 'hvac',
    aliases: ['heating-cooling', 'hvac-installation', 'HVAC'],
    label: 'HVAC',
    description:
      'Heating, ventilation and air conditioning: new systems, repairs, ductwork and maintenance.',
    questions: [
      ...commonQuestions,
      {
        key: 'hvac_work_type',
        label: 'What kind of HVAC work do you need?',
        type: 'multi_select',
        required: true,
        options: [
          'New system installation',
          'System replacement',
          'Repair / not working',
          'Ductwork',
          'Thermostat upgrade',
          'Maintenance / tune-up',
          'Ventilation / air quality',
          'Not sure',
        ],
      },
      {
        key: 'system_type',
        label: 'Current or desired system type',
        type: 'single_select',
        required: true,
        options: ['Central air + furnace', 'Heat pump', 'Ductless mini-split', 'Boiler / radiator', 'Window units', 'Not sure'],
      },
      {
        key: 'system_age',
        label: 'Approximate age of current system',
        type: 'single_select',
        required: true,
        options: ['Under 5 years', '5-10 years', '10-20 years', '20+ years', 'No existing system', 'Not sure'],
      },
      {
        key: 'home_square_footage',
        label: 'Approximate square footage being heated/cooled',
        type: 'text',
        required: true,
        helpText: 'Example: 1800 sq ft, or "not sure".',
      },
      {
        key: 'issue_description',
        label: 'Describe the issue or goal',
        type: 'textarea',
        required: true,
        helpText: 'Not cooling/heating evenly, system won\'t turn on, noisy, want efficiency upgrade, etc.',
      },
    ],
    requiredPhotos: [
      {
        key: 'existing_unit_outdoor',
        label: 'Outdoor unit (if applicable)',
        description: 'Show the outdoor condenser/heat pump unit.',
        required: true,
      },
      {
        key: 'existing_unit_indoor',
        label: 'Indoor unit / furnace / air handler',
        description: 'Show the indoor unit, furnace or air handler.',
        required: true,
      },
      {
        key: 'thermostat',
        label: 'Thermostat',
        description: 'Show the current thermostat and model if visible.',
        required: true,
      },
      {
        key: 'ductwork_access',
        label: 'Ductwork / vents (if accessible)',
        description: 'Show visible ductwork or vent condition.',
        required: true,
      },
    ],
    materials: [
      {
        key: 'system_brand_tier',
        label: 'System tier preference',
        options: ['Builder-grade / standard efficiency', 'Mid-tier / high efficiency', 'Premium / smart system', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
    ],
  },

  {
    slug: 'painting',
    aliases: ['interior-exterior-paint', 'interior-painting', 'exterior-painting', 'Interior / Exterior Paint'],
    label: 'Interior / Exterior Paint',
    description:
      'Interior and exterior painting, staining, drywall repair and surface prep.',
    questions: [
      ...commonQuestions,
      {
        key: 'paint_scope',
        label: 'Interior, exterior, or both?',
        type: 'single_select',
        required: true,
        options: ['Interior only', 'Exterior only', 'Both'],
      },
      {
        key: 'rooms_or_areas',
        label: 'Which rooms / exterior areas?',
        type: 'textarea',
        required: true,
        helpText: 'List rooms (interior) or sides/trim/siding (exterior) and approximate square footage if known.',
      },
      {
        key: 'surface_prep_needed',
        label: 'Surface prep needed',
        type: 'multi_select',
        required: true,
        options: ['Drywall repair', 'Wallpaper removal', 'Pressure washing', 'Scraping old paint', 'Caulking', 'None known', 'Not sure'],
      },
      {
        key: 'ceiling_trim_included',
        label: 'Should ceilings and trim be included?',
        type: 'multi_select',
        required: true,
        options: ['Ceilings', 'Trim / baseboards', 'Doors', 'Neither, walls only'],
      },
      {
        key: 'color_decided',
        label: 'Have you chosen colors?',
        type: 'single_select',
        required: true,
        options: ['Yes, I have colors picked', 'I need help choosing', 'Same as existing colors', 'Not sure'],
      },
    ],
    requiredPhotos: [
      {
        key: 'room_or_area_wide_1',
        label: 'Room / exterior area - wide shot #1',
        description: 'Capture the main area that needs painting.',
        required: true,
      },
      {
        key: 'room_or_area_wide_2',
        label: 'Room / exterior area - wide shot #2',
        description: 'Capture from another angle or another area.',
        required: true,
      },
      {
        key: 'surface_condition',
        label: 'Surface condition close-up',
        description: 'Show cracks, peeling, stains or wallpaper if present.',
        required: true,
      },
      {
        key: 'trim_ceiling_detail',
        label: 'Trim / ceiling detail (if included)',
        description: 'Show trim, baseboards or ceiling condition.',
        required: true,
      },
    ],
    materials: [
      {
        key: 'paint_quality',
        label: 'Paint quality',
        options: ['Builder-grade', 'Mid-grade', 'Premium (Benjamin Moore / Sherwin-Williams top tier)', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
      {
        key: 'finish_type',
        label: 'Finish type',
        options: ['Flat / matte', 'Eggshell', 'Satin', 'Semi-gloss', 'Gloss', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
    ],
  },

  {
    slug: 'landscaping',
    aliases: ['landscape', 'yard-work', 'Landscaping'],
    label: 'Landscaping',
    description:
      'Landscape design, planting, sod, irrigation, hardscaping, retaining walls and yard renovation.',
    questions: [
      ...commonQuestions,
      {
        key: 'landscaping_scope',
        label: 'What do you need?',
        type: 'multi_select',
        required: true,
        options: [
          'Lawn / sod',
          'Planting / garden beds',
          'Tree / shrub removal',
          'Irrigation system',
          'Retaining wall',
          'Hardscaping (patio, walkway)',
          'Drainage solution',
          'Outdoor lighting',
          'Full yard redesign',
          'Other',
        ],
      },
      {
        key: 'yard_size',
        label: 'Approximate yard size',
        type: 'single_select',
        required: true,
        options: ['Small (under 1000 sq ft)', 'Medium (1000-5000 sq ft)', 'Large (5000+ sq ft)', 'Not sure'],
      },
      {
        key: 'current_yard_state',
        label: 'Current state of the yard',
        type: 'single_select',
        required: true,
        options: ['Bare / dirt', 'Overgrown', 'Existing landscaping needs update', 'Drainage / erosion issues', 'Other'],
      },
      {
        key: 'design_help_needed',
        label: 'Do you need design help or already have a plan?',
        type: 'single_select',
        required: true,
        options: ['I have a plan/drawing', 'I need design help', 'Inspiration photos only', 'Not sure'],
      },
    ],
    requiredPhotos: [
      {
        key: 'yard_wide_shot_1',
        label: 'Yard - wide shot #1',
        description: 'Capture the full yard area from one angle.',
        required: true,
      },
      {
        key: 'yard_wide_shot_2',
        label: 'Yard - wide shot #2',
        description: 'Capture from a different angle for context.',
        required: true,
      },
      {
        key: 'problem_area',
        label: 'Problem area (drainage, erosion, dead grass, etc.)',
        description: 'Close-up of any specific issue.',
        required: true,
      },
      {
        key: 'inspiration',
        label: 'Inspiration / desired style',
        description: 'Upload a reference photo showing the style you want.',
        required: true,
      },
    ],
    materials: [
      {
        key: 'hardscape_material',
        label: 'Hardscape material (if applicable)',
        options: ['Pavers', 'Natural stone', 'Poured concrete', 'Gravel', 'Not applicable', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
      {
        key: 'plant_quality',
        label: 'Plant / sod quality',
        options: ['Standard nursery stock', 'Mature plants', 'Premium / specimen plants', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
    ],
  },

  {
    slug: 'plumbing',
    aliases: ['plumbing-work', 'Plumbing'],
    label: 'Plumbing',
    description:
      'Pipe repair, fixture installation, water heaters, sewer lines and general plumbing work.',
    questions: [
      ...commonQuestions,
      {
        key: 'plumbing_work_type',
        label: 'What kind of plumbing work do you need?',
        type: 'multi_select',
        required: true,
        options: [
          'Leak repair',
          'Fixture installation / replacement',
          'Water heater',
          'Pipe replacement / repipe',
          'Drain / sewer line',
          'Sump pump',
          'Gas line',
          'Clogged drain',
          'Other',
        ],
      },
      {
        key: 'issue_description',
        label: 'Describe the issue or work needed',
        type: 'textarea',
        required: true,
        helpText: 'Where is the leak/clog, which fixtures are involved, how long has it been happening.',
      },
      {
        key: 'urgency_level',
        label: 'How urgent is this?',
        type: 'single_select',
        required: true,
        options: ['Emergency / active leak or flooding', 'Soon, not urgent', 'Planned upgrade', 'Not sure'],
      },
      {
        key: 'fixtures_involved',
        label: 'Fixtures or areas involved',
        type: 'textarea',
        required: true,
        helpText: 'List sinks, toilets, water heater, etc. and their location.',
      },
      {
        key: 'pipe_material',
        label: 'Current pipe material (if known)',
        type: 'single_select',
        required: true,
        options: ['Copper', 'PVC / PEX', 'Galvanized steel', 'Cast iron', 'Not sure'],
      },
    ],
    requiredPhotos: [
      {
        key: 'problem_area_wide',
        label: 'Problem area - wide shot',
        description: 'Show the room or area where the issue is.',
        required: true,
      },
      {
        key: 'problem_closeup',
        label: 'Problem close-up',
        description: 'Close-up of the leak, pipe, fixture or damage.',
        required: true,
      },
      {
        key: 'shutoff_valve_or_meter',
        label: 'Shutoff valve / water meter (if accessible)',
        description: 'Show the main shutoff valve or water meter location.',
        required: true,
      },
      {
        key: 'water_heater_or_fixture',
        label: 'Water heater / fixture in question',
        description: 'Show the specific fixture or unit needing work.',
        required: true,
      },
    ],
    materials: [
      {
        key: 'fixture_quality',
        label: 'Fixture / fittings quality',
        options: ['Standard builder-grade', 'Mid-range', 'Premium designer fixtures', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
    ],
  },

  {
    slug: 'siding',
    aliases: ['siding-replacement', 'exterior-siding', 'Siding'],
    label: 'Siding',
    description:
      'Siding installation, replacement, repair and exterior cladding work.',
    questions: [
      ...commonQuestions,
      {
        key: 'siding_work_type',
        label: 'Type of work',
        type: 'single_select',
        required: true,
        options: ['Full replacement', 'Partial repair', 'New construction install', 'Not sure'],
      },
      {
        key: 'current_siding_material',
        label: 'Current siding material',
        type: 'single_select',
        required: true,
        options: ['Vinyl', 'Wood', 'Fiber cement', 'Brick', 'Stucco', 'Aluminum', 'None / new construction', 'Not sure'],
      },
      {
        key: 'house_size',
        label: 'Approximate house size / stories',
        type: 'text',
        required: true,
        helpText: 'Example: 2-story, 2000 sq ft footprint, or "not sure".',
      },
      {
        key: 'damage_present',
        label: 'Is there visible damage?',
        type: 'single_select',
        required: true,
        options: ['No', 'Yes, minor', 'Yes, significant', 'Not sure'],
      },
      {
        key: 'insulation_upgrade',
        label: 'Interested in adding insulation during siding work?',
        type: 'single_select',
        required: true,
        options: ['Yes', 'No', 'Not sure / contractor should advise'],
      },
    ],
    requiredPhotos: [
      {
        key: 'front_exterior',
        label: 'Front of house',
        description: 'Full front exterior view.',
        required: true,
      },
      {
        key: 'back_exterior',
        label: 'Back of house',
        description: 'Full back exterior view.',
        required: true,
      },
      {
        key: 'left_side_exterior',
        label: 'Left side of house',
        description: 'Full left side exterior view.',
        required: true,
      },
      {
        key: 'right_side_exterior',
        label: 'Right side of house',
        description: 'Full right side exterior view.',
        required: true,
      },
      {
        key: 'damage_closeup',
        label: 'Damage close-up (if any)',
        description: 'Close-up of any cracked, warped or missing siding.',
        required: true,
      },
    ],
    materials: [
      {
        key: 'siding_material',
        label: 'Preferred siding material',
        options: ['Vinyl', 'Fiber cement', 'Wood', 'Engineered wood', 'Metal', 'Not sure'],
        qualityLevels: ['Budget', 'Standard', 'Premium', 'Luxury'],
        allowCustom: true,
      },
    ],
  },

  {
    slug: 'windows',
    aliases: ['windows-doors', 'windows-and-doors', 'window-replacement', 'door-replacement', 'Windows & Doors'],
    label: 'Windows & Doors',
    description:
      'Window and door replacement, installation, repair and energy efficiency upgrades.',
    questions: [
      ...commonQuestions,
      {
        key: 'work_focus',
        label: 'Windows, doors, or both?',
        type: 'single_select',
        required: true,
        options: ['Windows only', 'Doors only', 'Both'],
      },
      {
        key: 'unit_count',
        label: 'How many windows/doors need work?',
        type: 'single_select',
        required: true,
        options: ['1-2', '3-5', '6-10', 'More than 10', 'Not sure'],
      },
      {
        key: 'current_condition',
        label: 'Current condition',
        type: 'single_select',
        required: true,
        options: ['Old / drafty', 'Damaged / broken', 'Single-pane needs upgrade', 'New construction', 'Not sure'],
      },
      {
        key: 'window_door_type',
        label: 'Type(s) needed',
        type: 'multi_select',
        required: true,
        options: ['Double-hung', 'Casement', 'Sliding', 'Bay / bow', 'Entry door', 'Patio / sliding door', 'Garage door', 'Not sure'],
      },
      {
        key: 'frame_material_pref',
        label: 'Preferred frame material',
        type: 'single_select',
        required: true,
        options: ['Vinyl', 'Wood', 'Fiberglass', 'Aluminum', 'Not sure'],
      },
    ],
    requiredPhotos: [
      {
        key: 'exterior_unit_1',
        label: 'Exterior view of window/door #1',
        description: 'Show the exterior side of the first unit.',
        required: true,
      },
      {
        key: 'interior_unit_1',
        label: 'Interior view of window/door #1',
        description: 'Show the interior side of the first unit.',
        required: true,
      },
      {
        key: 'additional_units',
        label: 'Additional windows/doors (if multiple)',
        description: 'Show other units needing work, grouped if possible.',
        required: true,
      },
      {
        key: 'damage_closeup',
        label: 'Damage close-up (if any)',
        description: 'Close-up of rot, cracks, broken glass or damage.',
        required: true,
      },
    ],
    materials: [
      {
        key: 'window_quality',
        label: 'Window / door quality tier',
        options: ['Builder-grade', 'Mid-range energy efficient', 'Premium / high-efficiency', 'Not sure'],
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
