'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { MakeOfferButton } from '@/components/MakeOfferButton';

export interface BudgetProject {
  id: string;
  title: string | null;
}

interface BudgetRequestFlowProps {
  projects: BudgetProject[];
  contractorId: string;
  contractorCompany: string;
  contractorRating?: number | null;
  contractorReviewCount?: number | null;
  contractorVerified?: boolean | null;
  contractorBio?: string | null;
  className?: string;
}

/**
 * Handles the full "Send Budget Request" flow from the contractor browse page.
 *
 * - 0 projects → "Create a project first" link
 * - 1 project  → opens offer modal immediately
 * - 2+ projects → shows project picker first, then offer modal
 */
export function BudgetRequestFlow({
  projects,
  contractorId,
  contractorCompany,
  contractorRating,
  contractorReviewCount,
  contractorVerified,
  contractorBio,
  className,
}: BudgetRequestFlowProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<BudgetProject | null>(null);

  const btnClass =
    className ??
    'inline-flex h-9 w-full items-center justify-center rounded-lg bg-[#f45112] px-3 text-xs font-semibold text-white hover:bg-[#d94406]';

  // No projects yet
  if (projects.length === 0) {
    return (
      <Link
        href="/dashboard/homeowner/new"
        className={btnClass}
      >
        Create a project first
      </Link>
    );
  }

  // Project has been selected — render MakeOfferButton that opens immediately
  if (selectedProject) {
    return (
      <MakeOfferButton
        projectId={selectedProject.id}
        projectTitle={selectedProject.title}
        contractorId={contractorId}
        contractorCompany={contractorCompany}
        contractorRating={contractorRating}
        contractorReviewCount={contractorReviewCount}
        contractorVerified={contractorVerified}
        contractorBio={contractorBio}
        label="Send Budget Request"
        initialOpen
        className={btnClass}
      />
    );
  }

  const handleClick = () => {
    if (projects.length === 1) {
      setSelectedProject(projects[0]);
    } else {
      setPickerOpen(true);
    }
  };

  return (
    <>
      <button type="button" onClick={handleClick} className={btnClass}>
        Send Budget Request
      </button>

      {pickerOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={(e) => {
              if (e.target === e.currentTarget) setPickerOpen(false);
            }}
          >
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <h2 className="text-base font-black text-slate-900">
                Which project?
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Select the project you want to send this budget request for.
              </p>

              <ul className="mt-4 space-y-2">
                {projects.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPickerOpen(false);
                        setSelectedProject(p);
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-bold text-slate-900 transition hover:border-orange-300 hover:bg-orange-50"
                    >
                      {p.title ?? 'Untitled project'}
                    </button>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={() => setPickerOpen(false)}
                className="mt-4 w-full rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
