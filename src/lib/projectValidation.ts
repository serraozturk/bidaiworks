import type { ProjectBriefPhoto, ProjectBriefQuestion } from '@/lib/projectBriefConfig';

export function validateRequiredProjectPhotos(
  requiredPhotos: ProjectBriefPhoto[],
  uploadedPhotos: Record<string, string | null | undefined>,
) {
  const missingPhotos = requiredPhotos.filter((photo) => {
    return photo.required && !uploadedPhotos[photo.key];
  });

  return {
    isValid: missingPhotos.length === 0,
    missingPhotos,
  };
}

export function validateRequiredProjectAnswers(
  requiredQuestions: ProjectBriefQuestion[],
  answers: Record<string, unknown>,
) {
  const missingQuestions = requiredQuestions.filter((question) => {
    if (!question.required) return false;

    const value = answers[question.key];

    if (Array.isArray(value)) return value.length === 0;
    if (typeof value === 'string') return value.trim().length === 0;

    return value === null || value === undefined;
  });

  return {
    isValid: missingQuestions.length === 0,
    missingQuestions,
  };
}

export function calculateBriefCompleteness(params: {
  requiredQuestions: ProjectBriefQuestion[];
  answers: Record<string, unknown>;
  requiredPhotos: ProjectBriefPhoto[];
  uploadedPhotos: Record<string, string | null | undefined>;
}) {
  const answerValidation = validateRequiredProjectAnswers(
    params.requiredQuestions,
    params.answers,
  );

  const photoValidation = validateRequiredProjectPhotos(
    params.requiredPhotos,
    params.uploadedPhotos,
  );

  return {
    isComplete: answerValidation.isValid && photoValidation.isValid,
    missingQuestions: answerValidation.missingQuestions,
    missingPhotos: photoValidation.missingPhotos,
  };
}