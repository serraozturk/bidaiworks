import type {
  Project,
  ProjectAnswer,
  ProjectRequiredPhoto,
} from '@/lib/types';

function answerToString(value: ProjectAnswer['answer_value']) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function getProjectRiskWarnings(params: {
  project: Project;
  answers: ProjectAnswer[];
  requiredPhotos: ProjectRequiredPhoto[];
}) {
  const warnings: string[] = [];

  const answerMap = new Map(
    params.answers.map((item) => [item.question_key, answerToString(item.answer_value)]),
  );

  const missingRequiredPhotos = params.requiredPhotos.filter((photo) => {
    return photo.is_required && !photo.image_url;
  });

  if (missingRequiredPhotos.length > 0) {
    warnings.push(`${missingRequiredPhotos.length} required project photos are missing.`);
  }

  const currentCondition = answerMap.get('current_condition')?.toLowerCase() ?? '';

  if (
    currentCondition.includes('damage') ||
    currentCondition.includes('water') ||
    currentCondition.includes('mold') ||
    currentCondition.includes('leak')
  ) {
    warnings.push('Damage, leak, moisture or mold-related conditions may affect final pricing.');
  }

  const plumbingChange =
    answerMap.get('plumbing_change') ||
    answerMap.get('plumbing_relocation') ||
    '';

  if (
    plumbingChange.toLowerCase().includes('yes') ||
    plumbingChange.toLowerCase().includes('maybe') ||
    plumbingChange.toLowerCase().includes('not sure')
  ) {
    warnings.push('Plumbing changes may require licensed work, inspection, permits or extra labor.');
  }

  const electricalChange = answerMap.get('electrical_change') ?? '';

  if (
    electricalChange.toLowerCase().includes('yes') ||
    electricalChange.toLowerCase().includes('maybe') ||
    electricalChange.toLowerCase().includes('not sure')
  ) {
    warnings.push('Electrical changes may require licensed work, inspection, permits or panel review.');
  }

  if (params.project.quality_level === 'premium' || params.project.quality_level === 'luxury') {
    warnings.push('Premium or luxury material selections can vary significantly by ZIP code and supplier availability.');
  }

  if (!params.project.measurement_notes?.trim() && !params.project.square_footage) {
    warnings.push('Measurements are incomplete. Contractor should include measurement assumptions in the offer.');
  }

  if (!params.project.access_notes?.trim()) {
    warnings.push('Access, parking, stairs, elevator, HOA or work-hour restrictions are not fully described.');
  }

  if (warnings.length === 0) {
    warnings.push('No major project risks detected from the submitted brief.');
  }

  return warnings;
}