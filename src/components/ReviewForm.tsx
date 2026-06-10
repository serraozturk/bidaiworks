'use client';

import type React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';

interface Props {
  projectId: string;
  contractorId: string;
  contractorName: string;
  existingReview?: {
    id: string;
    rating: number;
    comment: string | null;
  } | null;
}

export default function ReviewForm({
  projectId,
  contractorId,
  contractorName,
  existingReview,
}: Props) {
  const router = useRouter();
  const supabase = createClient();

  const [rating, setRating] = useState<number>(existingReview?.rating ?? 0);
  const [hover, setHover] = useState<number>(0);
  const [comment, setComment] = useState<string>(existingReview?.comment ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (rating < 1 || rating > 5) {
      setError('Please pick a star rating.');
      return;
    }

    setBusy(true);
    setError(null);
    setSuccess(false);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError('You must be signed in to leave a review.');
      setBusy(false);
      return;
    }

    let dbError;

    if (existingReview?.id) {
      const { error } = await supabase
        .from('reviews')
        .update({
          rating,
          comment: comment.trim() || null,
        })
        .eq('id', existingReview.id);

      dbError = error;
    } else {
      const { error } = await supabase.from('reviews').insert({
        project_id: projectId,
        reviewer_id: user.id,
        contractor_id: contractorId,
        rating,
        comment: comment.trim() || null,
      });

      dbError = error;
    }

    setBusy(false);

    if (dbError) {
      setError(dbError.message);
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  const display = hover || rating;

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
        <p className="text-sm font-black text-slate-900">
          How was your experience with {contractorName}?
        </p>

        <p className="mt-1 text-xs leading-5 text-slate-500">
          Your review helps other homeowners choose reliable contractors.
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(star)}
              className={`text-3xl transition ${
                display >= star
                  ? 'text-amber-400'
                  : 'text-slate-300 hover:text-amber-300'
              }`}
              aria-label={`${star} star${star === 1 ? '' : 's'}`}
            >
              ★
            </button>
          ))}

          <span className="ml-3 text-sm font-bold text-slate-500">
            {display ? `${display} / 5` : 'Pick a rating'}
          </span>
        </div>
      </div>

      <label className="block">
        <span className="text-xs font-black uppercase tracking-wide text-slate-500">
          Tell other homeowners how it went
        </span>

        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          rows={4}
          placeholder="What went well? Was the timeline accurate? Was the final scope clear?"
          className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-orange-300 focus:outline-none focus:ring-2 focus:ring-orange-100"
        />
      </label>

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
          {error}
        </p>
      )}

      {success && (
        <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700">
          Thanks for the review.
        </p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving...' : existingReview ? 'Update review' : 'Submit review'}
        </Button>
      </div>
    </form>
  );
}