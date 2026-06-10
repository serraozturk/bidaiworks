/**
 * Marketplace fee + window constants.
 *
 * Single source of truth so the contractor commitment fee, the homeowner
 * protection hold and the payment / commitment deadlines stay consistent
 * across the UI, the checkout API and the contractor-commit API.
 */

/** Contractor commitment fee, charged when a contractor claims a paid job. */
export const COMMITMENT_FEE_PCT = 0.08;

/** Flat protection hold added to the homeowner checkout total. */
export const PROTECTION_HOLD_AMOUNT = 300;

/** Minutes a homeowner has to pay after accepting an offer. */
export const HOMEOWNER_PAYMENT_WINDOW_MINUTES = 60;

/** Hours a contractor has to pay the commitment fee after the homeowner pays. */
export const CONTRACTOR_COMMIT_WINDOW_HOURS = 48;

function toNumber(value: number | string | null | undefined): number {
  const n = typeof value === 'string' ? Number(value) : value ?? 0;
  return Number.isFinite(n) ? Number(n) : 0;
}

/** 8% commitment fee for a given project / offer amount, rounded to cents. */
export function commitmentFee(projectAmount: number | string | null | undefined): number {
  const amount = toNumber(projectAmount);
  if (amount <= 0) return 0;
  return Math.round(amount * COMMITMENT_FEE_PCT * 100) / 100;
}

/** Net escrow payout to the contractor after the commitment fee. */
export function contractorPayout(projectAmount: number | string | null | undefined): number {
  const amount = toNumber(projectAmount);
  return Math.max(0, amount);
}
