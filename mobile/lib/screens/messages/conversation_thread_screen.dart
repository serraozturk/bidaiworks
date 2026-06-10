import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/extensions/context_extensions.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../widgets/layout/app_avatar.dart';
import '../../widgets/layout/empty_state.dart';
import '../../widgets/layout/primary_button.dart';
import '../../widgets/layout/status_badge.dart';

class ConversationThreadScreen extends ConsumerStatefulWidget {
  final String conversationId;
  const ConversationThreadScreen({super.key, required this.conversationId});

  @override
  ConsumerState<ConversationThreadScreen> createState() =>
      _ConversationThreadScreenState();
}

class _ConversationThreadScreenState
    extends ConsumerState<ConversationThreadScreen> {
  final _input = TextEditingController();
  final _scroll = ScrollController();
  Conversation? _conv;
  bool _loaded = false;

  @override
  void initState() {
    super.initState();
    _bootstrap();
  }

  @override
  void dispose() {
    _input.dispose();
    _scroll.dispose();
    super.dispose();
  }

  Future<void> _bootstrap() async {
    final svc = ref.read(messageServiceProvider);
    final all = await svc.myConversations();
    Conversation? c;
    for (final x in all) {
      if (x.id == widget.conversationId) {
        c = x;
        break;
      }
    }
    c ??= Conversation(
      id: widget.conversationId,
      projectId: '',
      homeownerId: '',
      contractorId: '',
      lastMessageAt: DateTime.now(),
      createdAt: DateTime.now(),
    );
    if (mounted) {
      setState(() {
        _conv = c;
        _loaded = true;
      });
      try {
        await svc.markRead(c);
      } catch (_) {}
    }
  }

  Future<void> _send() async {
    final text = _input.text.trim();
    if (text.isEmpty) return;
    _input.clear();
    try {
      await ref.read(messageServiceProvider).sendText(
            conversationId: widget.conversationId,
            content: text,
          );
    } catch (e) {
      if (!mounted) return;
      // The backend blocks off-platform contact details before checkout.
      final raw = e.toString();
      String msg;
      if (raw.contains('CONTACT_BLOCKED')) {
        msg = raw.split('CONTACT_BLOCKED:').last;
        final cut = msg.indexOf(', code:');
        if (cut > 0) msg = msg.substring(0, cut);
        msg = msg.trim();
      } else {
        msg = 'Send failed. Please try again.';
      }
      _input.text = text;
      context.snack(msg, error: true);
    }
  }

  Future<void> _showOfferSheet() async {
    final me = ref.read(currentUserProvider);
    final myProfile = ref.read(currentProfileProvider).valueOrNull;
    if (me == null || _conv == null || myProfile == null) return;
    final isMeHomeowner = _conv!.homeownerId == me.id;

    final amount = TextEditingController();
    final timeline = TextEditingController();
    final scope = TextEditingController();
    final note = TextEditingController();

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) {
        return Padding(
          padding: EdgeInsets.only(
            left: 20,
            right: 20,
            top: 16,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(children: [
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: isMeHomeowner
                        ? AppColors.homeownerTint
                        : AppColors.contractorTint,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    isMeHomeowner ? 'Budget offer' : 'Quick offer',
                    style: TextStyle(
                      color: isMeHomeowner
                          ? AppColors.homeownerInk
                          : AppColors.contractorInk,
                      fontWeight: FontWeight.w700,
                      fontSize: 11,
                    ),
                  ),
                ),
                const Spacer(),
                IconButton(
                    icon: const Icon(Icons.close),
                    onPressed: () => Navigator.pop(ctx)),
              ]),
              Text('Make an offer',
                  style: Theme.of(ctx).textTheme.headlineMedium),
              const SizedBox(height: 4),
              Text(
                isMeHomeowner
                    ? "Tell the contractor a number you're hoping to land."
                    : 'Send a fast ballpark before a formal quote.',
                style: const TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: amount,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                    labelText: 'Amount', prefixText: '\$ '),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: timeline,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                    labelText: 'Timeline (days)', suffixText: 'days'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: scope,
                maxLines: 2,
                decoration:
                    const InputDecoration(labelText: 'Scope summary'),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: note,
                maxLines: 2,
                decoration: const InputDecoration(labelText: 'Note'),
              ),
              const SizedBox(height: 16),
              AsyncPrimaryButton(
                label: 'Send offer',
                icon: Icons.send,
                onPressed: () async {
                  final amt = num.tryParse(amount.text.trim());
                  if (amt == null || amt <= 0) {
                    context.snack('Enter a valid amount', error: true);
                    return;
                  }
                  try {
                    final offer = await ref.read(offerServiceProvider).create(
                          projectId: _conv!.projectId,
                          conversationId: _conv!.id,
                          senderRole: myProfile.role,
                          kind: isMeHomeowner
                              ? OfferKind.budgetOffer
                              : OfferKind.quickOffer,
                          amount: amt,
                          timelineDays: int.tryParse(timeline.text.trim()),
                          scopeSummary: scope.text.trim().isEmpty
                              ? null
                              : scope.text.trim(),
                          message: note.text.trim().isEmpty
                              ? null
                              : note.text.trim(),
                        );
                    await ref.read(messageServiceProvider).postOfferCard(
                          conversationId: _conv!.id,
                          offerId: offer.id,
                          summary:
                              '${isMeHomeowner ? "Budget" : "Quick"} offer: \$${amt.toStringAsFixed(0)}',
                        );
                    if (!context.mounted) return;
                    Navigator.pop(ctx);
                  } catch (e) {
                    if (context.mounted) {
                      context.snack('Failed: $e', error: true);
                    }
                  }
                },
              ),
            ],
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final messages = ref.watch(
        conversationMessagesProvider(widget.conversationId));
    final me = ref.watch(currentUserProvider);
    final myRole = ref.watch(currentRoleProvider);

    return Scaffold(
      appBar: AppBar(
        title: _loaded && _conv != null
            ? Text(_conv!.projectTitle ?? 'Conversation')
            : const Text('Conversation'),
      ),
      body: Column(
        children: [
          Expanded(
            child: messages.when(
              loading: () => const LoadingView(),
              error: (e, _) => ErrorView(error: e),
              data: (msgs) {
                if (msgs.isEmpty) {
                  return const EmptyState(
                    icon: Icons.chat_outlined,
                    title: 'Say hello',
                    message:
                        'Use this chat to align on details, ask questions, or send an offer.',
                  );
                }
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (_scroll.hasClients) {
                    _scroll.jumpTo(_scroll.position.maxScrollExtent);
                  }
                });
                return ListView.builder(
                  controller: _scroll,
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  itemCount: msgs.length,
                  itemBuilder: (_, i) {
                    final m = msgs[i];
                    final mine = m.senderId == me?.id;
                    return _MessageBubble(
                      msg: m,
                      mine: mine,
                      myRole: myRole,
                      onAcceptOffer: () async {
                        if (m.offerId == null) return;
                        final ok = await context.confirm(
                          title: 'Accept offer?',
                          message:
                              'This locks the project. All other offers/quotes are rejected.',
                          confirmLabel: 'Accept',
                        );
                        if (!ok) return;
                        try {
                          final quoteId = await ref
                              .read(offerServiceProvider)
                              .accept(m.offerId!);
                          if (!context.mounted) return;
                          if (quoteId.isNotEmpty &&
                              myRole == UserRole.homeowner) {
                            context.push('/checkout/$quoteId');
                          } else {
                            context.snack('Offer accepted.');
                          }
                        } catch (e) {
                          if (context.mounted) {
                            context.snack('Failed: $e', error: true);
                          }
                        }
                      },
                      onRejectOffer: () async {
                        if (m.offerId == null) return;
                        try {
                          await ref
                              .read(offerServiceProvider)
                              .reject(m.offerId!);
                        } catch (_) {}
                      },
                      onAcceptQuote: () async {
                        if (m.quoteId == null) return;
                        final ok = await context.confirm(
                          title: 'Accept quote?',
                          message:
                              'This awards the project to this contractor.',
                          confirmLabel: 'Accept',
                        );
                        if (!ok) return;
                        try {
                          await ref
                              .read(quoteServiceProvider)
                              .accept(m.quoteId!);
                          if (context.mounted) {
                            context.push('/checkout/${m.quoteId}');
                          }
                        } catch (e) {
                          if (context.mounted) {
                            context.snack('Failed: $e', error: true);
                          }
                        }
                      },
                    );
                  },
                );
              },
            ),
          ),
          _composer(),
        ],
      ),
    );
  }

  Widget _composer() {
    return SafeArea(
      top: false,
      child: Container(
        decoration: const BoxDecoration(
          color: AppColors.surface,
          border: Border(top: BorderSide(color: AppColors.border)),
        ),
        padding: const EdgeInsets.fromLTRB(8, 6, 8, 6),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            IconButton(
              icon: const Icon(Icons.local_offer_outlined,
                  color: AppColors.primary),
              tooltip: 'Make an offer',
              onPressed: _showOfferSheet,
            ),
            Expanded(
              child: TextField(
                controller: _input,
                minLines: 1,
                maxLines: 4,
                textInputAction: TextInputAction.newline,
                decoration: const InputDecoration(
                  hintText: 'Type a message…',
                  filled: true,
                  isDense: true,
                  contentPadding:
                      EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                ),
              ),
            ),
            IconButton(
              icon: const Icon(Icons.send, color: AppColors.primary),
              onPressed: _send,
            ),
          ],
        ),
      ),
    );
  }
}

class _MessageBubble extends StatelessWidget {
  final Message msg;
  final bool mine;
  final UserRole? myRole;
  final Future<void> Function() onAcceptOffer;
  final Future<void> Function() onRejectOffer;
  final Future<void> Function() onAcceptQuote;

  const _MessageBubble({
    required this.msg,
    required this.mine,
    required this.myRole,
    required this.onAcceptOffer,
    required this.onRejectOffer,
    required this.onAcceptQuote,
  });

  @override
  Widget build(BuildContext context) {
    if (msg.kind == MessageKind.system) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Center(
          child: Text(
            msg.content,
            style: const TextStyle(
                color: AppColors.textTertiary, fontSize: 12),
          ),
        ),
      );
    }

    if (msg.kind == MessageKind.offerCard) {
      return _offerCard(context);
    }
    if (msg.kind == MessageKind.quoteCard) {
      return _quoteCard(context);
    }

    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.78),
        margin: const EdgeInsets.symmetric(vertical: 4),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
        decoration: BoxDecoration(
          color: mine ? AppColors.primary : AppColors.surfaceAlt,
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(mine ? 16 : 4),
            bottomRight: Radius.circular(mine ? 4 : 16),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Text(
              msg.content,
              style: TextStyle(
                color: mine ? Colors.white : AppColors.textPrimary,
                height: 1.35,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              Formatters.time(msg.createdAt),
              style: TextStyle(
                color: mine ? Colors.white70 : AppColors.textTertiary,
                fontSize: 10,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _offerCard(BuildContext context) {
    final o = msg.offer;
    final canAct = !mine && o != null && o.status == OfferStatus.pending;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
        constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.85),
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: Border.all(color: AppColors.primary, width: 1.5),
          borderRadius: BorderRadius.circular(16),
        ),
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  o == null ? 'Offer' : EnumCodec.offerKindLabel(o.kind),
                  style: const TextStyle(
                      color: AppColors.primary,
                      fontSize: 11,
                      fontWeight: FontWeight.w700),
                ),
              ),
              const Spacer(),
              if (o != null) StatusBadge.forOffer(o.status),
            ]),
            const SizedBox(height: 10),
            Text(
              o == null
                  ? msg.content
                  : Formatters.currency(o.amount),
              style: const TextStyle(
                  fontSize: 22, fontWeight: FontWeight.w800),
            ),
            if (o?.timelineDays != null)
              Text('${o!.timelineDays}-day timeline',
                  style: const TextStyle(color: AppColors.textSecondary)),
            if (o?.scopeSummary != null) ...[
              const SizedBox(height: 6),
              Text(o!.scopeSummary!),
            ],
            if (canAct) ...[
              const SizedBox(height: 12),
              Row(children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => onRejectOffer(),
                    style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.danger,
                        side: const BorderSide(color: AppColors.danger)),
                    child: const Text('Reject'),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: AsyncPrimaryButton(
                      label: 'Accept', onPressed: onAcceptOffer),
                ),
              ]),
            ],
          ],
        ),
      ),
    );
  }

  Widget _quoteCard(BuildContext context) {
    final q = msg.quote;
    final canAct = !mine &&
        myRole == UserRole.homeowner &&
        q != null &&
        q.status == QuoteStatus.pending;
    return Align(
      alignment: mine ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 6),
        constraints: BoxConstraints(
            maxWidth: MediaQuery.of(context).size.width * 0.85),
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: Border.all(color: AppColors.accent, width: 1.5),
          borderRadius: BorderRadius.circular(16),
        ),
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: AppColors.accent.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: const Text(
                  'Formal quote',
                  style: TextStyle(
                      color: AppColors.accent,
                      fontSize: 11,
                      fontWeight: FontWeight.w700),
                ),
              ),
              const Spacer(),
              if (q != null) StatusBadge.forQuote(q.status),
            ]),
            const SizedBox(height: 10),
            if (q != null) ...[
              Text(Formatters.currency(q.amount),
                  style: const TextStyle(
                      fontSize: 22, fontWeight: FontWeight.w800)),
              if (q.timelineDays != null)
                Text('${q.timelineDays}-day timeline',
                    style:
                        const TextStyle(color: AppColors.textSecondary)),
              if (q.message != null) ...[
                const SizedBox(height: 6),
                Text(q.message!),
              ],
            ] else
              Text(msg.content),
            if (canAct) ...[
              const SizedBox(height: 12),
              AsyncPrimaryButton(label: 'Review & accept', onPressed: onAcceptQuote),
            ],
          ],
        ),
      ),
    );
  }
}
