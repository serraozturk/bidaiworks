import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/extensions/context_extensions.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../widgets/layout/empty_state.dart';
import '../../widgets/layout/primary_button.dart';
import '../../widgets/layout/status_badge.dart';

class ProjectDetailContractorScreen extends ConsumerWidget {
  final String projectId;
  const ProjectDetailContractorScreen({super.key, required this.projectId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final p = ref.watch(projectByIdProvider(projectId));
    final me = ref.watch(currentUserProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Job details')),
      body: p.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(error: e),
        data: (project) {
          if (project == null) {
            return const EmptyState(
              icon: Icons.error_outline,
              title: 'Job not available',
              message:
                  'This job may have been awarded to another contractor or removed.',
            );
          }
          return ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
            children: [
              if (project.photos.isNotEmpty) ...[
                SizedBox(
                  height: 220,
                  child: PageView.builder(
                    itemCount: project.photos.length,
                    itemBuilder: (_, i) => ClipRRect(
                      borderRadius: BorderRadius.circular(16),
                      child: CachedNetworkImage(
                        imageUrl: project.photos[i].url,
                        fit: BoxFit.cover,
                        width: double.infinity,
                      ),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
              ],
              Row(children: [
                Expanded(
                  child: Text(project.title,
                      style: context.text.headlineMedium),
                ),
                StatusBadge.forProject(project.status),
              ]),
              const SizedBox(height: 4),
              Text(
                '${project.category?.name ?? '—'} · ${project.locationLabel}',
                style: context.text.bodyMedium
                    ?.copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 16),
              if (project.aiEstimateMin != null)
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                        color: AppColors.primary.withOpacity(0.18)),
                  ),
                  child: Row(children: [
                    const Icon(Icons.auto_awesome, color: AppColors.primary),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Homeowner sees an AI estimate of ${Formatters.range(project.aiEstimateMin, project.aiEstimateMax)}',
                        style:
                            const TextStyle(fontWeight: FontWeight.w600),
                      ),
                    ),
                  ]),
                ),
              const SizedBox(height: 16),
              Container(
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  border: Border.all(color: AppColors.border),
                  borderRadius: BorderRadius.circular(14),
                ),
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    if (project.budgetMin != null || project.budgetMax != null)
                      _row('Homeowner budget',
                          Formatters.range(project.budgetMin, project.budgetMax)),
                    if (project.squareFootage != null)
                      _row('Size', '${project.squareFootage} sq ft'),
                    if (project.qualityLevel != null)
                      _row('Quality',
                          EnumCodec.qualityLevelLabel(project.qualityLevel!)),
                    if (project.projectScope != null)
                      _row('Scope',
                          EnumCodec.projectScopeLabel(project.projectScope!)),
                    if (project.desiredStartDate != null)
                      _row('Start',
                          Formatters.date(project.desiredStartDate)),
                    _row('Posted', Formatters.relativeShort(project.createdAt)),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Text('Description', style: context.text.titleMedium),
              const SizedBox(height: 6),
              Text(project.description, style: context.text.bodyMedium),
              if (project.materialPreferences != null &&
                  project.materialPreferences!.isNotEmpty) ...[
                const SizedBox(height: 16),
                Text('Material preferences', style: context.text.titleMedium),
                const SizedBox(height: 6),
                Text(project.materialPreferences!,
                    style: context.text.bodyMedium),
              ],
              const SizedBox(height: 24),
              if (project.isOpen) ...[
                _pricingAdvisory(project),
                const SizedBox(height: 12),
                AsyncPrimaryButton(
                  label: 'Send formal quote',
                  icon: Icons.send,
                  onPressed: () async {
                    context.push('/contractor/jobs/${project.id}/quote');
                  },
                ),
                const SizedBox(height: 8),
                AsyncPrimaryButton(
                  label: 'Message homeowner',
                  icon: Icons.chat_bubble_outline,
                  outlined: true,
                  onPressed: () async {
                    if (me == null) return;
                    final conv =
                        await ref.read(messageServiceProvider).ensureConversation(
                              projectId: project.id,
                              homeownerId: project.homeownerId,
                              contractorId: me.id,
                            );
                    if (context.mounted) {
                      context.push('/messages/${conv.id}');
                    }
                  },
                ),
              ],
            ],
          );
        },
      ),
    );
  }

  Widget _pricingAdvisory(Project p) {
    final notes = <String>[];
    if (p.qualityLevel == QualityLevel.premium ||
        p.qualityLevel == QualityLevel.luxury) {
      notes.add(
          'Premium / luxury materials vary a lot by ZIP and supplier - set a '
          'clear material allowance in your offer.');
    }
    if (p.squareFootage == null) {
      notes.add(
          'No square footage was given - state your measurement assumption.');
    }
    if (p.materialPreferences == null ||
        p.materialPreferences!.trim().isEmpty) {
      notes.add(
          'No material preferences were given - confirm the grade your price '
          'is based on.');
    }
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.warningSoft,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Pricing this job',
              style: TextStyle(fontWeight: FontWeight.w800, fontSize: 14)),
          const SizedBox(height: 4),
          const Text(
            'You cannot message the homeowner until the job is paid and '
            'confirmed. Put anything unclear into your offer as an assumption, '
            'exclusion or material allowance.',
            style: TextStyle(fontSize: 12.5, height: 1.4),
          ),
          for (final n in notes) ...[
            const SizedBox(height: 8),
            Row(crossAxisAlignment: CrossAxisAlignment.start, children: [
              const Text('-  ',
                  style: TextStyle(fontWeight: FontWeight.w800)),
              Expanded(
                child: Text(n,
                    style: const TextStyle(fontSize: 12.5, height: 1.4)),
              ),
            ]),
          ],
        ],
      ),
    );
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 4),
        child: Row(children: [
          SizedBox(
              width: 130,
              child: Text(label,
                  style: const TextStyle(
                      color: AppColors.textTertiary,
                      fontWeight: FontWeight.w500))),
          Expanded(
              child: Text(value,
                  style: const TextStyle(fontWeight: FontWeight.w600))),
        ]),
      );
}
