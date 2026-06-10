import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Count conversations the user has not yet read (i.e., where the latest
 * message is newer than their last_read timestamp). Pulled from a single
 * conversations row select so we can compare timestamps client-side. Falls
 * back to 0 on any error so the UI never crashes because of a bad select.
 */
export async function countUnreadConversations(
  supabase: SupabaseClient,
  userId: string,
  role: 'homeowner' | 'contractor',
): Promise<number> {
  const { data, error } = await supabase
    .from('conversations')
    .select('last_message_at, last_read_homeowner_at, last_read_contractor_at, homeowner_id, contractor_id')
    .or(`homeowner_id.eq.${userId},contractor_id.eq.${userId}`);

  if (error || !data) return 0;

  let unread = 0;
  for (const conv of data as any[]) {
    const isHomeowner = conv.homeowner_id === userId;
    const readAt = isHomeowner ? conv.last_read_homeowner_at : conv.last_read_contractor_at;
    const lastAt = conv.last_message_at;
    if (!lastAt) continue;
    if (!readAt || new Date(lastAt) > new Date(readAt)) unread += 1;
  }

  // role param kept for API symmetry / future per-role adjustments
  void role;
  return unread;
}
