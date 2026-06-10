'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Category, ContractorProfile } from '@/lib/types';
import { Input, Textarea } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

interface Props {
  contractor: ContractorProfile | null;
  allCategories?: Category[];
  chosenCategoryIds?: string[];
  chosenZips?: string[];
}

export default function ProfileEditor({
  contractor,
  allCategories = [],
  chosenCategoryIds = [],
  chosenZips = [],
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [companyName, setCompanyName] = useState(
    contractor?.company_name ?? '',
  );

  const [licenseNumber, setLicenseNumber] = useState(
    contractor?.license_number ?? '',
  );

  const [years, setYears] = useState(
    contractor?.years_in_business?.toString() ?? '',
  );

  const [bio, setBio] = useState(contractor?.bio ?? '');
  const [website, setWebsite] = useState(contractor?.website ?? '');

  const [cats, setCats] = useState<Set<string>>(
    () => new Set(chosenCategoryIds),
  );

  const [zipsRaw, setZipsRaw] = useState(() => chosenZips.join(', '));

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  const normalizedZips = useMemo(() => {
    return Array.from(
      new Set(
        zipsRaw
          .split(/[\s,;]+/)
          .map((zip) => zip.trim())
          .filter(Boolean),
      ),
    );
  }, [zipsRaw]);

  const profileScore = useMemo(() => {
    let score = 0;

    if (companyName.trim()) score += 20;
    if (bio.trim()) score += bio.trim().length >= 80 ? 25 : 12;
    if (years && Number(years) > 0) score += 15;
    if (cats.size > 0) score += 20;
    if (normalizedZips.length > 0) score += 20;

    return Math.min(score, 100);
  }, [companyName, bio, years, cats.size, normalizedZips.length]);

  function toggleCat(id: string) {
    setCats((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setSuccess(false);
    setBusy(true);

    if (!contractor?.user_id) {
      setError('Contractor profile could not be loaded. Please refresh the page.');
      setBusy(false);
      return;
    }

    const cleanCompanyName = companyName.trim();
    const cleanBio = bio.trim();
    const cleanWebsite = website.trim();
    const cleanLicense = licenseNumber.trim();
    const cleanYears = years ? Number(years) : null;

    if (!cleanCompanyName) {
      setError('Company name is required.');
      setBusy(false);
      return;
    }

    if (cleanYears !== null && (!Number.isFinite(cleanYears) || cleanYears < 0)) {
      setError('Years in business must be a valid positive number.');
      setBusy(false);
      return;
    }

    if (cleanWebsite && !isValidUrl(cleanWebsite)) {
      setError('Please enter a valid website URL, for example https://company.com.');
      setBusy(false);
      return;
    }

    if (cats.size === 0) {
      setError('Select at least one service category.');
      setBusy(false);
      return;
    }

    if (
      normalizedZips.length === 0 ||
      !normalizedZips.every((zip) => /^\d{5}$/.test(zip))
    ) {
      setError('Add at least one valid 5-digit ZIP code.');
      setBusy(false);
      return;
    }

    const { error: profileError } = await supabase
      .from('contractor_profiles')
      .update({
        company_name: cleanCompanyName,
        license_number: cleanLicense || null,
        years_in_business: cleanYears,
        bio: cleanBio || null,
        website: cleanWebsite || null,
      })
      .eq('user_id', contractor.user_id);

    if (profileError) {
      setError(profileError.message);
      setBusy(false);
      return;
    }

    const { error: deleteCategoriesError } = await supabase
      .from('contractor_categories')
      .delete()
      .eq('contractor_id', contractor.user_id);

    if (deleteCategoriesError) {
      setError(deleteCategoriesError.message);
      setBusy(false);
      return;
    }

    const selectedCategories = Array.from(cats);

    if (selectedCategories.length > 0) {
      const { error: insertCategoriesError } = await supabase
        .from('contractor_categories')
        .insert(
          selectedCategories.map((category_id) => ({
            contractor_id: contractor.user_id,
            category_id,
          })),
        );

      if (insertCategoriesError) {
        setError(insertCategoriesError.message);
        setBusy(false);
        return;
      }
    }

    const { error: deleteZipsError } = await supabase
      .from('contractor_service_areas')
      .delete()
      .eq('contractor_id', contractor.user_id);

    if (deleteZipsError) {
      setError(deleteZipsError.message);
      setBusy(false);
      return;
    }

    if (normalizedZips.length > 0) {
      const { error: insertZipsError } = await supabase
        .from('contractor_service_areas')
        .insert(
          normalizedZips.map((zip_code) => ({
            contractor_id: contractor.user_id,
            zip_code,
          })),
        );

      if (insertZipsError) {
        setError(insertZipsError.message);
        setBusy(false);
        return;
      }
    }

    setBusy(false);
    setSuccess(true);

    router.refresh();
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-wide text-slate-500">
              Profile strength
            </div>

            <div className="mt-1 text-2xl font-black text-[#0f172a]">
              {profileScore}%
            </div>
          </div>

          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-100 md:max-w-[360px]">
            <div
              className="h-full rounded-full bg-[#f4510b] transition-all"
              style={{ width: `${profileScore}%` }}
            />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader
          title="Company details"
          subtitle="These details appear on comparison pages, deal rooms and offers."
        />

        <div className="space-y-4 p-5">
          <Input
            label="Company name"
            required
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
          />

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              label="License number"
              value={licenseNumber}
              onChange={(event) => setLicenseNumber(event.target.value)}
            />

            <Input
              label="Years in business"
              type="number"
              min={0}
              value={years}
              onChange={(event) => setYears(event.target.value)}
            />
          </div>

          <Input
            label="Website"
            type="url"
            placeholder="https://yourcompany.com"
            value={website}
            onChange={(event) => setWebsite(event.target.value)}
          />

          <div>
            <Textarea
              label="Company bio"
              placeholder="Tell homeowners what you specialize in, how you work, and why they can trust your company."
              value={bio}
              onChange={(event) => setBio(event.target.value)}
            />

            <div className="mt-1 flex justify-between text-[11px] font-semibold text-slate-400">
              <span>Recommended: 80+ characters.</span>
              <span>{bio.trim().length} characters</span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader
          title="Service categories"
          subtitle="Choose the types of projects you want to receive."
          right={
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-black text-[#f4510b]">
              {cats.size} selected
            </span>
          }
        />

        <div className="grid gap-2 p-5 sm:grid-cols-2 xl:grid-cols-3">
          {allCategories.map((category) => {
            const active = cats.has(category.id);

            return (
              <button
                key={category.id}
                type="button"
                onClick={() => toggleCat(category.id)}
                className={[
                  'rounded-lg border p-3 text-left transition',
                  active
                    ? 'border-orange-300 bg-orange-50 ring-4 ring-orange-100'
                    : 'border-slate-200 bg-white hover:bg-slate-50',
                ].join(' ')}
              >
                <div
                  className={[
                    'text-sm font-black',
                    active ? 'text-orange-950' : 'text-[#0f172a]',
                  ].join(' ')}
                >
                  {category.name}
                </div>

                <div className="mt-1 text-xs font-semibold text-slate-500">
                  {active ? 'Included in your profile' : 'Click to add'}
                </div>
              </button>
            );
          })}

          {allCategories.length === 0 && (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-500">
              No service categories found.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <SectionHeader
          title="Service-area ZIP codes"
          subtitle="Add the ZIP codes where you can accept jobs."
          right={
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">
              {normalizedZips.length} areas
            </span>
          }
        />

        <div className="space-y-3 p-5">
          <Textarea
            value={zipsRaw}
            onChange={(event) => setZipsRaw(event.target.value)}
            placeholder="78701, 78702, 78703"
          />

          <p className="text-xs leading-5 text-slate-500">
            Use comma, space or line breaks. Every ZIP code must be 5 digits.
          </p>

          {normalizedZips.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {normalizedZips.slice(0, 24).map((zip) => (
                <span
                  key={zip}
                  className={[
                    'rounded-full px-2.5 py-1 text-[11px] font-black',
                    /^\d{5}$/.test(zip)
                      ? 'bg-slate-100 text-slate-600'
                      : 'bg-red-100 text-red-700',
                  ].join(' ')}
                >
                  {zip}
                </span>
              ))}

              {normalizedZips.length > 24 && (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500">
                  +{normalizedZips.length - 24} more
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">
          Profile saved.
        </div>
      )}

      <div className="sticky bottom-0 rounded-lg border border-slate-200 bg-white/90 p-3 shadow-lg backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold text-slate-500">
            Homeowners see these details before accepting your offer.
          </p>

          <Button type="submit" disabled={busy} size="lg">
            {busy ? 'Saving...' : 'Save changes'}
          </Button>
        </div>
      </div>
    </form>
  );
}

function SectionHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
      <div>
        <h2 className="text-sm font-black text-[#0f172a]">{title}</h2>

        <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
      </div>

      {right}
    </div>
  );
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}