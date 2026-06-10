import 'enums.dart';

class Payment {
  final String id;
  final String projectId;
  final String? quoteId;
  final String payerId;
  final String payeeId;
  final num totalAmount;
  final num depositAmount;
  final num depositPct;
  final PaymentMethod method;
  final String? cardLast4;
  final PaymentStatus status;
  final DateTime heldAt;
  final DateTime? releasedAt;
  final DateTime? refundedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Payment({
    required this.id,
    required this.projectId,
    this.quoteId,
    required this.payerId,
    required this.payeeId,
    required this.totalAmount,
    required this.depositAmount,
    required this.depositPct,
    required this.method,
    this.cardLast4,
    required this.status,
    required this.heldAt,
    this.releasedAt,
    this.refundedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Payment.fromJson(Map<String, dynamic> j) => Payment(
        id: j['id'] as String,
        projectId: j['project_id'] as String,
        quoteId: j['quote_id'] as String?,
        payerId: j['payer_id'] as String,
        payeeId: j['payee_id'] as String,
        totalAmount: j['total_amount'] as num,
        depositAmount: j['deposit_amount'] as num,
        depositPct: j['deposit_pct'] as num,
        method: EnumCodec.paymentMethodFromDb(j['method'] as String?),
        cardLast4: j['card_last4'] as String?,
        status: EnumCodec.paymentStatusFromDb(j['status'] as String?),
        heldAt: DateTime.parse(j['held_at'] as String),
        releasedAt: j['released_at'] != null
            ? DateTime.tryParse(j['released_at'].toString())
            : null,
        refundedAt: j['refunded_at'] != null
            ? DateTime.tryParse(j['refunded_at'].toString())
            : null,
        createdAt: DateTime.parse(j['created_at'] as String),
        updatedAt: DateTime.parse(j['updated_at'] as String),
      );
}

class Withdrawal {
  final String id;
  final String contractorId;
  final num amount;
  final WithdrawalStatus status;
  final String? bankName;
  final String? routingLast4;
  final String? accountLast4;
  final DateTime requestedAt;
  final DateTime? completedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Withdrawal({
    required this.id,
    required this.contractorId,
    required this.amount,
    required this.status,
    this.bankName,
    this.routingLast4,
    this.accountLast4,
    required this.requestedAt,
    this.completedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Withdrawal.fromJson(Map<String, dynamic> j) => Withdrawal(
        id: j['id'] as String,
        contractorId: j['contractor_id'] as String,
        amount: j['amount'] as num,
        status: EnumCodec.withdrawalStatusFromDb(j['status'] as String?),
        bankName: j['bank_name'] as String?,
        routingLast4: j['routing_last4'] as String?,
        accountLast4: j['account_last4'] as String?,
        requestedAt: DateTime.parse(j['requested_at'] as String),
        completedAt: j['completed_at'] != null
            ? DateTime.tryParse(j['completed_at'].toString())
            : null,
        createdAt: DateTime.parse(j['created_at'] as String),
        updatedAt: DateTime.parse(j['updated_at'] as String),
      );
}

class ContractorBalance {
  final num held;
  final num released;
  final num withdrawn;
  final num pending;

  const ContractorBalance({
    this.held = 0,
    this.released = 0,
    this.withdrawn = 0,
    this.pending = 0,
  });

  num get available => released - withdrawn - pending;
}
