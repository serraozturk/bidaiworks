'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils';

interface Props {
  availableAmount: number;
  completedJobs: number;
}

export default function WithdrawCard({ availableAmount, completedJobs }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const [bankName, setBankName] = useState('');
  const [routing, setRouting] = useState('');
  const [account, setAccount] = useState('');
  const [amount, setAmount] = useState(String(availableAmount));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const numericAmount = Number(amount);
  const valid = numericAmount > 0 && numericAmount <= availableAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (availableAmount <= 0) { setError('No funds available to withdraw yet.'); return; }
    if (!bankName.trim() || routing.length < 8 || account.length < 6) {
      setError('Enter your bank name, routing, and account number to continue.'); return;
    }
    if (!valid) { setError(`Enter an amount between $1 and ${formatCurrency(availableAmount)}.`); return; }
    setBusy(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setBusy(false); setError('Sign in required to withdraw.'); return; }
    const { error: insertError } = await supabase.from('withdrawals').insert({
      contractor_id: user.id, amount: numericAmount, status: 'completed',
      bank_name: bankName.trim(), routing_last4: routing.slice(-4), account_last4: account.slice(-4),
      completed_at: new Date().toISOString(),
    });
    setBusy(false);
    if (insertError) { setError(insertError.message); return; }
    setConfirmed(true);
    router.refresh();
  }

  return (
    <aside className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-8 lg:self-start">
      <h2 className="text-lg font-black">Withdraw to bank</h2>
      <p className="mt-1 text-xs text-slate-500">
        Funds are released after the homeowner marks the project complete. ACH transfers usually clear in 2-3 business days.
      </p>
      {confirmed ? (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
          <div className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-emerald-500 text-white">OK</div>
          <h3 className="mt-3 text-base font-black text-emerald-900">Withdrawal recorded</h3>
          <p className="mt-1 text-xs text-emerald-800">{formatCurrency(numericAmount)} on the way to {bankName}.</p>
          <button type="button" onClick={() => { setConfirmed(false); setAmount(String(Math.max(0, availableAmount - numericAmount))); }}
            className="mt-3 text-xs font-bold text-emerald-700 hover:underline">Withdraw again</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-4 space-y-3">
          <label className="block">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Bank name</span>
            <input value={bankName} onChange={(e) => setBankName(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Chase, Wells Fargo, Bank of America..." />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Routing #</span>
              <input inputMode="numeric" value={routing} onChange={(e) => setRouting(e.target.value.replace(/\D/g, '').slice(0, 9))} maxLength={9}
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="123456789" />
            </label>
            <label className="block">
              <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Account #</span>
              <input inputMode="numeric" value={account} onChange={(e) => setAccount(e.target.value.replace(/\D/g, '').slice(0, 17))} maxLength={17}
                className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                placeholder="000123456789" />
            </label>
          </div>
          <label className="block">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-500">Amount</span>
            <input type="number" min={1} max={availableAmount} value={amount} onChange={(e) => setAmount(e.target.value)}
              className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500" />
          </label>
          <div className="rounded-xl bg-slate-50 p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-500">Available</span>
              <span className="font-black text-slate-900">{formatCurrency(availableAmount)}</span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="font-bold text-slate-500">Completed jobs</span>
              <span className="font-black text-slate-900">{completedJobs}</span>
            </div>
          </div>
          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{error}</p>}
          <Button type="submit" disabled={busy || availableAmount <= 0} className="w-full">
            {busy ? 'Processing...' : `Withdraw ${formatCurrency(Math.min(numericAmount || 0, availableAmount))}`}
          </Button>
          {availableAmount <= 0 && (
            <p className="rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-bold text-amber-800">
              No funds available yet. The homeowner must mark a project complete first.
            </p>
          )}
        </form>
      )}
    </aside>
  );
}
