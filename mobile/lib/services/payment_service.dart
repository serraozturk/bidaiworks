import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/supabase/supabase_client.dart';
import '../models/models.dart';

class PaymentService {
  final SupabaseClient _sb = SupabaseService.client;

  /// Homeowner checkout. Calls the shared `homeowner_pay_project` RPC: the
  /// project moves to `paid`, the project amount + protection hold are held
  /// in bidAI escrow, and the contractor 8% commitment fee becomes due.
  Future<void> homeownerPayProject({
    required String projectId,
    String? cardLast4,
  }) async {
    await _sb.rpc('homeowner_pay_project', params: {
      'p_project_id': projectId,
      'p_card_last4': cardLast4,
    });
  }

  /// Contractor commitment payment. Calls `contractor_pay_commitment`: the
  /// project moves from `paid` to `in_progress`, the job activates and
  /// direct chat unlocks.
  Future<void> contractorPayCommitment(String projectId) async {
    await _sb.rpc('contractor_pay_commitment', params: {
      'p_project_id': projectId,
    });
  }

  /// Lazily expire stale payment / commitment windows. Safe to call on load.
  Future<void> expireStaleDeals() async {
    try {
      await _sb.rpc('expire_stale_deals');
    } catch (_) {}
  }

  Future<List<Payment>> myPaymentsAsPayer() async {
    final me = SupabaseService.currentUserId!;
    final rows = await _sb
        .from('payments')
        .select()
        .eq('payer_id', me)
        .order('created_at', ascending: false);
    return rows.map((r) => Payment.fromJson(r)).toList();
  }

  Future<List<Payment>> contractorPayments() async {
    final me = SupabaseService.currentUserId!;
    final rows = await _sb
        .from('payments')
        .select()
        .eq('payee_id', me)
        .order('created_at', ascending: false);
    return rows.map((r) => Payment.fromJson(r)).toList();
  }

  Future<ContractorBalance> contractorBalance() async {
    final me = SupabaseService.currentUserId!;
    final pays = await contractorPayments();
    num held = 0, released = 0;
    for (final p in pays) {
      if (p.status == PaymentStatus.held) held += p.depositAmount;
      if (p.status == PaymentStatus.released) released += p.totalAmount;
    }
    final wRows =
        await _sb.from('withdrawals').select().eq('contractor_id', me);
    num withdrawn = 0, pending = 0;
    for (final w in wRows) {
      final st = EnumCodec.withdrawalStatusFromDb(w['status'] as String?);
      final amt = (w['amount'] as num);
      if (st == WithdrawalStatus.completed) withdrawn += amt;
      if (st == WithdrawalStatus.pending) pending += amt;
    }
    return ContractorBalance(
      held: held,
      released: released,
      withdrawn: withdrawn,
      pending: pending,
    );
  }

  Future<Withdrawal> requestWithdrawal({
    required num amount,
    required String bankName,
    required String routingLast4,
    required String accountLast4,
  }) async {
    final me = SupabaseService.currentUserId!;
    final r = await _sb
        .from('withdrawals')
        .insert({
          'contractor_id': me,
          'amount': amount,
          'bank_name': bankName,
          'routing_last4': routingLast4,
          'account_last4': accountLast4,
          'status': 'pending',
        })
        .select()
        .single();
    return Withdrawal.fromJson(r);
  }

  Future<List<Withdrawal>> myWithdrawals() async {
    final me = SupabaseService.currentUserId!;
    final rows = await _sb
        .from('withdrawals')
        .select()
        .eq('contractor_id', me)
        .order('created_at', ascending: false);
    return rows.map((r) => Withdrawal.fromJson(r)).toList();
  }
}
