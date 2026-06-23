import type { createAdminClient } from '@/lib/supabase/admin';

type AdminDb = ReturnType<typeof createAdminClient>;

/**
 * Single source of truth for "pending review" counts used across the admin
 * overview, /admin/projects and /admin/contractors pages. Centralizing this
 * avoids the three pages computing the same number with subtly different
 * logic and drifting out of sync.
 */
export async function getPendingProjectsCount(db: AdminDb): Promise<number> {
  // Only count projects that are still open and haven't been moderated yet.
  // Projects that progressed past 'open' are already live — no review needed.
  const { count } = await db
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .or('moderation_status.eq.pending,moderation_status.is.null')
    .eq('status', 'open');
  return count ?? 0;
}

export async function getPendingContractorsCount(db: AdminDb): Promise<number> {
  const { count } = await db
    .from('contractor_profiles')
    .select('user_id', { count: 'exact', head: true })
    .eq('verification_status', 'pending_verification');
  return count ?? 0;
}

export async function getIncompleteContractorSignupsCount(db: AdminDb): Promise<number> {
  const [{ data: contractorRoleProfiles }, { data: completed }] = await Promise.all([
    db.from('profiles').select('id').eq('role', 'contractor'),
    db.from('contractor_profiles').select('user_id'),
  ]);
  const completedIds = new Set((completed ?? []).map((c) => c.user_id));
  return (contractorRoleProfiles ?? []).filter((p) => !completedIds.has(p.id)).length;
}
