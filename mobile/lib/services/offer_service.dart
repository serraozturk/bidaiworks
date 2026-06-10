import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/supabase/supabase_client.dart';
import '../models/models.dart';

class OfferService {
  final SupabaseClient _sb = SupabaseService.client;

  /// All offers exchanged inside a single conversation.
  Future<List<Offer>> forConversation(String conversationId) async {
    final rows = await _sb
        .from('offers')
        .select()
        .eq('conversation_id', conversationId)
        .order('created_at', ascending: true);
    return rows.map((r) => Offer.fromJson(r)).toList();
  }

  /// All offers visible to the homeowner across all of their projects.
  Future<List<Offer>> myIncomingHomeowner() async {
    final me = SupabaseService.currentUserId!;
    final rows = await _sb
        .from('offers')
        .select('*, projects!inner(homeowner_id, title)')
        .eq('projects.homeowner_id', me)
        .order('created_at', ascending: false);
    return rows.map((r) => Offer.fromJson(r)).toList();
  }

  Future<Offer> create({
    required String projectId,
    String? conversationId,
    String? parentOfferId,
    required UserRole senderRole,
    required OfferKind kind,
    required num amount,
    int? timelineDays,
    String? scopeSummary,
    String? message,
    DateTime? expiresAt,
  }) async {
    final me = SupabaseService.currentUserId!;
    final r = await _sb
        .from('offers')
        .insert({
          'project_id': projectId,
          'conversation_id': conversationId,
          'parent_offer_id': parentOfferId,
          'sender_id': me,
          'sender_role': EnumCodec.userRoleToDb(senderRole),
          'kind': EnumCodec.offerKindToDb(kind),
          'amount': amount,
          'timeline_days': timelineDays,
          'scope_summary': scopeSummary,
          'message': message,
          'expires_at': expiresAt?.toIso8601String(),
          'status': 'pending',
        })
        .select()
        .single();
    return Offer.fromJson(r);
  }

  /// Hard-lock acceptance via accept_offer RPC.
  Future<String> accept(String offerId) async {
    final r = await _sb.rpc('accept_offer', params: {'p_offer_id': offerId});
    // RPC returns the synthesized quote id (uuid) — used for checkout.
    if (r is String) return r;
    if (r is List && r.isNotEmpty) return r.first.toString();
    return '';
  }

  Future<void> reject(String offerId) async {
    await _sb
        .from('offers')
        .update({'status': 'rejected', 'responded_at': DateTime.now().toIso8601String()})
        .eq('id', offerId);
  }

  Future<void> withdraw(String offerId) async {
    await _sb
        .from('offers')
        .update({'status': 'withdrawn', 'responded_at': DateTime.now().toIso8601String()})
        .eq('id', offerId);
  }
}
