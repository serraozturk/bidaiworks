export interface OfferScopeDetails {
  included: string;
  excluded: string;
  notes: string;
  materialAllowance?: string;
  assumptions?: string;
  riskNotes?: string;
  warranty?: string;
}

const INCLUDED_LABEL = 'Included:';
const EXCLUDED_LABEL = 'Excluded:';
const MATERIAL_ALLOWANCE_LABEL = 'Material allowance:';
const ASSUMPTIONS_LABEL = 'Assumptions:';
const RISK_NOTES_LABEL = 'Risk notes:';
const WARRANTY_LABEL = 'Warranty:';
const NOTES_LABEL = 'Notes:';

export function composeOfferMessage(details: OfferScopeDetails) {
  return [
    INCLUDED_LABEL,
    details.included.trim(),
    '',
    EXCLUDED_LABEL,
    details.excluded.trim() || 'No exclusions listed.',
    '',
    MATERIAL_ALLOWANCE_LABEL,
    details.materialAllowance?.trim() || 'No material allowance listed.',
    '',
    ASSUMPTIONS_LABEL,
    details.assumptions?.trim() || 'No assumptions listed.',
    '',
    RISK_NOTES_LABEL,
    details.riskNotes?.trim() || 'No risk notes listed.',
    '',
    WARRANTY_LABEL,
    details.warranty?.trim() || 'No warranty listed.',
    '',
    NOTES_LABEL,
    details.notes.trim() || 'No additional notes.',
  ].join('\n');
}

export function parseOfferMessage(message?: string | null): OfferScopeDetails {
  const text = message ?? '';

  return {
    included: extractSection(text, INCLUDED_LABEL, EXCLUDED_LABEL) || 'Not specified',

    excluded:
      extractSection(text, EXCLUDED_LABEL, MATERIAL_ALLOWANCE_LABEL) ||
      extractSection(text, EXCLUDED_LABEL, NOTES_LABEL) ||
      'No exclusions listed',

    materialAllowance:
      extractSection(text, MATERIAL_ALLOWANCE_LABEL, ASSUMPTIONS_LABEL) ||
      'No material allowance listed',

    assumptions:
      extractSection(text, ASSUMPTIONS_LABEL, RISK_NOTES_LABEL) ||
      'No assumptions listed',

    riskNotes:
      extractSection(text, RISK_NOTES_LABEL, WARRANTY_LABEL) ||
      'No risk notes listed',

    warranty:
      extractSection(text, WARRANTY_LABEL, NOTES_LABEL) ||
      'No warranty listed',

    notes: extractSection(text, NOTES_LABEL) || fallbackNotes(text),
  };
}

function extractSection(text: string, startLabel: string, endLabel?: string) {
  const start = text.indexOf(startLabel);
  if (start === -1) return '';

  const from = start + startLabel.length;
  const end = endLabel ? text.indexOf(endLabel, from) : -1;

  return text.slice(from, end === -1 ? undefined : end).trim();
}

function fallbackNotes(text: string) {
  if (!text.trim()) return 'No additional notes';

  const knownLabels = [
    INCLUDED_LABEL,
    EXCLUDED_LABEL,
    MATERIAL_ALLOWANCE_LABEL,
    ASSUMPTIONS_LABEL,
    RISK_NOTES_LABEL,
    WARRANTY_LABEL,
    NOTES_LABEL,
  ];

  if (knownLabels.some((label) => text.includes(label))) {
    return 'No additional notes';
  }

  return text.trim();
}