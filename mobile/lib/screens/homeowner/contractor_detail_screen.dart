import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/extensions/context_extensions.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../widgets/layout/app_avatar.dart';
import '../../widgets/layout/empty_state.dart';
import '../../widgets/layout/primary_button.dart';
import '../../widgets/layout/rating_row.dart';

class ContractorDetailScreen extends ConsumerWidget {
  final String contractorId;
  const ContractorDetailScreen({super.key, required this.contractorId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final c = ref.watch(contractorByIdProvider(contractorId));
    final reviews = ref.watch(reviewsForContractorProvider(contractorId));
    final myProjects = ref.watch(myProjectsProvider).valueOrNull ?? [];

    return Scaffold(
      body: c.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(error: e),
        data: (row) {
          if (row == null) {
            return const EmptyState(
              icon: Icons.error_outline,
              title: 'Contractor not found',
              message: 'They may have removed their profile.',
            );
          }
          final p = row.profile;
          final base = row.baseProfile;
          return CustomScrollView(
            slivers: [
              SliverAppBar(
                expandedHeight: 180,
                pinned: true,
                backgroundColor: AppColors.surface,
                flexibleSpace: FlexibleSpaceBar(
                  background: p.coverImageUrl != null
                      ? CachedNetworkImage(
                          imageUrl: p.coverImageUrl!,
                          fit: BoxFit.cover,
                        )
                      : Container(color: AppColors.primarySoft),
                ),
              ),
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        AppAvatar(
                          url: p.logoUrl ?? base.avatarUrl,
                          fallbackInitials: p.companyName.isNotEmpty
                              ? p.companyName.substring(0, 1)
                              : '?',
                          size: 56,
                          ring: p.verified,
                          ringColor: AppColors.primary,
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(children: [
                                Expanded(
                                  child: Text(p.companyName,
                                      style: context.text.headlineMedium),
                                ),
                                if (p.verified)
                                  const Padding(
                                    padding: EdgeInsets.only(left: 4),
                                    child: Icon(Icons.verified,
                                        color: AppColors.primary, size: 18),
                                  ),
                              ]),
                              const SizedBox(height: 4),
                              Row(children: [
                                RatingRow(
                                  rating: p.ratingAvg,
                                  count: p.ratingCount,
                                ),
                                if (p.completedJobsCount > 0) ...[
                                  const SizedBox(width: 12),
                                  Text('${p.completedJobsCount} jobs',
                                      style: const TextStyle(
                                          color: AppColors.textSecondary,
                                          fontWeight: FontWeight.w500)),
                                ],
                              ]),
                            ],
                          ),
                        ),
                      ]),
                      const SizedBox(height: 16),
                      if (p.bio != null && p.bio!.isNotEmpty)
                        Text(p.bio!, style: context.text.bodyMedium),
                      const SizedBox(height: 16),
                      _badgesRow(p),
                      const SizedBox(height: 16),
                      if (row.categories.isNotEmpty) ...[
                        Text('Specializes in',
                            style: context.text.titleMedium),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: row.categories
                              .map((c) => Chip(label: Text(c.name)))
                              .toList(),
                        ),
                        const SizedBox(height: 16),
                      ],
                      AsyncPrimaryButton(
                        label: 'Send a project request',
                        icon: Icons.send,
                        onPressed: () =>
                            _startConversation(context, ref, row, myProjects),
                      ),
                      if (p.website != null && p.website!.isNotEmpty) ...[
                        const SizedBox(height: 8),
                        AsyncPrimaryButton(
                          label: 'Visit website',
                          icon: Icons.public,
                          outlined: true,
                          onPressed: () async {
                            final uri = Uri.tryParse(p.website!);
                            if (uri != null) {
                              await launchUrl(uri,
                                  mode: LaunchMode.externalApplication);
                            }
                          },
                        ),
                      ],
                      const SizedBox(height: 24),
                      Text('Reviews', style: context.text.titleMedium),
                      const SizedBox(height: 8),
                      reviews.when(
                        loading: () => const LoadingView(),
                        error: (e, _) => ErrorView(error: e),
                        data: (rs) {
                          if (rs.isEmpty) {
                            return const EmptyState(
                              icon: Icons.rate_review_outlined,
                              title: 'No reviews yet',
                              message:
                                  'Be the first to work with this contractor.',
                            );
                          }
                          return Column(
                            children: rs
                                .map((r) => Padding(
                                      padding:
                                          const EdgeInsets.only(bottom: 12),
                                      child: _ReviewTile(review: r),
                                    ))
                                .toList(),
                          );
                        },
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _startConversation(
    BuildContext context,
    WidgetRef ref,
    dynamic row,
    List<Project> myProjects,
  ) async {
    if (myProjects.isEmpty) {
      context.snack(
        'Post a project first, then message this contractor about it.',
        error: true,
      );
      return;
    }
    final p = await showModalBottomSheet<Project>(
      context: context,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => _ProjectPickerSheet(projects: myProjects),
    );
    if (p == null) return;
    final conv = await ref.read(messageServiceProvider).ensureConversation(
          projectId: p.id,
          homeownerId: p.homeownerId,
          contractorId: row.profile.userId,
        );
    if (context.mounted) context.push('/messages/${conv.id}');
  }

  Widget _badgesRow(ContractorProfile p) {
    final badges = <Widget>[];
    if (p.licenseStatus == LicenseStatus.verified) {
      badges.add(_badge(Icons.shield_outlined, 'Licensed', AppColors.success));
    }
    if (p.insuranceStatus == InsuranceStatus.verified) {
      badges.add(_badge(Icons.health_and_safety_outlined, 'Insured',
          AppColors.success));
    }
    if (p.responseTimeHours != null) {
      badges.add(_badge(Icons.schedule, 'Replies < ${p.responseTimeHours}h',
          AppColors.info));
    }
    if (p.googleRating != null && p.googleReviewCount != null) {
      badges.add(_badge(
        Icons.public,
        'Google ${p.googleRating!.toStringAsFixed(1)} (${p.googleReviewCount})',
        AppColors.info,
      ));
    }
    if (badges.isEmpty) return const SizedBox.shrink();
    return Wrap(spacing: 6, runSpacing: 6, children: badges);
  }

  Widget _badge(IconData icon, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: color.withOpacity(0.10),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(icon, size: 13, color: color),
        const SizedBox(width: 5),
        Text(label,
            style: TextStyle(
                color: color, fontWeight: FontWeight.w600, fontSize: 12)),
      ]),
    );
  }
}

class _ReviewTile extends StatelessWidget {
  final Review review;
  const _ReviewTile({required this.review});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            RatingRow(rating: review.displayRating.toDouble(), showCount: false),
            const Spacer(),
            Text(Formatters.relativeShort(review.createdAt),
                style: const TextStyle(
                    color: AppColors.textTertiary, fontSize: 12)),
          ]),
          if (review.comment != null && review.comment!.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(review.comment!),
          ],
        ],
      ),
    );
  }
}

class _ProjectPickerSheet extends StatelessWidget {
  final List<Project> projects;
  const _ProjectPickerSheet({required this.projects});

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 16),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Pick a project', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 4),
            const Text('We\'ll start the chat tied to this project.',
                style: TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 12),
            ConstrainedBox(
              constraints: BoxConstraints(
                  maxHeight: MediaQuery.of(context).size.height * 0.5),
              child: ListView.separated(
                shrinkWrap: true,
                itemCount: projects.length,
                separatorBuilder: (_, __) => const Divider(height: 1),
                itemBuilder: (_, i) {
                  final p = projects[i];
                  return ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(p.title),
                    subtitle: Text(
                        '${p.category?.name ?? '—'} · ${p.locationLabel}'),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).pop(p),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
