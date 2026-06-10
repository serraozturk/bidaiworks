import 'enums.dart';

class Offer {
  final String id;
  final String projectId;
  final String? conversationId;
  final String? parentOfferId;
  final String senderId;
  final UserRole senderRole;
  final OfferKind kind;
  final num amount;
  final int? timelineDays;
  final String? scopeSummary;
  final String? message;
  final OfferStatus status;
  final DateTime? expiresAt;
  final DateTime? respondedAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  const Offer({
    required this.id,
    required this.projectId,
    this.conversationId,
    this.parentOfferId,
    required this.senderId,
    required this.senderRole,
    required this.kind,
    required this.amount,
    this.timelineDays,
    this.scopeSummary,
    this.message,
    required this.status,
    this.expiresAt,
    this.respondedAt,
    required this.createdAt,
    required this.updatedAt,
  });

  factory Offer.fromJson(Map<String, dynamic> j) => Offer(
        id: j['id'] as String,
        projectId: j['project_id'] as String,
        conversationId: j['conversation_id'] as String?,
        parentOfferId: j['parent_offer_id'] as String?,
        senderId: j['sender_id'] as String,
        senderRole: EnumCodec.userRoleFromDb(j['sender_role'] as String?),
        kind: EnumCodec.offerKindFromDb(j['kind'] as String?),
        amount: j['amount'] as num,
        timelineDays: (j['timeline_days'] as num?)?.toInt(),
        scopeSummary: j['scope_summary'] as String?,
        message: j['message'] as String?,
        status: EnumCodec.offerStatusFromDb(j['status'] as String?),
        expiresAt: j['expires_at'] != null
            ? DateTime.tryParse(j['expires_at'].toString())
            : null,
        respondedAt: j['responded_at'] != null
            ? DateTime.tryParse(j['responded_at'].toString())
            : null,
        createdAt: DateTime.parse(j['created_at'] as String),
        updatedAt: DateTime.parse(j['updated_at'] as String),
      );

  bool get isActionable => status == OfferStatus.pending;
}
