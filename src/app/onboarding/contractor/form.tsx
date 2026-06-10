'use client';

import type React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Category } from '@/lib/types';
import { COMMITMENT_FEE_PCT } from '@/lib/fees';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Card, CardBody } from '@/components/ui/Card';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

const EMPLOYEE_RANGES = [
  'Solo operator',
  '2–5 employees',
  '6–15 employees',
  '16–50 employees',
  '51+ employees',
];

interface Props {
  categories: Category[];
}

export default function ContractorOnboardingForm({ categories }: Props) {
  const router = useRouter();
  const supabase = createClient();

  // Company identity
  const [companyName, setCompanyName] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [bio, setBio] = useState('');
  const [years, setYears] = useState('');
  const [employeeCount, setEmployeeCount] = useState('');

  // Business address
  const [addressLine, setAddressLine] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zip, setZip] = useState('');

  // License & insurance
  const [licenseNumber, setLicenseNumber] = useState('');
  const [licenseState, setLicenseState] = useState('');
  const [insuranceExpiry, setInsuranceExpiry] = useState('');

  // Service area & categories
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());
  const [zipsRaw, setZipsRaw] = useState('');

  // Legal
  const [marketplaceAccepted, setMarketplaceAccepted] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function toggleCat(id: string) {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validate service area ZIPs
    const zips = Array.from(
      new Set(
        zipsRaw
          .split(/[\s,]+/)
          .map((z) => z.trim())
          .filter(Boolean),
      ),
    );

    if (!companyName.trim()) {
      setError('Company name is required.');
      setLoading(false);
      return;
    }

    if (!phone.trim()) {
      setError('Business phone number is required.');
      setLoading(false);
      return;
    }

    if (!addressLine.trim() || !city.trim() || !state || !zip.trim()) {
      setError('Full business address (street, city, state, ZIP) is required.');
      setLoading(false);
      return;
    }

    if (!/^\d{5}$/.test(zip.trim())) {
      setError('Business ZIP code must be 5 digits.');
      setLoading(false);
      return;
    }

    if (!licenseNumber.trim()) {
      setError('State contractor license number is required.');
      setLoading(false);
      return;
    }

    if (!licenseState) {
      setError('Please select the state your license is issued in.');
      setLoading(false);
      return;
    }

    if (!insuranceExpiry) {
      setError('Insurance expiry date is required.');
      setLoading(false);
      return;
    }

    if (new Date(insuranceExpiry) < new Date()) {
      setError('Insurance must not be expired. Please provide a valid expiry date.');
      setLoading(false);
      return;
    }

    if (!years) {
      setError('Years in business is required.');
      setLoading(false);
      return;
    }

    if (!employeeCount) {
      setError('Please select your company size.');
      setLoading(false);
      return;
    }

    if (selectedCats.size === 0) {
      setError('Pick at least one service category.');
      setLoading(false);
      return;
    }

    if (zips.length === 0) {
      setError('Add at least one service-area ZIP code.');
      setLoading(false);
      return;
    }

    if (!zips.every((z) => /^\d{5}$/.test(z))) {
      setError('All service-area ZIP codes must be 5 digits.');
      setLoading(false);
      return;
    }

    if (!marketplaceAccepted) {
      setError('Please accept the contractor marketplace and legal terms.');
      setLoading(false);
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('Not signed in.');
      setLoading(false);
      return;
    }

    await supabase.from('profiles').update({ role: 'contractor' }).eq('id', user.id);

    const { error: cpErr } = await supabase.from('contractor_profiles').upsert({
      user_id: user.id,
      company_name: companyName.trim(),
      phone: phone.trim(),
      website: website.trim() || null,
      bio: bio.trim() || null,
      years_in_business: years ? Number(years) : null,
      employee_count: employeeCount || null,
      address_line: addressLine.trim(),
      city: city.trim(),
      state: state,
      zip_code: zip.trim(),
      license_number: licenseNumber.trim(),
      license_state: licenseState,
      insurance_expires_at: insuranceExpiry || null,
      verification_status: 'pending_verification',
    });

    if (cpErr) {
      setError(cpErr.message);
      setLoading(false);
      return;
    }

    await supabase.from('contractor_categories').delete().eq('contractor_id', user.id);

    const catRows = Array.from(selectedCats).map((category_id) => ({
      contractor_id: user.id,
      category_id,
    }));

    const { error: catErr } = await supabase.from('contractor_categories').insert(catRows);

    if (catErr) {
      setError(catErr.message);
      setLoading(false);
      return;
    }

    await supabase.from('contractor_service_areas').delete().eq('contractor_id', user.id);

    const zipRows = zips.map((zip_code) => ({ contractor_id: user.id, zip_code }));

    const { error: zErr } = await supabase.from('contractor_service_areas').insert(zipRows);

    if (zErr) {
      setError(zErr.message);
      setLoading(false);
      return;
    }

    router.push('/dashboard/contractor');
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* ── Company identity ── */}
      <Card>
        <CardBody className="space-y-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">Company details</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              This information is reviewed by our team before your account is activated.
              Contact details are kept private from homeowners until a deal is made.
            </p>
          </div>

          <Input
            label="Company name"
            required
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Acme Renovations LLC"
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Business phone"
              required
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />

            <Input
              label="Company website"
              type="url"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://yourcompany.com"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="block text-sm font-black text-slate-700">
                Years in business <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min={0}
                max={100}
                required
                value={years}
                onChange={(e) => setYears(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-[#f45112] focus:outline-none focus:ring-1 focus:ring-[#f45112]"
                placeholder="e.g. 8"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-sm font-black text-slate-700">
                Company size <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={employeeCount}
                onChange={(e) => setEmployeeCount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-[#f45112] focus:outline-none focus:ring-1 focus:ring-[#f45112]"
              >
                <option value="">Select size</option>
                {EMPLOYEE_RANGES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
          </div>

          <Textarea
            label="Short company bio"
            placeholder="Briefly explain your services, experience, and what homeowners can expect."
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </CardBody>
      </Card>

      {/* ── Business address ── */}
      <Card>
        <CardBody className="space-y-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">Business address</h2>
            <p className="mt-1 text-sm text-slate-500">
              Your physical business address in the United States. Required for verification.
            </p>
          </div>

          <Input
            label="Street address"
            required
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            placeholder="123 Main St, Suite 100"
          />

          <div className="grid gap-3 sm:grid-cols-3">
            <Input
              label="City"
              required
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="San Francisco"
            />

            <div className="space-y-1">
              <label className="block text-sm font-black text-slate-700">
                State <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-[#f45112] focus:outline-none focus:ring-1 focus:ring-[#f45112]"
              >
                <option value="">State</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <Input
              label="ZIP code"
              required
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="94110"
              maxLength={5}
            />
          </div>
        </CardBody>
      </Card>

      {/* ── License & insurance ── */}
      <Card>
        <CardBody className="space-y-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">License & insurance</h2>
            <p className="mt-1 text-sm text-slate-500">
              Required for verification. Your license number is used to confirm you are a
              licensed contractor in your state.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="State contractor license #"
              required
              value={licenseNumber}
              onChange={(e) => setLicenseNumber(e.target.value)}
              placeholder="e.g. CASL-123456"
            />

            <div className="space-y-1">
              <label className="block text-sm font-black text-slate-700">
                License state <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={licenseState}
                onChange={(e) => setLicenseState(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-[#f45112] focus:outline-none focus:ring-1 focus:ring-[#f45112]"
              >
                <option value="">Select state</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="block text-sm font-black text-slate-700">
              Liability insurance expiry date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={insuranceExpiry}
              onChange={(e) => setInsuranceExpiry(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-900 shadow-sm focus:border-[#f45112] focus:outline-none focus:ring-1 focus:ring-[#f45112]"
            />
            <p className="text-xs text-slate-400">Your insurance must be active and not expired.</p>
          </div>
        </CardBody>
      </Card>

      {/* ── Service categories ── */}
      <Card>
        <CardBody className="space-y-3">
          <div>
            <h3 className="text-lg font-black text-slate-900">Service categories</h3>
            <p className="mt-1 text-sm text-slate-500">
              Pick every category you want to receive matched leads for.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {categories.map((category) => {
              const active = selectedCats.has(category.id);
              return (
                <button
                  type="button"
                  key={category.id}
                  onClick={() => toggleCat(category.id)}
                  className={[
                    'rounded-xl border px-3 py-2 text-left text-sm font-bold transition',
                    active
                      ? 'border-orange-300 bg-orange-50 text-[#c94106]'
                      : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        </CardBody>
      </Card>

      {/* ── Service area ZIPs ── */}
      <Card>
        <CardBody className="space-y-3">
          <div>
            <h3 className="text-lg font-black text-slate-900">Service area ZIP codes</h3>
            <p className="mt-1 text-sm text-slate-500">
              Add the ZIP codes where you want to receive project matches.
              Separate with commas or spaces.
            </p>
          </div>

          <Textarea
            value={zipsRaw}
            onChange={(e) => setZipsRaw(e.target.value)}
            placeholder="94110, 94114, 94117"
          />
        </CardBody>
      </Card>

      {/* ── Legal acceptance ── */}
      <Card>
        <CardBody>
          <label className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={marketplaceAccepted}
              onChange={(e) => setMarketplaceAccepted(e.target.checked)}
              className="mt-1 h-4 w-4 accent-[#f45112]"
              required
            />
            <span className="text-sm leading-6 text-slate-600">
              I certify that the information provided is accurate, and I accept the contractor
              marketplace rules,{' '}
              <a href="/legal/terms" target="_blank" className="font-black text-[#f45112] hover:underline">
                Terms of Service
              </a>
              {' '}and{' '}
              <a href="/legal/privacy" target="_blank" className="font-black text-[#f45112] hover:underline">
                Privacy Policy
              </a>
              . I understand that bidAI may charge a{' '}
              <strong className="font-black text-slate-900">{COMMITMENT_FEE_PCT}%</strong>{' '}
              commitment fee when I claim a paid job, and that my account requires admin
              verification before I can access project leads.
            </span>
          </label>
        </CardBody>
      </Card>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-sm leading-6 text-slate-500">
          After submitting, our team will review your application. You will be notified
          by email once your account is verified (typically within 1–2 business days).
        </p>

        <Button type="submit" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit application'}
        </Button>
      </div>
    </form>
  );
}
 