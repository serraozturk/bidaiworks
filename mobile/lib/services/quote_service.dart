import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/supabase/supabase_client.dart';
import '../models/models.dart';

class QuoteService {
  final SupabaseClient _sb = SupabaseService.client;

  static const String _selectWithContractor =
      '*, contractor_profiles(*, profiles(*))';

  Future<List<Quote>> forProject(String projectId) async {
    final rows = await _sb
        .from('quotes')
        .select(_selectWithContractor)
        .eq('project_id', projectId)
        .order('created_at', ascending: false);
    return rows.map((r) => Quote.fromJson(r)).toList();
  }

  Future<List<Quote>> myQuotes() async {
    final me = SupabaseService.currentUserId!;
    final rows = await _sb
        .from('quotes')
        .select('*, projects(*, categories(*))')
        .eq('contractor_id', me)
        .order('created_at', ascending: false);
    return rows.map((r) => Quote.fromJson(r)).toList();
  }

  Future<Quote> byId(String id) async {
    final r = await _sb
        .from('quotes')
        .select(_selectWithContractor)
        .eq('id', id)
        .single();
    return Quote.fromJson(r);
  }

  Future<Quote> create({
    required String projectId,
    required num amount,
    int? timelineDays,
    String? message,
    String? includedScope,
    String? excludedScope,
    String? notes,
  }) async {
    final me = SupabaseService.currentUserId!;
    final r = await _sb
        .from('quotes')
        .insert({
          'project_id': projectId,
          'contractor_id': me,
          'amount': amount,
          'timeline_days': timelineDays,
          'message': message,
          'included_scope': includedScope,
          'excluded_scope': excludedScope,
          'notes': notes,
          'status': 'pending',
        })
        .select(_selectWithContractor)
        .single();
    return Quote.fromJson(r);
  }

  Future<Quote> update(
    String id, {
    num? amount,
    int? timelineDays,
    String? message,
    String? includedScope,
    String? excludedScope,
    String? notes,
  }) async {
    final patch = <String, dynamic>{};
    if (amount != null) patch['amount'] = amount;
    if (timelineDays != null) patch['timeline_days'] = timelineDays;
    if (message != null) patch['message'] = message;
    if (includedScope != null) patch['included_scope'] = includedScope;
    if (excludedScope != null) patch['excluded_scope'] = excludedScope;
    if (notes != null) patch['notes'] = notes;
    final r = await _sb
        .from('quotes')
        .update(patch)
        .eq('id', id)
        .select(_selectWithContractor)
        .single();
    return Quote.fromJson(r);
  }

  Future<void> withdraw(String id) async {
    await _sb.from('quotes').update({'status': 'withdrawn'}).eq('id', id);
  }

  /// Hard-lock award via the accept_quote RPC. Sets project to 'awarded',
  /// rejects all other pending quotes/offers.
  Future<void> accept(String quoteId) async {
    await _sb.rpc('accept_quote', params: {'p_quote_id': quoteId});
  }

  Future<void> reject(String quoteId) async {
    await _sb.from('quotes').update({'status': 'rejected'}).eq('id', quoteId);
  }
}
