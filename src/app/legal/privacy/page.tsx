import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-10 text-slate-900">
      <article className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-wide text-[#f45112]">
          Legal
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          Privacy Policy and KVKK/GDPR Notice
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Last updated: May 25, 2026. This is a practical placeholder for
          privacy disclosures and consent. Have it reviewed before public
          launch.
        </p>

        <div className="mt-6 space-y-5 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-black text-slate-900">Data we collect</h2>
            <p>
              bidAI may collect account details, contact information, project
              descriptions, photos, service areas, contractor profile details,
              offers, messages, payment status, support reports, dispute
              records, device/session metadata, and audit logs.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900">Why we use data</h2>
            <p>
              We use this data to create accounts, match projects with
              contractors, calculate estimates, show offers, process marketplace
              workflows, prevent fraud, provide support, resolve disputes,
              improve safety, and send transactional notifications.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900">Legal basis and consent</h2>
            <p>
              For KVKK/GDPR purposes, processing may be based on user consent,
              contract performance, legitimate interest, legal obligations, and
              fraud prevention. Users can request access, correction, deletion,
              restriction, portability, or objection where applicable.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900">Sharing</h2>
            <p>
              Project and offer data may be shared between the homeowner,
              matched contractors, payment providers, infrastructure providers,
              support staff, and administrators when needed for the marketplace
              workflow. Direct contact details may remain hidden until the deal
              reaches the required payment and commitment stage.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900">Retention and security</h2>
            <p>
              Records are kept as long as needed for account operation,
              financial records, dispute handling, legal compliance, and safety.
              bidAI uses role-based access controls, Supabase row-level
              security, audit logs, and account security controls to protect
              user data.
            </p>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black hover:bg-slate-50">
            ← Home
          </Link>
          <Link href="/legal/terms" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black hover:bg-slate-50">
            Terms
          </Link>
          <Link href="/signup" className="rounded-xl bg-[#f45112] px-4 py-2 text-sm font-black text-white hover:bg-[#d94406]">
            Back to signup
          </Link>
        </div>
      </article>
    </main>
  );
}

