'use client';

import { usePathname } from 'next/navigation';
import { LogoutButton } from '@/components/LogoutButton';

interface Props {
  verificationStatus: string;
  rejectionReason: string | null;
  children: React.ReactNode;
}

/**
 * Client-side gate rendered by the contractor layout.
 * Verified contractors always see children.
 * Non-verified contractors can still access /dashboard/contractor/profile
 * so they can update their details and resubmit — all other routes show
 * the appropriate pending / rejected / suspended screen.
 */
export default function VerificationGate({
  verificationStatus,
  rejectionReason,
  children,
}: Props) {
  const pathname = usePathname();

  // Profile page is always accessible so contractors can fix their details.
  const isProfilePage = pathname === '/dashboard/contractor/profile';

  if (verificationStatus === 'verified' || isProfilePage) {
    return <>{children}</>;
  }

  const isRejected = verificationStatus === 'rejected';
  const isSuspended = verificationStatus === 'suspended';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#f8fafc] px-4 py-16 text-center">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 shadow-md">
        {!isRejected && !isSuspended && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-2xl">
              ⏳
            </div>
            <h1 className="text-2xl font-black text-slate-900">
              Application under review
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Thank you for applying! Our team is reviewing your contractor
              application. You will receive an email once your account is
              verified — typically within{' '}
              <strong className="font-bold text-slate-700">
                1–2 business days
              </strong>
              .
            </p>
            <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-left text-sm text-amber-800">
              <strong className="font-black">What happens next?</strong>
              <ul className="mt-1 list-disc pl-4 text-xs leading-5">
                <li>Our team verifies your license and insurance</li>
                <li>You&apos;ll receive an email notification when approved</li>
                <li>
                  Once verified, you&apos;ll have full access to project leads
                  and your dashboard
                </li>
              </ul>
            </div>
            <a
              href="/dashboard/contractor/profile"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-amber-300 bg-amber-50 px-4 text-sm font-black text-amber-800 transition hover:bg-amber-100"
            >
              Update your profile
            </a>
          </>
        )}

        {isRejected && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-2xl">
              ✗
            </div>
            <h1 className="text-2xl font-black text-slate-900">
              Application not approved
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Unfortunately your contractor application was not approved at this
              time.
            </p>
            {rejectionReason && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700">
                <strong className="font-black">Reason: </strong>
                {rejectionReason}
              </div>
            )}
            <p className="mt-4 text-sm text-slate-500">
              You can update your profile and re-apply, or contact us if you
              believe this is an error.
            </p>
            <a
              href="/dashboard/contractor/profile"
              className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-black text-red-700 transition hover:bg-red-100"
            >
              Update your profile
            </a>
          </>
        )}

        {isSuspended && (
          <>
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-2xl">
              ⚠️
            </div>
            <h1 className="text-2xl font-black text-slate-900">
              Account suspended
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Your contractor account has been suspended.
              {rejectionReason ? ` Reason: ${rejectionReason}` : ''}
            </p>
          </>
        )}

        <p className="mt-4 text-sm text-slate-400">
          Questions? Contact us at{' '}
          <a
            href="mailto:support@bidai.com"
            className="font-bold text-[#f45112] hover:underline"
          >
            support@bidai.com
          </a>
        </p>
        <div className="mt-6 flex justify-center border-t border-slate-100 pt-4">
          <LogoutButton />
        </div>
      </div>
    </div>
  );
}
