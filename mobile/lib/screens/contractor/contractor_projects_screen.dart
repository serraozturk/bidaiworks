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

/// Contractor's "Active jobs" — projects a homeowner has paid for.
/// Split into jobs awaiting the contractor's commitment fee and live jobs.
class ContractorProjectsScreen extends ConsumerWidget {
  const ContractorProjectsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final jobs = ref.watch(contractorJobProjectsProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Active jobs')),
      body: jobs.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(
            error: e,
            onRetry: () => ref.invalidate(contractorJobProjectsProvider)),
        data: (list) {
          final awaiting =
              list.where((p) => p.awaitingContractorCommitment).toList();
          final active =
              list.where((p) => p.status == ProjectStatus.inProgress).toList();
          final completed =
              list.where((p) => p.status == ProjectStatus.completed).toList();

          if (awaiting.isEmpty && active.isEmpty && completed.isEmpty) {
            return const EmptyState(
              icon: Icons.construction_outlined,
              title: 'No active jobs',
              message:
                  'When a homeowner pays for one of your accepted offers, the '
                  'job appears here for you to claim.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async =>
                ref.refresh(contractorJobProjectsProvider.future),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              children: [
                if (awaiting.isNotEmpty) ...[
                  _header('Awaiting your commitment fee', awaiting.length,
                      AppColors.warning),
                  const SizedBox(height: 8),
                  for (final p in awaiting) _awaitingCard(context, p),
                  const SizedBox(height: 18),
                ],
                if (active.isNotEmpty) ...[
                  _header('Active jobs', active.length, AppColors.primary),
                  const SizedBox(height: 8),
                  for (final p in active) _activeCard(context, ref, p),
                  const SizedBox(height: 18),
                ],
                if (completed.isNotEmpty) ...[
                  _header('Completed', completed.length, AppColors.success),
                  const SizedBox(height: 8),
                  for (final p in completed) _completedCard(context, p),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _header(String label, int count, Color color) {
    return Row(
      children: [
        Text(label,
            style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
        const SizedBox(width: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
          decoration: BoxDecoration(
            color: color.withOpacity(0.14),
            borderRadius: BorderRadius.circular(20),
          ),
          child: Text('$count',
              style: TextStyle(
                  color: color, fontWeight: FontWeight.w800, fontSize: 12)),
        ),
      ],
    );
  }

  Widget _shell({required Widget child}) => Container(
        margin: const EdgeInsets.only(bottom: 10),
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(14),
        ),
        child: child,
      );

  Widget _awaitingCard(BuildContext context, Project p) {
    final fee = p.contractorFeeAmount ?? 0;
    return _shell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(
              child: Text(p.title,
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 14)),
            ),
            const StatusBadge(
              label: 'Action needed',
              background: AppColors.warningSoft,
              foreground: AppColors.warning,
            ),
          ]),
          const SizedBox(height: 6),
          Text(
            'The homeowner has paid. Pay the ${Formatters.currency(fee)} '
            'commitment fee to claim this job and unlock chat.',
            style: const TextStyle(
                color: AppColors.textSecondary, fontSize: 12.5),
          ),
          const SizedBox(height: 12),
          AsyncPrimaryButton(
            label: 'Pay commitment fee',
            icon: Icons.verified_outlined,
            onPressed: () async => context.push('/contractor/commit/${p.id}'),
          ),
        ],
      ),
    );
  }

  Widget _activeCard(BuildContext context, WidgetRef ref, Project p) {
    return _shell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            Expanded(
              child: Text(p.title,
                  style: const TextStyle(
                      fontWeight: FontWeight.w700, fontSize: 14)),
            ),
            StatusBadge.forProject(p.status),
          ]),
          if (p.paidAt != null) ...[
            const SizedBox(height: 4),
            Text('Paid ${Formatters.relativeShort(p.paidAt)}',
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 12)),
          ],
          const SizedBox(height: 12),
          Row(children: [
            Expanded(
              child: OutlinedButton.icon(
                onPressed: () => context.push('/contractor/jobs/${p.id}'),
                icon: const Icon(Icons.open_in_new, size: 16),
                label: const Text('Open'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: AsyncPrimaryButton(
                label: 'Mark done',
                onPressed: () => _complete(context, ref, p),
              ),
            ),
          ]),
        ],
      ),
    );
  }

  Widget _completedCard(BuildContext context, Project p) {
    return _shell(
      child: Row(children: [
        Expanded(
          child: Text(p.title,
              style:
                  const TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        ),
        StatusBadge.forProject(p.status),
      ]),
    );
  }

  Future<void> _complete(
      BuildContext context, WidgetRef ref, Project p) async {
    final ok = await context.confirm(
      title: 'Mark completed?',
      message:
          'This marks the project complete and releases the escrow to your '
          'balance.',
      confirmLabel: 'Mark completed',
    );
    if (!ok) return;
    try {
      await ref.read(projectServiceProvider).markCompleted(p.id);
      ref.invalidate(contractorJobProjectsProvider);
      ref.invalidate(contractorBalanceProvider);
      if (context.mounted) context.snack('Job completed. Funds released!');
    } catch (e) {
      if (context.mounted) context.snack('Failed: $e', error: true);
    }
  }
}
