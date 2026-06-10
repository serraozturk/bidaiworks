import { createAdminClient } from '@/lib/supabase/admin';
import type { ReactNode } from 'react';
import { AdminPageHeader, EmptyRow, Panel, Pill } from '@/components/admin/ui';
import {
  addCategoryMaterialField,
  addCategoryPhotoRequirement,
  addCategoryQuestion,
  deactivateCategoryBriefItem,
  upsertCategory,
} from '@/app/admin/actions';

export const dynamic = 'force-dynamic';

const QUESTION_TYPES = ['text', 'textarea', 'single_select', 'multi_select', 'number', 'yes_no'];

export default async function AdminCategoriesPage() {
  const db = createAdminClient();
  const [{ data: categories }, { data: questions }, { data: photos }, { data: materials }] =
    await Promise.all([
      db.from('categories').select('*').order('sort_order', { ascending: true }),
      db
        .from('category_brief_questions')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      db
        .from('category_photo_requirements')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
      db
        .from('category_material_fields')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true }),
    ]);

  const categoryRows = (categories ?? []) as any[];
  const questionRows = (questions ?? []) as any[];
  const photoRows = (photos ?? []) as any[];
  const materialRows = (materials ?? []) as any[];

  return (
    <div>
      <AdminPageHeader
        eyebrow="Brief builder"
        title="Categories & dynamic project questions"
        description="Manage the detailed intake brief homeowners must complete before contractors send offers."
      />

      <div className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <Panel title="Create / update category" description="Add new services without code changes.">
          <form action={upsertCategory} className="space-y-3 p-4">
            <input type="hidden" name="active" value="true" />
            <Field label="Name" name="name" placeholder="Kitchen Remodel" required />
            <Field label="Slug" name="slug" placeholder="kitchen-remodel" />
            <Field label="Icon" name="icon" placeholder="Hammer" />
            <Field label="Sort order" name="sort_order" type="number" placeholder="10" />
            <Field label="Commission rate %" name="commission_rate" type="number" placeholder="8" />
            <TextField
              label="Description"
              name="description"
              placeholder="Short customer-facing category description."
            />
            <button className="h-10 w-full rounded-lg bg-[#f45112] px-4 text-sm font-black text-white transition hover:bg-[#d94406]">
              Save category
            </button>
          </form>
        </Panel>

        <Panel
          title="Configured categories"
          description="Questions, photos and materials shown in the homeowner project form."
        >
          {categoryRows.length === 0 ? (
            <EmptyRow>No categories found.</EmptyRow>
          ) : (
            <div className="divide-y divide-slate-100">
              {categoryRows.map((category) => {
                const categoryQuestions = questionRows.filter((q) => q.category_id === category.id);
                const categoryPhotos = photoRows.filter((p) => p.category_id === category.id);
                const categoryMaterials = materialRows.filter((m) => m.category_id === category.id);

                return (
                  <section key={category.id} className="p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-base font-black text-slate-900">{category.name}</h2>
                          <Pill value={category.active === false ? 'inactive' : 'active'} />
                        </div>
                        <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">
                          {category.description ?? 'No description yet.'}
                        </p>
                        <div className="mt-2 text-[11px] font-bold text-slate-400">
                          {category.slug} · Sort {category.sort_order ?? 0} · Commission{' '}
                          {category.commission_rate ?? 'default'}%
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-black text-slate-500">
                        <Metric value={categoryQuestions.length} label="Questions" />
                        <Metric value={categoryPhotos.length} label="Photos" />
                        <Metric value={categoryMaterials.length} label="Materials" />
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-3">
                      <BriefList
                        title="Questions"
                        rows={categoryQuestions}
                        table="category_brief_questions"
                        empty="No admin questions yet; form will use code fallback."
                        render={(row) => (
                          <>
                            <div className="font-black text-slate-900">{row.label}</div>
                            <div className="mt-1 text-[11px] text-slate-500">
                              {row.type} · {row.required ? 'Required' : 'Optional'} · {row.question_key}
                            </div>
                          </>
                        )}
                      />
                      <BriefList
                        title="Required photos"
                        rows={categoryPhotos}
                        table="category_photo_requirements"
                        empty="No admin photo rules yet; form will use code fallback."
                        render={(row) => (
                          <>
                            <div className="font-black text-slate-900">{row.label}</div>
                            <div className="mt-1 text-[11px] text-slate-500">
                              {row.required ? 'Required' : 'Optional'} · {row.photo_key}
                            </div>
                          </>
                        )}
                      />
                      <BriefList
                        title="Materials"
                        rows={categoryMaterials}
                        table="category_material_fields"
                        empty="No admin material fields yet; form will use code fallback."
                        render={(row) => (
                          <>
                            <div className="font-black text-slate-900">{row.label}</div>
                            <div className="mt-1 text-[11px] text-slate-500">
                              {row.item_key} · {row.allow_custom ? 'Custom allowed' : 'Fixed options'}
                            </div>
                          </>
                        )}
                      />
                    </div>

                    <div className="mt-4 grid gap-4 xl:grid-cols-3">
                      <QuestionForm categoryId={category.id} />
                      <PhotoForm categoryId={category.id} />
                      <MaterialForm categoryId={category.id} />
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
      <div className="text-lg font-black text-slate-900">{value}</div>
      <div>{label}</div>
    </div>
  );
}

function BriefList({
  title,
  rows,
  table,
  empty,
  render,
}: {
  title: string;
  rows: any[];
  table: string;
  empty: string;
  render: (row: any) => ReactNode;
}) {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">{title}</div>
      {rows.length === 0 ? (
        <p className="text-xs leading-5 text-slate-400">{empty}</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div key={row.id} className="rounded-lg border border-slate-200 bg-white p-3 text-xs">
              {render(row)}
              <form action={deactivateCategoryBriefItem} className="mt-2">
                <input type="hidden" name="table" value={table} />
                <input type="hidden" name="id" value={row.id} />
                <button className="text-[11px] font-black text-rose-600 hover:underline">
                  Deactivate
                </button>
              </form>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionForm({ categoryId }: { categoryId: string }) {
  return (
    <form action={addCategoryQuestion} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <input type="hidden" name="category_id" value={categoryId} />
      <div className="text-xs font-black uppercase tracking-wide text-orange-600">Add question</div>
      <Field label="Label" name="label" placeholder="What exactly needs to be repaired?" required />
      <Field label="Key" name="question_key" placeholder="repair_scope" />
      <label className="block text-xs font-bold text-slate-600">
        Type
        <select name="type" className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold">
          {QUESTION_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </label>
      <Toggle label="Required" name="required" />
      <Field label="Sort" name="sort_order" type="number" placeholder="100" />
      <TextField label="Options" name="options" placeholder="One option per line for select fields." />
      <TextField label="Help text" name="help_text" placeholder="Short guidance shown under the question." />
      <SaveButton />
    </form>
  );
}

function PhotoForm({ categoryId }: { categoryId: string }) {
  return (
    <form action={addCategoryPhotoRequirement} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <input type="hidden" name="category_id" value={categoryId} />
      <div className="text-xs font-black uppercase tracking-wide text-orange-600">Add photo</div>
      <Field label="Label" name="label" placeholder="Full room - left angle" required />
      <Field label="Key" name="photo_key" placeholder="full_room_left" />
      <Toggle label="Required" name="required" />
      <Field label="Sort" name="sort_order" type="number" placeholder="100" />
      <TextField label="Description" name="description" placeholder="Tell the homeowner exactly what to capture." />
      <SaveButton />
    </form>
  );
}

function MaterialForm({ categoryId }: { categoryId: string }) {
  return (
    <form action={addCategoryMaterialField} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <input type="hidden" name="category_id" value={categoryId} />
      <div className="text-xs font-black uppercase tracking-wide text-orange-600">Add material</div>
      <Field label="Label" name="label" placeholder="Flooring" required />
      <Field label="Key" name="item_key" placeholder="flooring" />
      <Toggle label="Allow custom" name="allow_custom" />
      <Field label="Sort" name="sort_order" type="number" placeholder="100" />
      <TextField label="Options" name="options" placeholder="Tile&#10;Vinyl plank&#10;Hardwood" />
      <TextField label="Quality levels" name="quality_levels" placeholder="Budget&#10;Standard&#10;Premium&#10;Luxury" />
      <SaveButton />
    </form>
  );
}

function Field({
  label,
  name,
  placeholder,
  type = 'text',
  required,
}: {
  label: string;
  name: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-xs font-bold text-slate-600">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-xs font-bold outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
      />
    </label>
  );
}

function TextField({
  label,
  name,
  placeholder,
}: {
  label: string;
  name: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-xs font-bold text-slate-600">
      {label}
      <textarea
        name={name}
        rows={3}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
      />
    </label>
  );
}

function Toggle({ label, name }: { label: string; name: string }) {
  return (
    <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
      <input type="hidden" name={name} value="false" />
      <input type="checkbox" name={name} value="true" defaultChecked className="accent-[#f4510b]" />
      {label}
    </label>
  );
}

function SaveButton() {
  return (
    <button className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50 text-xs font-black text-slate-900 transition hover:bg-slate-100">
      Save
    </button>
  );
}
