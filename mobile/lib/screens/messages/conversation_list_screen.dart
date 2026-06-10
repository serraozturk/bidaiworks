import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../widgets/layout/app_avatar.dart';
import '../../widgets/layout/empty_state.dart';

class ConversationListScreen extends ConsumerWidget {
  final UserRole roleHint;
  const ConversationListScreen({super.key, required this.roleHint});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final convs = ref.watch(myConversationsProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Inbox'),
      ),
      body: convs.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
          error: e,
          onRetry: () => ref.invalidate(myConversationsProvider),
        ),
        data: (list) {
          if (list.isEmpty) {
            return EmptyState(
              icon: Icons.chat_bubble_outline,
              title: 'No messages yet',
              message: roleHint == UserRole.homeowner
                  ? 'Start a chat from a contractor profile or after receiving a quote.'
                  : 'Once a homeowner replies to a quote, the conversation shows up here.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async => ref.refresh(myConversationsProvider.future),
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(vertical: 4),
              itemCount: list.length,
              separatorBuilder: (_, __) => const Divider(
                  height: 1, indent: 76, color: AppColors.border),
              itemBuilder: (_, i) {
                final c = list[i];
                final hasUnread = c.unreadCount > 0;
                return ListTile(
                  contentPadding: const EdgeInsets.symmetric(
                      horizontal: 16, vertical: 6),
                  leading: AppAvatar(
                    url: c.otherAvatarUrl,
                    fallbackInitials: (c.otherDisplayName ?? '?')
                        .substring(0, 1)
                        .toUpperCase(),
                    size: 48,
                  ),
                  title: Row(
                    children: [
                      Expanded(
                        child: Text(
                          c.otherDisplayName ?? 'User',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontWeight:
                                hasUnread ? FontWeight.w800 : FontWeight.w600,
                          ),
                        ),
                      ),
                      Text(Formatters.relativeShort(c.lastMessageAt),
                          style: TextStyle(
                            fontSize: 11,
                            color: hasUnread
                                ? AppColors.primary
                                : AppColors.textTertiary,
                            fontWeight: FontWeight.w600,
                          )),
                    ],
                  ),
                  subtitle: Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            c.projectTitle ?? 'Project',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppColors.textSecondary,
                              fontWeight: FontWeight.w500,
                              fontSize: 12,
                            ),
                          ),
                        ),
                        if (hasUnread)
                          Container(
                            padding: const EdgeInsets.symmetric(
                                horizontal: 6, vertical: 1),
                            decoration: const BoxDecoration(
                              color: AppColors.primary,
                              shape: BoxShape.rectangle,
                              borderRadius:
                                  BorderRadius.all(Radius.circular(20)),
                            ),
                            child: Text(
                              '${c.unreadCount}',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  onTap: () => context.push('/messages/${c.id}'),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
