import { Suspense } from 'react';
import SignupClient from './signup-client';

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-16 text-sm text-slate-500">
          Loading…
        </div>
      }
    >
      <SignupClient />
    </Suspense>
  );
}