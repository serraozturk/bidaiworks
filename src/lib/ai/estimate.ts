/**
 * AI cost-estimation prompt + parser.
 *
 * Supports:
 * - ZIP-aware estimate
 * - category-specific detailed answers
 * - material preferences as object or string
 * - ZIP-based material suggestions
 * - fallback estimate when Anthropic key is missing or AI response fails
 */

import Anthropic from '@anthropic-ai/sdk';
import type { ProjectScope } from '@/lib/types';

export type EstimateQualityLevel =
  | 'budget'
  | 'standard'
  | 'premium'
  | 'luxury';

export interface EstimateInput {
  categoryName: string;
  zipCode: string;
  description: string;
  squareFootage?: number | null;
  qualityLevel?: EstimateQualityLevel | string | null;
  projectScope?: ProjectScope | string | null;

  /**
   * Old form: string
   * New detailed form: object like:
   * {
   *   cabinets: {
   *     preferred_quality,
   *     preferred_material,
   *     preferred_brand,
   *     custom_note
   *   }
   * }
   */
  materialPreferences?: string | Record<string, any> | null;

  /**
   * New detailed answers from category-specific form.
   */
  detailedAnswers?: Record<string, any> | null;

  /**
   * Local ZIP material guidance from src/lib/zipMaterialSuggestions.ts.
   */
  zipMaterialSuggestions?: Record<string, any> | null;
}

export interface EstimateBreakdown {
  labor: number;
  materials: number;
  permits_and_overhead: number;
  contingency: number;
}

export interface EstimateResult {
  min: number;
  max: number;
  reasoning: string;
  breakdown?: EstimateBreakdown;
}

const SYSTEM_PROMPT = `
You are an experienced US home renovation cost estimator.
You estimate residential renovation projects using category, ZIP code, project scope, size, material quality, local availability, and homeowner-provided details.
You produce realistic, conservative cost ranges and structured breakdowns.
Always respond with a single JSON object and nothing else.
`;

function buildUserPrompt(input: EstimateInput) {
  const lines = [
    `Estimate the total cost range in USD for this US home renovation project.`,
    ``,
    `Category: ${input.categoryName}`,
    `ZIP code: ${input.zipCode}`,
    `Use the ZIP code to infer regional labor cost, supplier availability, permit/overhead variation, and typical material choices.`,
  ];

  if (input.squareFootage) {
    lines.push(`Approximate size: ${input.squareFootage} sq ft`);
  }

  if (input.qualityLevel) {
    lines.push(`Quality / finish level: ${describeQualityLevel(input.qualityLevel)}`);
  }

  if (input.projectScope) {
    lines.push(`Project scope: ${describeProjectScope(input.projectScope)}`);
  }

  const materialSummary = formatMaterialPreferencesForPrompt(
    input.materialPreferences,
  );

  if (materialSummary) {
    lines.push(``, `Homeowner material / product preferences:`, materialSummary);
  }

  const answerSummary = formatAnswersForPrompt(input.detailedAnswers);

  if (answerSummary) {
    lines.push(``, `Detailed homeowner answers:`, answerSummary);
  }

  const zipSuggestionSummary = formatZipSuggestionsForPrompt(
    input.zipMaterialSuggestions,
  );

  if (zipSuggestionSummary) {
    lines.push(``, `ZIP-based material guidance from the app:`, zipSuggestionSummary);
  }

  lines.push(``, `Project description:`, input.description, ``);

  lines.push(
    `Estimate the middle 80% likely cost range for this ZIP area.`,
    `Use the provided project details heavily. Do not treat this as a generic national estimate.`,
    `If the homeowner requested premium or luxury materials, reflect that in material and labor complexity.`,
    `If important measurements are missing, include a reasonable uncertainty range but do not make the estimate uselessly wide.`,
    `If there are risk factors such as plumbing relocation, electrical changes, hidden damage, HOA/building rules, or structural work, reflect that in contingency and reasoning.`,
    ``,
    `Return ONLY this JSON shape:`,
    `{`,
    `  "min": <number>,`,
    `  "max": <number>,`,
    `  "breakdown": {`,
    `    "labor": <number>,`,
    `    "materials": <number>,`,
    `    "permits_and_overhead": <number>,`,
    `    "contingency": <number>`,
    `  },`,
    `  "reasoning": "<2-4 sentence explanation referencing ZIP, scope, quality/material choices, and risk assumptions>"`,
    `}`,
  );

  return lines.join('\n');
}

export async function generateEstimate(
  input: EstimateInput,
): Promise<EstimateResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return heuristicFallback(input);
  }

  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
  });

  const model =
    process.env.ANTHROPIC_MODEL ||
    'claude-haiku-4-5-20251001';

  const message = await client.messages.create({
    model,
    max_tokens: 900,
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: 'user',
        content: buildUserPrompt(input),
      },
    ],
  });

  const text = message.content
    .filter((block): block is Extract<typeof block, { type: 'text' }> => {
      return block.type === 'text';
    })
    .map((block) => block.text)
    .join('')
    .trim();

  const jsonText = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/```$/, '')
    .trim();

  let parsed: any;

  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return heuristicFallback(
      input,
      'AI response was not valid JSON; using heuristic fallback.',
    );
  }

  if (typeof parsed?.min !== 'number' || typeof parsed?.max !== 'number') {
    return heuristicFallback(
      input,
      'AI response was missing min/max fields; using heuristic fallback.',
    );
  }

  const min = Math.max(0, Math.round(parsed.min));
  const max = Math.max(min, Math.round(parsed.max));

  const breakdown: EstimateBreakdown | undefined = parsed.breakdown
    ? {
        labor: safeMoney(parsed.breakdown.labor),
        materials: safeMoney(parsed.breakdown.materials),
        permits_and_overhead: safeMoney(parsed.breakdown.permits_and_overhead),
        contingency: safeMoney(parsed.breakdown.contingency),
      }
    : undefined;

  return {
    min,
    max,
    reasoning:
      typeof parsed.reasoning === 'string'
        ? parsed.reasoning
        : 'Estimate generated from project category, ZIP code, scope, quality level and homeowner-provided details.',
    breakdown,
  };
}

/**
 * Fallback estimate so the app still works without an API key.
 * This is ZIP-aware and detail-aware enough for MVP, but not a real estimating engine.
 */
function heuristicFallback(input: EstimateInput, note?: string): EstimateResult {
  const categoryBase: Record<string, [number, number]> = {
    'Kitchen Remodel': [15000, 60000],
    'Bathroom Remodel': [8000, 30000],
    Roofing: [6000, 20000],
    Flooring: [3000, 15000],
    'Interior / Exterior Paint': [2000, 8000],
    'Windows & Doors': [4000, 18000],
    Plumbing: [500, 8000],
    Electrical: [500, 10000],
    HVAC: [4000, 14000],
    'Addition / Extension': [40000, 200000],
    'Basement Finishing': [15000, 60000],
    'Deck & Patio': [4000, 25000],
    Landscaping: [2000, 20000],
    Siding: [8000, 25000],
    'Handyman / Small Repairs': [150, 1500],
  };

  let [min, max] = categoryBase[input.categoryName] ?? [3000, 25000];

  const qualityMultiplier = getQualityMultiplier(input.qualityLevel);
  min = Math.round(min * qualityMultiplier);
  max = Math.round(max * qualityMultiplier);

  const scopeMultiplier = getScopeMultiplier(input.projectScope);
  min = Math.round(min * scopeMultiplier);
  max = Math.round(max * scopeMultiplier);

  const zipMultiplier = getZipCostMultiplier(input.zipCode);
  min = Math.round(min * zipMultiplier);
  max = Math.round(max * zipMultiplier);

  const detailMultiplier = getDetailMultiplier(input);
  min = Math.round(min * detailMultiplier);
  max = Math.round(max * detailMultiplier);

  const sizeMultiplier = getSizeMultiplier(input);
  min = Math.round(min * sizeMultiplier);
  max = Math.round(max * sizeMultiplier);

  const mid = (min + max) / 2;

  const breakdown = buildHeuristicBreakdown(
    mid,
    input.categoryName,
    input.qualityLevel,
  );

  return {
    min,
    max,
    breakdown,
    reasoning:
      (note ? `${note} ` : '') +
      `Heuristic ZIP-aware estimate for ${input.categoryName} in ZIP ${input.zipCode}. ` +
      `The range reflects ${input.qualityLevel || 'unspecified'} quality, ${String(
        input.projectScope || 'unspecified',
      ).replaceAll('_', ' ')} scope, regional cost multiplier, material preferences and risk factors from the detailed brief. ` +
      `Connect ANTHROPIC_API_KEY in .env.local for a project-specific AI estimate.`,
  };
}

function safeMoney(value: unknown) {
  return Math.max(0, Math.round(Number(value) || 0));
}

function describeQualityLevel(value: string) {
  const map: Record<string, string> = {
    budget: 'Budget — entry-level fixtures, basic materials, big-box store options',
    standard: 'Standard — mid-range, reliable mainstream brands and finishes',
    premium: 'Premium — higher-end finishes, custom or semi-custom work, designer fixtures',
    luxury: 'Luxury — top-tier materials, custom details, premium slabs, designer-grade finishes',
  };

  return map[value] ?? value;
}

function describeProjectScope(value: string) {
  const map: Record<string, string> = {
    full_remodel: 'Full remodel — gut and rebuild everything',
    partial_remodel: 'Partial remodel — keep some elements and replace others',
    repair: 'Repair only — fix what is broken without expanding scope',
    new_install: 'New install — brand-new build, fixture, system, addition or structure',
  };

  return map[value] ?? value;
}

function formatMaterialPreferencesForPrompt(
  value: EstimateInput['materialPreferences'],
) {
  if (!value) return '';

  if (typeof value === 'string') {
    return value.trim();
  }

  if (typeof value !== 'object') return '';

  return Object.entries(value)
    .map(([key, item]) => {
      if (!item || typeof item !== 'object') return null;

      const preferredMaterial = String(item.preferred_material ?? '').trim();
      const preferredQuality = String(item.preferred_quality ?? '').trim();
      const preferredBrand = String(item.preferred_brand ?? '').trim();
      const customNote = String(item.custom_note ?? '').trim();

      const parts = [
        preferredMaterial ? `material: ${preferredMaterial}` : null,
        preferredQuality ? `quality: ${preferredQuality}` : null,
        preferredBrand ? `brand/store: ${preferredBrand}` : null,
        customNote ? `note: ${customNote}` : null,
      ].filter(Boolean);

      if (parts.length === 0) return null;

      return `- ${humanizeKey(key)}: ${parts.join(', ')}`;
    })
    .filter(Boolean)
    .join('\n');
}

function formatAnswersForPrompt(value: EstimateInput['detailedAnswers']) {
  if (!value || typeof value !== 'object') return '';

  return Object.entries(value)
    .map(([key, answer]) => {
      if (answer === null || answer === undefined) return null;

      const formatted = Array.isArray(answer)
        ? answer.join(', ')
        : typeof answer === 'object'
          ? JSON.stringify(answer)
          : String(answer);

      if (!formatted.trim()) return null;

      return `- ${humanizeKey(key)}: ${formatted}`;
    })
    .filter(Boolean)
    .join('\n');
}

function formatZipSuggestionsForPrompt(
  value: EstimateInput['zipMaterialSuggestions'],
) {
  if (!value || typeof value !== 'object') return '';

  const regionLabel = String(value.regionLabel ?? '').trim();
  const note = String(value.note ?? '').trim();
  const suggestions = value.suggestions;

  const lines: string[] = [];

  if (regionLabel) lines.push(`Region: ${regionLabel}`);
  if (note) lines.push(`Note: ${note}`);

  if (suggestions && typeof suggestions === 'object') {
    for (const [key, items] of Object.entries(suggestions)) {
      if (Array.isArray(items) && items.length > 0) {
        lines.push(`- ${humanizeKey(key)}: ${items.join(', ')}`);
      }
    }
  }

  return lines.join('\n');
}

function getQualityMultiplier(value?: string | null) {
  if (value === 'budget') return 0.75;
  if (value === 'standard') return 1;
  if (value === 'premium') return 1.6;
  if (value === 'luxury') return 2.2;

  return 1;
}

function getScopeMultiplier(value?: string | null) {
  if (value === 'full_remodel') return 1;
  if (value === 'partial_remodel') return 0.65;
  if (value === 'repair') return 0.25;
  if (value === 'new_install') return 1.1;

  return 1;
}

/**
 * Broad regional approximation by ZIP prefix.
 * This is intentionally simple for MVP. Later you can replace it with
 * RSMeans, supplier data, contractor bids, or your own historical dataset.
 */
function getZipCostMultiplier(zipCode: string) {
  const zip = zipCode.trim();

  const firstTwo = Number(zip.slice(0, 2));
  const firstThree = Number(zip.slice(0, 3));

  /**
   * Central Texas / Austin-area examples: 786xx, 787xx.
   * Leander 78641 is typically not as expensive as coastal CA/NY,
   * but has stronger demand than very low-cost rural regions.
   */
  if (zip.startsWith('786') || zip.startsWith('787')) return 1.08;

  /**
   * California coastal / high-cost metros.
   */
  if (
    (firstTwo >= 90 && firstTwo <= 94) ||
    zip.startsWith('941') ||
    zip.startsWith('940') ||
    zip.startsWith('950') ||
    zip.startsWith('951')
  ) {
    return 1.35;
  }

  /**
   * NYC / Long Island / parts of NJ.
   */
  if (
    zip.startsWith('100') ||
    zip.startsWith('101') ||
    zip.startsWith('102') ||
    zip.startsWith('112') ||
    zip.startsWith('113') ||
    zip.startsWith('114') ||
    zip.startsWith('115') ||
    zip.startsWith('070') ||
    zip.startsWith('073')
  ) {
    return 1.35;
  }

  /**
   * Boston / DC / Seattle-ish high-cost groups.
   */
  if (
    zip.startsWith('021') ||
    zip.startsWith('022') ||
    zip.startsWith('200') ||
    zip.startsWith('981') ||
    zip.startsWith('980')
  ) {
    return 1.25;
  }

  /**
   * Large sunbelt metros, moderate-to-high.
   */
  if (
    zip.startsWith('750') ||
    zip.startsWith('752') ||
    zip.startsWith('770') ||
    zip.startsWith('850') ||
    zip.startsWith('852') ||
    zip.startsWith('331') ||
    zip.startsWith('328') ||
    zip.startsWith('303')
  ) {
    return 1.1;
  }

  /**
   * Lower-cost broad middle/rural approximation.
   */
  if (
    Number.isFinite(firstThree) &&
    (
      firstTwo < 40 ||
      (firstTwo >= 50 && firstTwo <= 69)
    )
  ) {
    return 0.95;
  }

  return 1;
}

function getDetailMultiplier(input: EstimateInput) {
  const answers = input.detailedAnswers ?? {};
  const text = [
    input.description,
    JSON.stringify(input.materialPreferences ?? {}),
    JSON.stringify(answers),
  ]
    .join(' ')
    .toLowerCase();

  let multiplier = 1;

  const riskWords = [
    'water damage',
    'mold',
    'structural',
    'wall removal',
    'load bearing',
    'plumbing relocation',
    'electrical panel',
    'rewire',
    'permit',
    'hoa',
    'asbestos',
    'foundation',
  ];

  for (const word of riskWords) {
    if (text.includes(word)) {
      multiplier += 0.04;
    }
  }

  const premiumWords = [
    'custom',
    'designer',
    'marble',
    'natural stone',
    'premium',
    'luxury',
    'high-end',
    'quartz',
  ];

  for (const word of premiumWords) {
    if (text.includes(word)) {
      multiplier += 0.025;
    }
  }

  return Math.min(multiplier, 1.35);
}

function getSizeMultiplier(input: EstimateInput) {
  if (!input.squareFootage) return 1;

  const size = input.squareFootage;
  const category = input.categoryName.toLowerCase();

  if (category.includes('kitchen')) {
    if (size < 80) return 0.85;
    if (size <= 180) return 1;
    if (size <= 300) return 1.25;
    return 1.5;
  }

  if (category.includes('bathroom')) {
    if (size < 40) return 0.85;
    if (size <= 90) return 1;
    if (size <= 160) return 1.25;
    return 1.45;
  }

  if (category.includes('flooring') || category.includes('paint')) {
    if (size < 500) return 0.85;
    if (size <= 1500) return 1;
    if (size <= 3000) return 1.35;
    return 1.75;
  }

  return 1;
}

function buildHeuristicBreakdown(
  midpoint: number,
  categoryName: string,
  qualityLevel?: string | null,
): EstimateBreakdown {
  const category = categoryName.toLowerCase();

  let laborPct = 0.5;
  let materialPct = 0.35;
  let permitPct = 0.08;
  let contingencyPct = 0.07;

  if (category.includes('kitchen')) {
    laborPct = 0.42;
    materialPct = 0.43;
    permitPct = 0.07;
    contingencyPct = 0.08;
  }

  if (category.includes('bathroom')) {
    laborPct = 0.48;
    materialPct = 0.35;
    permitPct = 0.07;
    contingencyPct = 0.1;
  }

  if (category.includes('roof')) {
    laborPct = 0.45;
    materialPct = 0.42;
    permitPct = 0.06;
    contingencyPct = 0.07;
  }

  if (category.includes('plumbing') || category.includes('electrical')) {
    laborPct = 0.65;
    materialPct = 0.18;
    permitPct = 0.09;
    contingencyPct = 0.08;
  }

  if (qualityLevel === 'premium' || qualityLevel === 'luxury') {
    materialPct += 0.05;
    laborPct -= 0.03;
    contingencyPct -= 0.02;
  }

  return {
    labor: Math.round(midpoint * laborPct),
    materials: Math.round(midpoint * materialPct),
    permits_and_overhead: Math.round(midpoint * permitPct),
    contingency: Math.round(midpoint * contingencyPct),
  };
}

function humanizeKey(key: string) {
  return key
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}