import 'package:cached_network_image/cached_network_image.dart';
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
import '../../widgets/layout/rating_row.dart';
import '../../widgets/layout/status_badge.dart';

class ProjectDetailScreen extends ConsumerWidget {
  final String projectId;
  const ProjectDetailScreen({super.key, required this.projectId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = ref.watch(projectByIdProvider(projectId));
    final quotes = ref.watch(quotesForProjectProvider(projectId));
    return Scaffold(
      appBar: AppBar(
        title: const Text('Project'),
        actions: [
          PopupMenuButton(
            itemBuilder: (_) => [
              const PopupMenuItem(value: 'cancel', child: Text('Cancel project')),
              const PopupMenuItem(
                  value: 'completed', child: Text('Mark completed')),
            ],
            onSelected: (v) async {
              final svc = ref.read(projectServiceProvider);
              if (v == 'cancel') {
                final ok = await context.confirm(
                  title: 'Cancel project?',
                  message: 'Contractors will no longer be able to send quotes.',
                  destructive: true,
                  confirmLabel: 'Cancel project',
                );
                if (ok) {
                  await svc.cancel(projectId);
                  ref.invalidate(projectByIdProvider(projectId));
                  ref.invalidate(myProjectsProvider);
                }
              } else if (v == 'completed') {
                await svc.markCompleted(projectId);
                ref.invalidate(projectByIdProvider(projectId));
                if (context.mounted) {
                  context.snack(
                      'Project marked completed. Funds released to contractor.');
                }
              }
            },
          ),
        ],
      ),
      body: p.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(error: e),
        data: (project) {
          if (project == null) {
            return const EmptyState(
                icon: Icons.error_outline,
                title: 'Project not found',
                message: 'This project may have been deleted.');
          }
          return RefreshIndicator(
            onRefresh: () async {
              ref.invalidate(projectByIdProvider(projectId));
              ref.invalidate(quotesForProjectProvider(projectId));
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
              children: [
                if (project.photos.isNotEmpty) _photoStrip(project),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: Text(project.title,
                          style: context.text.headlineMedium),
                    ),
                    StatusBadge.forProject(project.status),
                  ],
                ),
                const SizedBox(height: 4),
                Text(
                  '${project.category?.name ?? '—'} · ${project.locationLabel}',
                  style: context.text.bodyMedium
                      ?.copyWith(color: AppColors.textSecondary),
                ),
                const SizedBox(height: 16),
                _aiBlock(project),
                const SizedBox(height: 16),
                _detailsBlock(project, context),
                const SizedBox(height: 16),
                Text('Description', style: context.text.titleMedium),
                const SizedBox(height: 6),
                Text(project.description, style: context.text.bodyMedium),
                const SizedBox(height: 24),
                Row(
                  children: [
                    Text('Quotes', style: context.text.titleMedium),
                    const Spacer(),
                    OutlinedButton.icon(
                      onPressed: () => context
                          .push('/homeowner/projects/${project.id}/compare'),
                      icon: const Icon(Icons.compare_arrows, size: 16),
                      label: const Text('Compare'),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                quotes.when(
                  loading: () => const LoadingView(),
                  error: (e, _) => ErrorView(error: e),
                  data: (qs) {
                    if (qs.isEmpty) {
                      return const EmptyState(
                        icon: Icons.inbox_outlined,
                        title: 'No quotes yet',
                        message:
                            'Contractors who match your project will send quotes here.',
                      );
                    }
                    return Column(
                      children: qs
                          .map((q) => Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: _QuoteRow(
                                  q: q,
                                  onAccept: () async {
                                    final ok = await context.confirm(
                                      title: 'Accept this quote?',
                                      message:
                                          'This will award the project. All other quotes are rejected.',
                                      confirmLabel: 'Accept',
                                    );
                                    if (!ok) return;
                                    try {
                                      await ref
                                          .read(quoteServiceProvider)
                                          .accept(q.id);
                                      ref.invalidate(
                                          quotesForProjectProvider(projectId));
                                      ref.invalidate(
                                          projectByIdProvider(projectId));
                                      if (context.mounted) {
                                        context.push('/checkout/${q.id}');
                                      }
                                    } catch (e) {
                                      if (context.mounted) {
                                        context.snack('Failed: $e',
                                            error: true);
                                      }
                                    }
                                  },
                                  onMessage: () async {
                                    final conv = await ref
                                        .read(messageServiceProvider)
                                        .ensureConversation(
                                          projectId: project.id,
                                          homeownerId: project.homeownerId,
                                          contractorId: q.contractorId,
                                        );
                                    if (context.mounted) {
                                      context.push(
                                          '/messages/${conv.id}');
                                    }
                                  },
                                ),
                              ))
                          .toList(),
                    );
                  },
                ),
                if (project.status == ProjectStatus.completed) ...[
                  const SizedBox(height: 16),
                  AsyncPrimaryButton(
                    label: 'Leave a review',
                    icon: Icons.star_outline,
                    onPressed: () async {
                      context.push('/homeowner/projects/${project.id}/review');
                    },
                  ),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _photoStrip(Project p) {
    return SizedBox(
      height: 220,
      child: PageView.builder(
        itemCount: p.photos.length,
        itemBuilder: (_, i) => ClipRRect(
          borderRadius: BorderRadius.circular(16),
          child: CachedNetworkImage(
            imageUrl: p.photos[i].url,
            fit: BoxFit.cover,
            width: double.infinity,
            placeholder: (_, __) => Container(color: AppColors.surfaceAlt),
          ),
        ),
      ),
    );
  }

  Widget _aiBlock(Project p) {
    if (p.aiEstimateMin == null) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withOpacity(0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: const [
            Icon(Icons.auto_awesome, size: 18, color: AppColors.primary),
            SizedBox(width: 6),
            Text('AI estimate',
                style: TextStyle(
                    color: AppColors.primary, fontWeight: FontWeight.w700)),
          ]),
          const SizedBox(height: 6),
          Text(
            Formatters.range(p.aiEstimateMin, p.aiEstimateMax),
            style: const TextStyle(
                fontSize: 22, fontWeight: FontWeight.w800),
          ),
          if (p.aiEstimateReasoning != null) ...[
            const SizedBox(height: 4),
            Text(
              p.aiEstimateReasoning!,
              style: const TextStyle(
                  color: AppColors.textSecondary, height: 1.4),
            ),
          ],
        ],
      ),
    );
  }

  Widget _detailsBlock(Project p, BuildContext context) {
    final rows = <(String, String)>[
      ('Posted', Formatters.date(p.createdAt)),
      if (p.budgetMin != null || p.budgetMax != null)
        ('Budget', Formatters.range(p.budgetMin, p.budgetMax)),
      if (p.squareFootage != null) ('Size', '${p.squareFootage} sq ft'),
      if (p.qualityLevel != null)
        ('Quality', EnumCodec.qualityLevelLabel(p.qualityLevel!)),
      if (p.projectScope != null)
        ('Scope', EnumCodec.projectScopeLabel(p.projectScope!)),
      if (p.desiredStartDate != null)
        ('Start', Formatters.date(p.desiredStartDate)),
      if (p.materialPreferences != null &&
          p.materialPreferences!.trim().isNotEmpty)
        ('Materials', p.materialPreferences!.trim()),
    ];
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.border),
      ),
      padding: const EdgeInsets.all(12),
      child: Column(
        children: rows
            .map((r) => Padding(
                  padding: const EdgeInsets.symmetric(vertical: 4),
                  child: Row(children: [
                    SizedBox(
                      width: 90,
                      child: Text(r.$1,
                          style: const TextStyle(
                              color: AppColors.textTertiary,
                              fontWeight: FontWeight.w500)),
                    ),
                    Expanded(
                      child: Text(r.$2,
                          style: const TextStyle(fontWeight: FontWeight.w600)),
                    ),
                  ]),
                ))
            .toList(),
      ),
    );
  }
}

class _QuoteRow extends StatelessWidget {
  final Quote q;
  final Future<void> Function() onAccept;
  final Future<void> Function() onMessage;

  const _QuoteRow({
    required this.q,
    required this.onAccept,
    required this.onMessage,
  });

  @override
  Widget build(BuildContext context) {
    final cp = q.contractor;
    final base = q.contractorBaseProfile;
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            AppAvatar(
              url: cp?.logoUrl ?? base?.avatarUrl,
              fallbackInitials: (cp?.companyName.isNotEmpty ?? false)
                  ? cp!.companyName.substring(0, 1).toUpperCase()
                  : '?',
              size: 40,
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(cp?.companyName ?? 'Contractor',
                      style: const TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 15)),
                  if (cp != null)
                    RatingRow(
                      rating: cp.ratingAvg,
                      count: cp.ratingCount,
                      size: 12,
                    ),
                ],
              ),
            ),
            StatusBadge.forQuote(q.status),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            Text(
              Formatters.currency(q.amount),
              style: const TextStyle(
                  fontSize: 22, fontWeight: FontWeight.w800),
            ),
            const SizedBox(width: 10),
            if (q.timelineDays != null)
              Text('· ${q.timelineDays}-day timeline',
                  style: const TextStyle(color: AppColors.textSecondary)),
          ]),
          if (q.message != null && q.message!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(q.message!,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(color: AppColors.textSecondary)),
          ],
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: onMessage,
                icon: const Icon(Icons.chat_bubble_outline, size: 16),
                label: const Text('Message'),
              ),
            ),
            if (q.status == QuoteStatus.pending) ...[
              const SizedBox(width: 8),
              Expanded(
                child: AsyncPrimaryButton(
                  label: 'Accept',
                  fullWidth: true,
                  onPressed: onAccept,
                ),
              ),
            ],
          ]),
        ],
      ),
    );
  }
}
