import { Suspense } from 'react';
import LoginClient from './login-client';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-16 text-sm text-slate-500">
          Loading…
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}