'use client';

/**
 * Generic, reusable filter toolbar used across admin list pages:
 * search box + status/category chips + optional date-range buttons +
 * optional sort dropdown. Each page owns its own filtering logic (useMemo
 * over its rows) and just renders this bar with controlled props.
 */

export interface ChipOption {
  value: string;
  label: string;
}

export type DateRangeValue = 'all' | '24h' | '7d' | '30d' | '90d';

export const DATE_RANGE_OPTIONS: { value: DateRangeValue; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '24h', label: 'Today' },
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

export function withinDateRange(iso: string | null | undefined, range: DateRangeValue): boolean {
  if (range === 'all') return true;
  if (!iso) return false;
  const date = new Date(iso).getTime();
  if (Number.isNaN(date)) return false;
  const now = Date.now();
  const days = range === '24h' ? 1 : range === '7d' ? 7 : range === '30d' ? 30 : 90;
  return now - date <= days * 24 * 60 * 60 * 1000;
}

interface FilterBarProps {
  search?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;

  chips?: ChipOption[];
  chipValue?: string;
  onChipChange?: (value: string) => void;

  dateRangeValue?: DateRangeValue;
  onDateRangeChange?: (value: DateRangeValue) => void;

  sortOptions?: ChipOption[];
  sortValue?: string;
  onSortChange?: (value: string) => void;

  resultCount?: number;
  resultLabel?: string;
}

export function FilterBar({
  search,
  onSearchChange,
  searchPlaceholder = 'Search...',
  chips,
  chipValue,
  onChipChange,
  dateRangeValue,
  onDateRangeChange,
  sortOptions,
  sortValue,
  onSortChange,
  resultCount,
  resultLabel = 'results',
}: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-4 py-3">
      {typeof resultCount === 'number' && (
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
          {resultCount} {resultLabel}
        </span>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {onSearchChange && (
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={search ?? ''}
            onChange={(e) => onSearchChange(e.target.value)}
            className="h-8 w-56 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 placeholder-slate-400 shadow-sm focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-400"
          />
        )}

        {chips && chips.length > 0 && onChipChange && (
          <div className="flex flex-wrap gap-1">
            {chips.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onChipChange(opt.value)}
                className={`h-8 rounded-lg px-3 text-xs font-black transition ${
                  chipValue === opt.value
                    ? 'bg-slate-900 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}

        {onDateRangeChange && (
          <select
            value={dateRangeValue ?? 'all'}
            onChange={(e) => onDateRangeChange(e.target.value as DateRangeValue)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 focus:border-orange-400 focus:outline-none"
          >
            {DATE_RANGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {sortOptions && sortOptions.length > 0 && onSortChange && (
          <select
            value={sortValue}
            onChange={(e) => onSortChange(e.target.value)}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-bold text-slate-600 focus:border-orange-400 focus:outline-none"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
