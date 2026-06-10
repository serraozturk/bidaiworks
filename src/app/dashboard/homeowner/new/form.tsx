'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import {
  type Category,
  type QualityLevel,
  type ProjectScope,
  QUALITY_LEVELS,
  PROJECT_SCOPES,
} from '@/lib/types';
import {
  getProjectBriefCategory,
  type ProjectBriefCategory,
  type ProjectBriefQuestion,
} from '@/lib/projectBriefConfig';
import { getZipMaterialSuggestions } from '@/lib/zipMaterialSuggestions';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Card, CardBody } from '@/components/ui/Card';
import { cn, formatCurrency, formatRange } from '@/lib/utils';

interface Props {
  categories: Category[];
  adminBriefConfigs?: Record<string, ProjectBriefCategory>;
}

interface AiEstimate {
  min: number;
  max: number;
  reasoning: string;
  breakdown?: {
    labor: number;
    materials: number;
    permits_and_overhead: number;
    contingency: number;
  };
}

type AnswerValue = string | string[] | number | boolean | null;

interface MaterialFormValue {
  preferred_quality: string;
  preferred_material: string;
  preferred_brand: string;
  custom_note: string;
}

const MAX_PHOTO_SIZE_MB = 8;
const MAX_PHOTO_SIZE_BYTES = MAX_PHOTO_SIZE_MB * 1024 * 1024;
const VALID_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export default function NewProjectForm({ categories, adminBriefConfigs = {} }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [categoryId, setCategoryId] = useState('');
  const [title, setTitle] = useState('');
  const [zip, setZip] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [streetAddress, setStreetAddress] = useState('');

  const [projectScope, setProjectScope] = useState<ProjectScope | ''>('');
  const [qualityLevel, setQualityLevel] = useState<QualityLevel | ''>('');
  const [sqft, setSqft] = useState('');
  const [description, setDescription] = useState('');

  const [budgetMin, setBudgetMin] = useState('');
  const [budgetMax, setBudgetMax] = useState('');
  const [startDate, setStartDate] = useState('');

  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [photoFiles, setPhotoFiles] = useState<Record<string, File | null>>({});
  const [materialValues, setMaterialValues] = useState<Record<string, MaterialFormValue>>({});

  const [estimate, setEstimate] = useState<AiEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marketplaceAccepted, setMarketplaceAccepted] = useState(false);

  const selectedCategory = categories.find((category) => category.id === categoryId);

  const briefCategory = useMemo<ProjectBriefCategory | null>(() => {
    if (!selectedCategory) return null;
    const adminConfig = adminBriefConfigs[selectedCategory.slug];
    if (adminConfig) return adminConfig;
    return getProjectBriefCategory(selectedCategory.slug);
  }, [selectedCategory, adminBriefConfigs]);

  const zipSuggestions = useMemo(() => {
    return getZipMaterialSuggestions(zip);
  }, [zip]);

  const requiredQuestionCount = briefCategory?.questions.filter((q) => q.required).length ?? 0;
  const answeredRequiredQuestionCount = briefCategory?.questions.filter((q) => {
    if (!q.required) return false;
    return isAnswerFilled(answers[q.key]);
  }).length ?? 0;

  const requiredPhotoCount = briefCategory?.requiredPhotos.filter((photo) => photo.required).length ?? 0;
  const uploadedRequiredPhotoCount = briefCategory?.requiredPhotos.filter((photo) => {
    return photo.required && Boolean(photoFiles[photo.key]);
  }).length ?? 0;

  const materialCount = briefCategory?.materials.length ?? 0;
  const completedMaterialCount = briefCategory?.materials.filter((material) => {
    return isMaterialComplete(materialValues[material.key]);
  }).length ?? 0;

  const missingRequiredQuestions = useMemo(() => {
    return (
      briefCategory?.questions.filter((question) => {
        return question.required && !isAnswerFilled(answers[question.key]);
      }) ?? []
    );
  }, [briefCategory, answers]);

  const missingRequiredPhotos = useMemo(() => {
    return (
      briefCategory?.requiredPhotos.filter((photo) => {
        return photo.required && !photoFiles[photo.key];
      }) ?? []
    );
  }, [briefCategory, photoFiles]);

  const missingMaterials = useMemo(() => {
    return (
      briefCategory?.materials.filter((material) => {
        return !isMaterialComplete(materialValues[material.key]);
      }) ?? []
    );
  }, [briefCategory, materialValues]);

  const budgetPreview = useMemo(() => {
    const min = budgetMin ? Number(budgetMin) : null;
    const max = budgetMax ? Number(budgetMax) : null;

    if (!min && !max) return 'Required for better offers';

    return formatRange(min, max);
  }, [budgetMin, budgetMax]);

  const completionScore = useMemo(() => {
    const checks = [
      Boolean(categoryId),
      Boolean(title.trim()),
      /^\d{5}$/.test(zip.trim()),
      Boolean(projectScope),
      Boolean(qualityLevel),
      description.trim().length >= 30,
      Boolean(budgetMin || budgetMax),
      requiredQuestionCount > 0 && answeredRequiredQuestionCount === requiredQuestionCount,
      requiredPhotoCount > 0 && uploadedRequiredPhotoCount === requiredPhotoCount,
      materialCount > 0 && completedMaterialCount === materialCount,
    ];

    const completed = checks.filter(Boolean).length;

    return Math.round((completed / checks.length) * 100);
  }, [
    categoryId,
    title,
    zip,
    projectScope,
    qualityLevel,
    description,
    budgetMin,
    budgetMax,
    requiredQuestionCount,
    answeredRequiredQuestionCount,
    requiredPhotoCount,
    uploadedRequiredPhotoCount,
    materialCount,
    completedMaterialCount,
  ]);

  const canSubmit =
    Boolean(categoryId) &&
    Boolean(title.trim()) &&
    /^\d{5}$/.test(zip.trim()) &&
    Boolean(projectScope) &&
    Boolean(qualityLevel) &&
    description.trim().length >= 30 &&
    missingRequiredQuestions.length === 0 &&
    missingRequiredPhotos.length === 0 &&
    missingMaterials.length === 0 &&
    marketplaceAccepted &&
    !submitting;

  useEffect(() => {
    if (!searchParams) return;

    const slug = searchParams.get('category');

    if (slug) {
      const match = categories.find(
        (category) => category.slug === slug || category.id === slug,
      );

      if (match) {
        setCategoryId(match.id);
      }
    }

    const zipParam = searchParams.get('zip');
    const cityParam = searchParams.get('city');

    if (zipParam) setZip(zipParam);
    if (cityParam) setCity(cityParam);
  }, [searchParams, categories]);

  function handleCategoryChange(nextCategoryId: string) {
    setCategoryId(nextCategoryId);
    setAnswers({});
    setPhotoFiles({});
    setMaterialValues({});
    setEstimate(null);
    setError(null);
  }

  function updateAnswer(questionKey: string, value: AnswerValue) {
    setAnswers((current) => ({
      ...current,
      [questionKey]: value,
    }));
  }

  function toggleMultiAnswer(questionKey: string, option: string) {
    const currentValue = answers[questionKey];
    const currentArray = Array.isArray(currentValue) ? currentValue : [];

    const nextArray = currentArray.includes(option)
      ? currentArray.filter((item) => item !== option)
      : [...currentArray, option];

    updateAnswer(questionKey, nextArray);
  }

  function updateMaterialValue(
    itemKey: string,
    field: keyof MaterialFormValue,
    value: string,
  ) {
    setMaterialValues((current) => ({
      ...current,
      [itemKey]: {
        preferred_quality: current[itemKey]?.preferred_quality ?? '',
        preferred_material: current[itemKey]?.preferred_material ?? '',
        preferred_brand: current[itemKey]?.preferred_brand ?? '',
        custom_note: current[itemKey]?.custom_note ?? '',
        [field]: value,
      },
    }));
  }

  async function fetchEstimate() {
    setError(null);

    if (!selectedCategory) {
      setError('Please select a project category before requesting an estimate.');
      return;
    }

    if (!/^\d{5}$/.test(zip.trim())) {
      setError('Please enter a valid 5-digit ZIP code before requesting an estimate.');
      return;
    }

    if (description.trim().length < 30) {
      setError('Please describe the work with at least 30 characters before requesting an estimate.');
      return;
    }

    setEstimating(true);

    try {
      const response = await fetch('/api/ai-estimate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          categoryName: selectedCategory.name,
          zipCode: zip.trim(),
          description: description.trim(),
          squareFootage: sqft ? Number(sqft) : null,
          qualityLevel: qualityLevel || null,
          projectScope: projectScope || null,
          materialPreferences: materialValues,
          detailedAnswers: answers,
          zipMaterialSuggestions: zipSuggestions,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        const message =
          json.error?.formErrors?.join(', ') ||
          json.error ||
          'Could not generate estimate.';

        throw new Error(message);
      }

      setEstimate(json);
    } catch (err: any) {
      setError(err?.message ?? 'Could not generate estimate.');
    } finally {
      setEstimating(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const cleanTitle = title.trim();
    const cleanZip = zip.trim();
    const cleanDescription = description.trim();

    if (!briefCategory) {
      setError('This category is not fully configured yet. Please select another category or add it to projectBriefConfig.ts.');
      return;
    }

    if (!categoryId) {
      setError('Please select a category.');
      return;
    }

    if (!cleanTitle) {
      setError('Please enter a project title.');
      return;
    }

    if (!/^\d{5}$/.test(cleanZip)) {
      setError('Please enter a valid 5-digit ZIP code.');
      return;
    }

    if (!projectScope) {
      setError('Please select what kind of work this is.');
      return;
    }

    if (!qualityLevel) {
      setError('Please select a quality / finish level.');
      return;
    }

    if (cleanDescription.length < 30) {
      setError('Please describe the project with at least 30 characters.');
      return;
    }

    if (budgetMin && Number(budgetMin) < 0) {
      setError('Budget minimum cannot be negative.');
      return;
    }

    if (budgetMax && Number(budgetMax) < 0) {
      setError('Budget maximum cannot be negative.');
      return;
    }

    if (budgetMin && budgetMax && Number(budgetMin) > Number(budgetMax)) {
      setError('Budget minimum cannot be higher than budget maximum.');
      return;
    }

    if (sqft && Number(sqft) < 0) {
      setError('Approximate size cannot be negative.');
      return;
    }

    if (missingRequiredQuestions.length > 0) {
      setError(
        `Please answer all required project questions: ${missingRequiredQuestions
          .map((item) => item.label)
          .join(', ')}`,
      );
      return;
    }

    if (missingRequiredPhotos.length > 0) {
      setError(
        `Please upload all required photos: ${missingRequiredPhotos
          .map((item) => item.label)
          .join(', ')}`,
      );
      return;
    }

    if (missingMaterials.length > 0) {
      setError(
        `Please complete material preferences: ${missingMaterials
          .map((item) => item.label)
          .join(', ')}`,
      );
      return;
    }

    if (!marketplaceAccepted) {
      setError('Please accept the marketplace, privacy and project posting rules.');
      return;
    }

    setSubmitting(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setError('You need to sign in before creating a project.');
      setSubmitting(false);
      return;
    }

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        homeowner_id: user.id,
        category_id: categoryId,

        title: cleanTitle,
        description: cleanDescription,

        zip_code: cleanZip,
        city: city.trim() || null,
        state: stateCode.trim() || null,
        street_address: streetAddress.trim() || null,

        square_footage: sqft ? Number(sqft) : null,
        quality_level: qualityLevel || null,
        project_scope: projectScope || null,

        material_preferences: buildMaterialSummary(materialValues),

        property_type: stringOrNull(answers.property_type),
        homeowner_readiness: stringOrNull(answers.homeowner_readiness),
        desired_start_timing: stringOrNull(answers.desired_start_timing),
        desired_completion_timing: stringOrNull(answers.desired_completion_timing),
        access_notes: stringOrNull(answers.access_notes),
        measurement_notes: stringOrNull(answers.measurement_notes),

        photos_complete: true,
        brief_complete: true,

        budget_min: budgetMin ? Number(budgetMin) : null,
        budget_max: budgetMax ? Number(budgetMax) : null,
        desired_start_date: startDate || null,

        ai_estimate_min: estimate?.min ?? null,
        ai_estimate_max: estimate?.max ?? null,
        ai_estimate_reasoning: estimate?.reasoning ?? null,

        status: 'open',
        payment_status: 'unpaid',
      })
      .select('id')
      .single();

    if (projectError || !project) {
      setError(projectError?.message ?? 'Could not create project.');
      setSubmitting(false);
      return;
    }

    const answerRows = briefCategory.questions.map((question) => ({
      project_id: project.id,
      question_key: question.key,
      question_label: question.label,
      answer_value: answers[question.key] ?? null,
    }));

    if (answerRows.length > 0) {
      const { error: answersError } = await supabase
        .from('project_answers')
        .insert(answerRows);

      if (answersError) {
        setError(answersError.message);
        setSubmitting(false);
        return;
      }
    }

    const requiredPhotoRows: {
      project_id: string;
      photo_key: string;
      photo_label: string;
      photo_description: string;
      image_url: string | null;
      is_required: boolean;
      uploaded_at: string | null;
    }[] = [];

    const legacyPhotoRows: {
      project_id: string;
      url: string;
      caption: string;
      position: number;
    }[] = [];

    for (let index = 0; index < briefCategory.requiredPhotos.length; index += 1) {
      const photoRequirement = briefCategory.requiredPhotos[index];
      const file = photoFiles[photoRequirement.key];

      let publicUrl: string | null = null;

      if (file) {
        const safeFileName = file.name
          .replace(/\s+/g, '-')
          .replace(/[^a-zA-Z0-9.\-_]/g, '');

        const path = `${user.id}/${project.id}/${photoRequirement.key}-${Date.now()}-${safeFileName}`;

        const { error: uploadError } = await supabase.storage
          .from('project-photos')
          .upload(path, file, {
            cacheControl: '3600',
            upsert: false,
            contentType: file.type,
          });

        if (uploadError) {
          setError(`Photo upload failed for "${photoRequirement.label}": ${uploadError.message}`);
          setSubmitting(false);
          return;
        }

        const {
          data: { publicUrl: uploadedUrl },
        } = supabase.storage.from('project-photos').getPublicUrl(path);

        publicUrl = uploadedUrl;

        legacyPhotoRows.push({
          project_id: project.id,
          url: uploadedUrl,
          caption: photoRequirement.label,
          position: index,
        });
      }

      requiredPhotoRows.push({
        project_id: project.id,
        photo_key: photoRequirement.key,
        photo_label: photoRequirement.label,
        photo_description: photoRequirement.description,
        image_url: publicUrl,
        is_required: photoRequirement.required,
        uploaded_at: publicUrl ? new Date().toISOString() : null,
      });
    }

    if (requiredPhotoRows.length > 0) {
      const { error: requiredPhotosError } = await supabase
        .from('project_required_photos')
        .insert(requiredPhotoRows);

      if (requiredPhotosError) {
        setError(requiredPhotosError.message);
        setSubmitting(false);
        return;
      }
    }

    /**
     * Keep inserting into old project_photos too.
     * This prevents existing dashboard/project pages from breaking
     * until every page is migrated to project_required_photos.
     */
    if (legacyPhotoRows.length > 0) {
      await supabase.from('project_photos').insert(legacyPhotoRows);
    }

    const materialRows = briefCategory.materials.map((material) => {
      const value = materialValues[material.key];

      return {
        project_id: project.id,
        item_key: material.key,
        item_label: material.label,
        preferred_quality: value?.preferred_quality || null,
        preferred_material: value?.preferred_material || null,
        preferred_brand: value?.preferred_brand || null,
        custom_note: value?.custom_note || null,
        zip_based_suggestion: {
          regionLabel: zipSuggestions.regionLabel,
          note: zipSuggestions.note,
          suggestions: zipSuggestions.suggestions[material.key] ?? [],
        },
      };
    });

    if (materialRows.length > 0) {
      const { error: materialsError } = await supabase
        .from('project_material_preferences')
        .insert(materialRows);

      if (materialsError) {
        setError(materialsError.message);
        setSubmitting(false);
        return;
      }
    }

    router.push(`/dashboard/homeowner/projects/${project.id}`);
    router.refresh();
  }

  function handleRequiredPhotoChange(
    photoKey: string,
    event: React.ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      setPhotoFiles((current) => ({
        ...current,
        [photoKey]: null,
      }));
      return;
    }

    if (!VALID_IMAGE_TYPES.includes(file.type)) {
      setError(`${file.name}: unsupported file type. Please upload JPG, PNG, WEBP or GIF.`);
      return;
    }

    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setError(`${file.name}: larger than ${MAX_PHOTO_SIZE_MB}MB.`);
      return;
    }

    setPhotoFiles((current) => ({
      ...current,
      [photoKey]: file,
    }));

    setError(null);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <section className="sticky top-0 z-10 rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-wide text-[#f4510b]">
              Project brief quality
            </p>

            <h2 className="mt-1 text-lg font-black text-[#0f172a]">
              {completionScore}% complete
            </h2>

            <p className="mt-1 text-xs font-semibold text-slate-500">
              Contractors cannot chat before checkout. The brief must be complete before posting.
            </p>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 md:max-w-[360px]">
            <div
              className="h-full rounded-full bg-[#f4510b] transition-all"
              style={{ width: `${completionScore}%` }}
            />
          </div>
        </div>
      </section>

      <Card className="overflow-hidden rounded-xl border-slate-200 shadow-sm">
        <CardBody className="space-y-5">
          <SectionTitle
            step="1"
            title="What and where"
            description="Choose the exact type of work and location. ZIP affects pricing, materials and contractor availability."
          />

          <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
            <Select
              label="Category"
              required
              value={categoryId}
              onChange={(event) => handleCategoryChange(event.target.value)}
            >
              <option value="">Select a category...</option>

              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </Select>

            <Input
              label="Project title"
              placeholder="e.g. Master bathroom full remodel"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          {selectedCategory && !briefCategory && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              This category does not have a detailed brief configuration yet.
              Add slug "{selectedCategory.slug}" to projectBriefConfig.ts before allowing customers to post it.
            </div>
          )}

          <div className="grid gap-3 md:grid-cols-3">
            <Input
              label="ZIP code"
              required
              placeholder="78641"
              value={zip}
              onChange={(event) =>
                setZip(event.target.value.replace(/\D/g, '').slice(0, 5))
              }
            />

            <Input
              label="City"
              placeholder="Leander"
              value={city}
              onChange={(event) => setCity(event.target.value)}
            />

            <Input
              label="State"
              placeholder="TX"
              maxLength={2}
              value={stateCode}
              onChange={(event) =>
                setStateCode(event.target.value.toUpperCase().slice(0, 2))
              }
            />
          </div>

          <Input
            label="Street address"
            placeholder="123 Main St"
            value={streetAddress}
            onChange={(event) => setStreetAddress(event.target.value)}
            hint="Only revealed to the selected contractor after checkout."
          />
        </CardBody>
      </Card>

      <Card className="overflow-hidden rounded-xl border-slate-200 shadow-sm">
        <CardBody className="space-y-6">
          <SectionTitle
            step="2"
            title="Project type and quality"
            description="Contractors use this to understand the size of the job and the finish level expected."
          />

          <div>
            <label className="mb-2 block text-sm font-bold text-ink-700">
              What kind of work is this?
            </label>

            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
              {(Object.keys(PROJECT_SCOPES) as ProjectScope[]).map((scope) => {
                const meta = PROJECT_SCOPES[scope];
                const active = projectScope === scope;

                return (
                  <button
                    key={scope}
                    type="button"
                    onClick={() => setProjectScope(scope)}
                    className={cn(
                      'rounded-lg border p-4 text-left transition',
                      active
                        ? 'border-orange-300 bg-orange-50 ring-4 ring-orange-100'
                        : 'border-slate-200 bg-white hover:bg-slate-50',
                    )}
                  >
                    <div className="text-sm font-black text-ink-900">
                      {meta.label}
                    </div>

                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      {meta.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-ink-700">
              Quality / finish level
            </label>

            <div className="grid gap-2 md:grid-cols-3">
              {(Object.keys(QUALITY_LEVELS) as QualityLevel[]).map((quality) => {
                const meta = QUALITY_LEVELS[quality];
                const active = qualityLevel === quality;

                return (
                  <button
                    key={quality}
                    type="button"
                    onClick={() => setQualityLevel(quality)}
                    className={cn(
                      'rounded-lg border p-4 text-left transition',
                      active
                        ? 'border-orange-300 bg-orange-50 ring-4 ring-orange-100'
                        : 'border-slate-200 bg-white hover:bg-slate-50',
                    )}
                  >
                    <div className="font-black text-ink-900">
                      {meta.label}
                    </div>

                    <div className="mt-1 text-xs leading-5 text-slate-600">
                      {meta.description}
                    </div>

                    <div className="mt-2 text-xs italic text-slate-400">
                      e.g. {meta.example}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
            <Input
              label="Approximate size"
              type="number"
              min={0}
              placeholder="e.g. 120"
              value={sqft}
              onChange={(event) => setSqft(event.target.value)}
              hint="Add square footage if known."
            />

            <Textarea
              label="Describe the work in detail"
              placeholder="Explain the current condition, what should be removed, what should be installed, what style you want, and any problems contractors must know before offering."
              required
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              hint="Minimum 30 characters. More detail means better offers."
            />
          </div>
        </CardBody>
      </Card>

      {briefCategory && (
        <Card className="overflow-hidden rounded-xl border-slate-200 shadow-sm">
          <CardBody className="space-y-6">
            <SectionTitle
              step="3"
              title={`${briefCategory.label} details`}
              description="Answer every required question so contractors can price the job without asking follow-up questions."
            />

            <div className="rounded-lg border border-blue-100 bg-blue-50 px-4 py-3">
              <div className="text-xs font-black uppercase tracking-wide text-blue-800">
                Category brief
              </div>

              <p className="mt-1 text-sm leading-6 text-blue-950/80">
                {briefCategory.description}
              </p>
            </div>

            <div className="space-y-5">
              {briefCategory.questions.map((question) => (
                <QuestionField
                  key={question.key}
                  question={question}
                  value={answers[question.key]}
                  onChange={(value) => updateAnswer(question.key, value)}
                  onToggleMulti={(option) => toggleMultiAnswer(question.key, option)}
                />
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {briefCategory && (
        <Card className="overflow-hidden rounded-xl border-slate-200 shadow-sm">
          <CardBody className="space-y-5">
            <SectionTitle
              step="4"
              title="Materials and product preferences"
              description="ZIP-based options help homeowners choose realistic materials commonly used in their area."
            />

            <div className="rounded-lg border border-orange-100 bg-orange-50 px-4 py-3">
              <div className="text-xs font-black uppercase tracking-wide text-orange-800">
                ZIP-based material guidance: {zipSuggestions.regionLabel}
              </div>

              <p className="mt-1 text-sm leading-6 text-orange-950/80">
                {zipSuggestions.note}
              </p>
            </div>

            <div className="grid gap-4">
              {briefCategory.materials.map((material) => {
                const value = materialValues[material.key] ?? {
                  preferred_quality: '',
                  preferred_material: '',
                  preferred_brand: '',
                  custom_note: '',
                };

                const zipBasedSuggestions =
                  zipSuggestions.suggestions[material.key] ?? [];

                return (
                  <div
                    key={material.key}
                    className="rounded-lg border border-slate-200 bg-white p-4"
                  >
                    <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black text-ink-900">
                          {material.label}
                          <span className="ml-1 text-red-500">*</span>
                        </h3>

                        {zipBasedSuggestions.length > 0 && (
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Common near this ZIP: {zipBasedSuggestions.join(', ')}
                          </p>
                        )}
                      </div>

                      {isMaterialComplete(value) ? (
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">
                          Complete
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-700">
                          Required
                        </span>
                      )}
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <Select
                        label="Preferred material / product type"
                        required
                        value={value.preferred_material}
                        onChange={(event) =>
                          updateMaterialValue(
                            material.key,
                            'preferred_material',
                            event.target.value,
                          )
                        }
                      >
                        <option value="">Select...</option>

                        {material.options.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}

                        {material.allowCustom && (
                          <option value="Custom">Custom / I will describe</option>
                        )}
                      </Select>

                      <Select
                        label="Quality level"
                        required
                        value={value.preferred_quality}
                        onChange={(event) =>
                          updateMaterialValue(
                            material.key,
                            'preferred_quality',
                            event.target.value,
                          )
                        }
                      >
                        <option value="">Select...</option>

                        {material.qualityLevels.map((level) => (
                          <option key={level} value={level}>
                            {level}
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <Input
                        label="Preferred brand or store"
                        placeholder="e.g. Home Depot, Lowe’s, Kohler, Delta, IKEA..."
                        value={value.preferred_brand}
                        onChange={(event) =>
                          updateMaterialValue(
                            material.key,
                            'preferred_brand',
                            event.target.value,
                          )
                        }
                        hint="Optional, but useful."
                      />

                      <Textarea
                        label="Custom note"
                        placeholder="Describe color, style, product link, model, finish, or anything specific."
                        value={value.custom_note}
                        onChange={(event) =>
                          updateMaterialValue(
                            material.key,
                            'custom_note',
                            event.target.value,
                          )
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      <Card className="overflow-hidden rounded-xl border-slate-200 shadow-sm">
        <CardBody className="space-y-5">
          <SectionTitle
            step="5"
            title="Timing and budget"
            description="Budget and timeline help contractors decide whether they can realistically accept the job."
          />

          <div className="grid gap-3 md:grid-cols-3">
            <Input
              label="Desired start date"
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
            />

            <Input
              label="Budget min ($)"
              type="number"
              min={0}
              value={budgetMin}
              onChange={(event) => setBudgetMin(event.target.value)}
              hint="Strongly recommended."
            />

            <Input
              label="Budget max ($)"
              type="number"
              min={0}
              value={budgetMax}
              onChange={(event) => setBudgetMax(event.target.value)}
              hint="Strongly recommended."
            />
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">
              Budget preview
            </div>

            <div className="mt-1 text-lg font-black text-ink-900">
              {budgetPreview}
            </div>
          </div>
        </CardBody>
      </Card>

      {briefCategory && (
        <Card className="overflow-hidden rounded-xl border-slate-200 shadow-sm">
          <CardBody className="space-y-4">
            <SectionTitle
              step="6"
              title="Required photos from every angle"
              description="Photos are required because contractors cannot chat before checkout. Upload every requested angle."
            />

            <div className="grid gap-3">
              {briefCategory.requiredPhotos.map((photo) => {
                const file = photoFiles[photo.key];

                return (
                  <div
                    key={photo.key}
                    className={cn(
                      'rounded-lg border p-4',
                      file
                        ? 'border-emerald-200 bg-emerald-50'
                        : 'border-slate-200 bg-white',
                    )}
                  >
                    <div className="grid gap-4 lg:grid-cols-[1fr_340px] lg:items-center">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-sm font-black text-ink-900">
                            {photo.label}
                            {photo.required && <span className="ml-1 text-red-500">*</span>}
                          </h3>

                          {file ? (
                            <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-700">
                              Uploaded
                            </span>
                          ) : (
                            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-black text-amber-700">
                              Required
                            </span>
                          )}
                        </div>

                        <p className="mt-1 text-xs leading-5 text-slate-500">
                          {photo.description}
                        </p>

                        {file && (
                          <div className="mt-2 rounded-xl border border-emerald-200 bg-white px-3 py-2">
                            <div className="truncate text-xs font-black text-emerald-900">
                              {file.name}
                            </div>

                            <div className="mt-1 text-[11px] font-semibold text-emerald-700/70">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </div>
                          </div>
                        )}
                      </div>

                      <input
                        type="file"
                        accept={VALID_IMAGE_TYPES.join(',')}
                        onChange={(event) => handleRequiredPhotoChange(photo.key, event)}
                        className="block w-full text-sm text-ink-700 file:mr-3 file:rounded-xl file:border-0 file:bg-[#f4510b] file:px-4 file:py-2 file:text-sm file:font-black file:text-white hover:file:bg-[#d94406]"
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-xs leading-5 text-slate-500">
              Supported: JPG, PNG, WEBP, GIF. Max size: {MAX_PHOTO_SIZE_MB}MB per photo.
            </p>
          </CardBody>
        </Card>
      )}

      <Card className="overflow-hidden rounded-xl border-slate-200 shadow-sm">
        <CardBody className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionTitle
              step="7"
              title="AI cost estimate"
              description="Generate a rough ZIP-aware estimate before contractors send real offers."
            />

            <Button
              type="button"
              variant="secondary"
              onClick={fetchEstimate}
              disabled={estimating}
            >
              {estimating ? 'Estimating...' : estimate ? 'Re-estimate' : 'Get estimate'}
            </Button>
          </div>

          {estimate ? (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-5">
              <div className="text-xs font-black uppercase tracking-wide text-orange-700">
                Estimated range
              </div>

              <div className="mt-2 text-3xl font-black text-ink-900">
                {formatRange(estimate.min, estimate.max)}
              </div>

              {estimate.breakdown && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  <BreakdownPill label="Labor" amount={estimate.breakdown.labor} />
                  <BreakdownPill label="Materials" amount={estimate.breakdown.materials} />
                  <BreakdownPill
                    label="Permits / overhead"
                    amount={estimate.breakdown.permits_and_overhead}
                  />
                  <BreakdownPill
                    label="Contingency"
                    amount={estimate.breakdown.contingency}
                  />
                </div>
              )}

              {estimate.reasoning && (
                <p className="mt-4 text-sm leading-6 text-orange-950/80">
                  {estimate.reasoning}
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm leading-6 text-slate-500">
              Add category, ZIP, detailed answers, required photos and material preferences,
              then generate an AI estimate. Contractors will still send their own real offers.
            </div>
          )}
        </CardBody>
      </Card>

      <section className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <div className="text-xs font-black uppercase tracking-wide text-amber-800">
          Platform rules
        </div>

        <p className="mt-1 text-sm leading-6 text-amber-950/80">
          Contractors cannot directly chat before checkout. Your project brief,
          required photos, measurements, material preferences and budget must be detailed
          enough for contractors to send accurate offers. Direct contact and external
          payment links are not allowed.
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={marketplaceAccepted}
            onChange={(event) => setMarketplaceAccepted(event.target.checked)}
            className="mt-1 h-4 w-4 accent-[#f45112]"
            required
          />

          <span className="text-xs font-semibold leading-5 text-slate-600">
            I confirm this project information is accurate and I accept the{' '}
            <a href="/legal/terms" className="font-black text-[#f45112] hover:underline">
              Terms
            </a>
            {' '}and{' '}
            <a href="/legal/privacy" className="font-black text-[#f45112] hover:underline">
              Privacy/KVKK/GDPR Notice
            </a>
            . I understand contractor identity and direct chat may stay hidden
            until checkout and contractor commitment are complete.
          </span>
        </label>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="sticky bottom-0 z-10 -mx-1 rounded-lg border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs font-semibold text-slate-500">
            <div>
              Required: category, title, ZIP, scope, quality, detailed answers,
              material preferences and every required photo.
            </div>

            {briefCategory && (
              <div className="mt-1">
                Questions: {answeredRequiredQuestionCount}/{requiredQuestionCount} ·
                Photos: {uploadedRequiredPhotoCount}/{requiredPhotoCount} ·
                Materials: {completedMaterialCount}/{materialCount}
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.back()}
              disabled={submitting}
            >
              Cancel
            </Button>

            <Button type="submit" disabled={!canSubmit} size="lg">
              {submitting ? 'Posting...' : 'Post complete brief'}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}

function QuestionField({
  question,
  value,
  onChange,
  onToggleMulti,
}: {
  question: ProjectBriefQuestion;
  value: AnswerValue;
  onChange: (value: AnswerValue) => void;
  onToggleMulti: (option: string) => void;
}) {
  if (question.type === 'textarea') {
    return (
      <Textarea
        label={requiredLabel(question.label, question.required)}
        required={question.required}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
        hint={question.helpText}
      />
    );
  }

  if (question.type === 'text') {
    return (
      <Input
        label={requiredLabel(question.label, question.required)}
        required={question.required}
        value={typeof value === 'string' ? value : ''}
        onChange={(event) => onChange(event.target.value)}
        hint={question.helpText}
      />
    );
  }

  if (question.type === 'number') {
    return (
      <Input
        label={requiredLabel(question.label, question.required)}
        required={question.required}
        type="number"
        min={0}
        value={typeof value === 'number' || typeof value === 'string' ? value : ''}
        onChange={(event) =>
          onChange(event.target.value ? Number(event.target.value) : null)
        }
        hint={question.helpText}
      />
    );
  }

  if (question.type === 'single_select' || question.type === 'yes_no') {
    const options =
      question.type === 'yes_no'
        ? ['Yes', 'No', 'Not sure']
        : question.options ?? [];

    return (
      <div>
        <label className="mb-2 block text-sm font-bold text-ink-700">
          {requiredLabel(question.label, question.required)}
        </label>

        {question.helpText && (
          <p className="mb-2 text-xs leading-5 text-slate-500">
            {question.helpText}
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {options.map((option) => {
            const active = value === option;

            return (
              <button
                key={option}
                type="button"
                onClick={() => onChange(option)}
                className={cn(
                  'rounded-lg border px-4 py-3 text-left text-sm font-bold transition',
                  active
                    ? 'border-orange-300 bg-orange-50 text-orange-950 ring-4 ring-orange-100'
                    : 'border-slate-200 bg-white text-ink-800 hover:bg-slate-50',
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (question.type === 'multi_select') {
    const currentArray = Array.isArray(value) ? value : [];

    return (
      <div>
        <label className="mb-2 block text-sm font-bold text-ink-700">
          {requiredLabel(question.label, question.required)}
        </label>

        {question.helpText && (
          <p className="mb-2 text-xs leading-5 text-slate-500">
            {question.helpText}
          </p>
        )}

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(question.options ?? []).map((option) => {
            const active = currentArray.includes(option);

            return (
              <button
                key={option}
                type="button"
                onClick={() => onToggleMulti(option)}
                className={cn(
                  'rounded-lg border px-4 py-3 text-left text-sm font-bold transition',
                  active
                    ? 'border-orange-300 bg-orange-50 text-orange-950 ring-4 ring-orange-100'
                    : 'border-slate-200 bg-white text-ink-800 hover:bg-slate-50',
                )}
              >
                {active ? '✓ ' : ''}
                {option}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

function SectionTitle({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#061b3a] text-xs font-black text-white">
        {step}
      </div>

      <div>
        <h2 className="text-base font-black text-ink-900">
          {title}
        </h2>

        <p className="mt-0.5 text-sm leading-6 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

function BreakdownPill({
  label,
  amount,
}: {
  label: string;
  amount: number;
}) {
  return (
    <div className="rounded-lg border border-orange-100 bg-white px-3 py-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-slate-500">
        {label}
      </div>

      <div className="mt-1 text-sm font-black text-ink-900">
        {formatCurrency(amount)}
      </div>
    </div>
  );
}

function isAnswerFilled(value: AnswerValue | undefined) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return !Number.isNaN(value);
  if (typeof value === 'boolean') return true;
  return false;
}

function isMaterialComplete(value?: MaterialFormValue) {
  if (!value) return false;

  const hasQuality = value.preferred_quality.trim().length > 0;
  const hasMaterial =
    value.preferred_material.trim().length > 0 ||
    value.custom_note.trim().length > 0;

  return hasQuality && hasMaterial;
}

function stringOrNull(value: AnswerValue | undefined) {
  if (typeof value !== 'string') return null;
  const clean = value.trim();
  return clean || null;
}

function requiredLabel(label: string, required: boolean) {
  return required ? `${label} *` : label;
}

function buildMaterialSummary(values: Record<string, MaterialFormValue>) {
  const lines = Object.values(values)
    .filter((value) => isMaterialComplete(value))
    .map((value) => {
      const parts = [
        value.preferred_material,
        value.preferred_quality,
        value.preferred_brand,
        value.custom_note,
      ].filter(Boolean);

      return parts.join(' · ');
    });

  return lines.length > 0 ? lines.join('\n') : null;
}
