import 'enums.dart';
import 'offer.dart';
import 'quote.dart';

class Message {
  final String id;
  final String conversationId;
  final String senderId;
  final String content;
  final MessageKind kind;
  final String? offerId;
  final String? quoteId;
  final DateTime createdAt;

  // Joined
  final Offer? offer;
  final Quote? quote;

  const Message({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.content,
    this.kind = MessageKind.text,
    this.offerId,
    this.quoteId,
    required this.createdAt,
    this.offer,
    this.quote,
  });

  factory Message.fromJson(Map<String, dynamic> j) {
    Offer? off;
    Quote? quo;
    final rawOff = j['offers'];
    if (rawOff is Map<String, dynamic>) off = Offer.fromJson(rawOff);
    final rawQuo = j['quotes'];
    if (rawQuo is Map<String, dynamic>) quo = Quote.fromJson(rawQuo);
    return Message(
      id: j['id'] as String,
      conversationId: j['conversation_id'] as String,
      senderId: j['sender_id'] as String,
      content: j['content'] as String? ?? '',
      kind: EnumCodec.messageKindFromDb(j['kind'] as String?),
      offerId: j['offer_id'] as String?,
      quoteId: j['quote_id'] as String?,
      createdAt: DateTime.parse(j['created_at'] as String),
      offer: off,
      quote: quo,
    );
  }

  Message copyWith({Offer? offer, Quote? quote}) => Message(
        id: id,
        conversationId: conversationId,
        senderId: senderId,
        content: content,
        kind: kind,
        offerId: offerId,
        quoteId: quoteId,
        createdAt: createdAt,
        offer: offer ?? this.offer,
        quote: quote ?? this.quote,
      );
}

class Conversation {
  final String id;
  final String projectId;
  final String homeownerId;
  final String contractorId;
  final DateTime lastMessageAt;
  final DateTime? lastReadHomeownerAt;
  final DateTime? lastReadContractorAt;
  final DateTime createdAt;

  // Optional joined
  final String? projectTitle;
  final String? otherDisplayName;
  final String? otherAvatarUrl;
  final String? lastMessagePreview;
  final int unreadCount;

  const Conversation({
    required this.id,
    required this.projectId,
    required this.homeownerId,
    required this.contractorId,
    required this.lastMessageAt,
    this.lastReadHomeownerAt,
    this.lastReadContractorAt,
    required this.createdAt,
    this.projectTitle,
    this.otherDisplayName,
    this.otherAvatarUrl,
    this.lastMessagePreview,
    this.unreadCount = 0,
  });

  factory Conversation.fromJson(Map<String, dynamic> j) => Conversation(
        id: j['id'] as String,
        projectId: j['project_id'] as String,
        homeownerId: j['homeowner_id'] as String,
        contractorId: j['contractor_id'] as String,
        lastMessageAt: DateTime.parse(j['last_message_at'] as String),
        lastReadHomeownerAt: j['last_read_homeowner_at'] != null
            ? DateTime.tryParse(j['last_read_homeowner_at'].toString())
            : null,
        lastReadContractorAt: j['last_read_contractor_at'] != null
            ? DateTime.tryParse(j['last_read_contractor_at'].toString())
            : null,
        createdAt: DateTime.parse(j['created_at'] as String),
      );

  Conversation copyWith({
    String? projectTitle,
    String? otherDisplayName,
    String? otherAvatarUrl,
    String? lastMessagePreview,
    int? unreadCount,
  }) =>
      Conversation(
        id: id,
        projectId: projectId,
        homeownerId: homeownerId,
        contractorId: contractorId,
        lastMessageAt: lastMessageAt,
        lastReadHomeownerAt: lastReadHomeownerAt,
        lastReadContractorAt: lastReadContractorAt,
        createdAt: createdAt,
        projectTitle: projectTitle ?? this.projectTitle,
        otherDisplayName: otherDisplayName ?? this.otherDisplayName,
        otherAvatarUrl: otherAvatarUrl ?? this.otherAvatarUrl,
        lastMessagePreview: lastMessagePreview ?? this.lastMessagePreview,
        unreadCount: unreadCount ?? this.unreadCount,
      );
}
