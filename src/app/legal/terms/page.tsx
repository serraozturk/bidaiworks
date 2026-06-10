import Link from 'next/link';

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f8fafc] px-4 py-10 text-slate-900">
      <article className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-black uppercase tracking-wide text-[#f45112]">
          Legal
        </p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Last updated: May 25, 2026. This page is a launch-ready placeholder
          for bidAI marketplace rules and should be reviewed by counsel before
          public launch.
        </p>

        <div className="mt-6 space-y-5 text-sm leading-7 text-slate-700">
          <section>
            <h2 className="text-lg font-black text-slate-900">Marketplace role</h2>
            <p>
              bidAI connects homeowners and contractors. Contractors are
              independent service providers, not employees or agents of bidAI.
              Users are responsible for the accuracy of the information,
              offers, licenses, insurance details, and project details they
              submit.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900">Payments and fees</h2>
            <p>
              Homeowner payments are recorded in bidAI checkout and held under
              the platform payment flow until project completion, cancellation,
              refund, or dispute resolution. After the homeowner pays, the
              selected contractor must confirm the job by paying the contractor
              commitment fee. The current commitment fee is 8% of the accepted
              offer amount.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900">Off-platform contact</h2>
            <p>
              Before checkout and contractor commitment are complete, users must
              keep negotiation inside bidAI. Sharing direct contact details,
              external payment links, or attempting to move a deal off-platform
              may lead to account suspension.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900">Disputes</h2>
            <p>
              Users may report problems or raise disputes through bidAI. bidAI
              may review project details, offers, messages, payments, and user
              history to decide whether to release funds, issue a refund,
              dismiss the dispute, or take account action.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black text-slate-900">Legal review</h2>
            <p>
              These terms are not legal advice. Before accepting real payments
              or launching publicly, replace this placeholder with terms
              reviewed for your operating countries, states, tax obligations,
              consumer protection rules, and contractor licensing rules.
            </p>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black hover:bg-slate-50">
            ← Home
          </Link>
          <Link href="/legal/privacy" className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black hover:bg-slate-50">
            Privacy Policy
          </Link>
          <Link href="/signup" className="rounded-xl bg-[#f45112] px-4 py-2 text-sm font-black text-white hover:bg-[#d94406]">
            Back to signup
          </Link>
        </div>
      </article>
    </main>
  );
}

