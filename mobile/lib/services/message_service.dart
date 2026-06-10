import 'dart:async';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/supabase/supabase_client.dart';
import '../models/models.dart';

class MessageService {
  final SupabaseClient _sb = SupabaseService.client;

  /// Conversation list for the current user (homeowner OR contractor).
  Future<List<Conversation>> myConversations() async {
    final me = SupabaseService.currentUserId!;
    final rows = await _sb
        .from('conversations')
        .select('*, projects(title), homeowner:profiles!homeowner_id(full_name, avatar_url), contractor:profiles!contractor_id(full_name, avatar_url)')
        .or('homeowner_id.eq.$me,contractor_id.eq.$me')
        .order('last_message_at', ascending: false);

    final out = <Conversation>[];
    for (final r in rows) {
      try {
        final base = Conversation.fromJson(r);
        final isHo = base.homeownerId == me;
        final other = isHo
            ? r['contractor'] as Map<String, dynamic>?
            : r['homeowner'] as Map<String, dynamic>?;
        final projTitle = (r['projects'] as Map<String, dynamic>?)?['title']
                as String? ??
            'Project';
        final lastReadStr = isHo
            ? r['last_read_homeowner_at']
            : r['last_read_contractor_at'];
        final lastRead = lastReadStr != null
            ? DateTime.tryParse(lastReadStr.toString())
            : null;
        // unread count = messages newer than lastRead, sender != me
        int unread = 0;
        try {
          final unreadRows = await _sb
              .from('messages')
              .select('id, sender_id, created_at')
              .eq('conversation_id', base.id)
              .neq('sender_id', me)
              .gt('created_at',
                  (lastRead ?? base.createdAt).toUtc().toIso8601String());
          unread = (unreadRows as List).length;
        } catch (_) {}
        out.add(base.copyWith(
          projectTitle: projTitle,
          otherDisplayName: other?['full_name'] as String?,
          otherAvatarUrl: other?['avatar_url'] as String?,
          unreadCount: unread,
        ));
      } catch (_) {
        continue;
      }
    }
    return out;
  }

  /// Get or create a conversation for (project, contractor, homeowner).
  Future<Conversation> ensureConversation({
    required String projectId,
    required String homeownerId,
    required String contractorId,
  }) async {
    final existing = await _sb
        .from('conversations')
        .select()
        .eq('project_id', projectId)
        .eq('contractor_id', contractorId)
        .maybeSingle();
    if (existing != null) {
      return Conversation.fromJson(existing);
    }
    final inserted = await _sb
        .from('conversations')
        .insert({
          'project_id': projectId,
          'homeowner_id': homeownerId,
          'contractor_id': contractorId,
        })
        .select()
        .single();
    return Conversation.fromJson(inserted);
  }

  Future<List<Message>> messagesIn(String conversationId,
      {int limit = 200}) async {
    final rows = await _sb
        .from('messages')
        .select('*, offers(*), quotes(*, contractor_profiles(*, profiles(*)))')
        .eq('conversation_id', conversationId)
        .order('created_at', ascending: true)
        .limit(limit);
    return rows.map((r) => Message.fromJson(r)).toList();
  }

  Future<Message> sendText({
    required String conversationId,
    required String content,
  }) async {
    final me = SupabaseService.currentUserId!;
    final r = await _sb
        .from('messages')
        .insert({
          'conversation_id': conversationId,
          'sender_id': me,
          'content': content,
          'kind': 'text',
        })
        .select()
        .single();
    return Message.fromJson(r);
  }

  /// System cards (offer / quote) post a system-flavored message linking
  /// the offer or quote so the chat thread renders an inline card.
  Future<Message> postOfferCard({
    required String conversationId,
    required String offerId,
    required String summary,
  }) async {
    final me = SupabaseService.currentUserId!;
    final r = await _sb
        .from('messages')
        .insert({
          'conversation_id': conversationId,
          'sender_id': me,
          'content': summary,
          'kind': 'offer_card',
          'offer_id': offerId,
        })
        .select()
        .single();
    return Message.fromJson(r);
  }

  Future<Message> postQuoteCard({
    required String conversationId,
    required String quoteId,
    required String summary,
  }) async {
    final me = SupabaseService.currentUserId!;
    final r = await _sb
        .from('messages')
        .insert({
          'conversation_id': conversationId,
          'sender_id': me,
          'content': summary,
          'kind': 'quote_card',
          'quote_id': quoteId,
        })
        .select()
        .single();
    return Message.fromJson(r);
  }

  Future<void> markRead(Conversation c) async {
    final me = SupabaseService.currentUserId!;
    final field = c.homeownerId == me
        ? 'last_read_homeowner_at'
        : 'last_read_contractor_at';
    await _sb
        .from('conversations')
        .update({field: DateTime.now().toUtc().toIso8601String()})
        .eq('id', c.id);
  }

  /// Realtime stream of new messages in a conversation.
  Stream<List<Message>> streamMessages(String conversationId) {
    return _sb
        .from('messages')
        .stream(primaryKey: ['id'])
        .eq('conversation_id', conversationId)
        .order('created_at')
        .map((rows) => rows.map((r) => Message.fromJson(r)).toList());
  }
}
