import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/extensions/context_extensions.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/constants.dart';
import '../../core/utils/formatters.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../widgets/layout/empty_state.dart';
import '../../widgets/layout/primary_button.dart';

/// Contractor commitment payment. After the homeowner pays, the awarded
/// contractor pays the 8% commitment fee here to claim the job — which
/// activates the project and unlocks direct chat.
class ContractorCommitScreen extends ConsumerWidget {
  final String projectId;
  const ContractorCommitScreen({super.key, required this.projectId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projectAsync = ref.watch(projectByIdProvider(projectId));

    return Scaffold(
      appBar: AppBar(title: const Text('Claim this job')),
      body: projectAsync.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(error: e),
        data: (project) {
          if (project == null) {
            return const EmptyState(
              icon: Icons.error_outline,
              title: 'Job not found',
              message: 'This job could not be loaded.',
            );
          }

          if (project.status == ProjectStatus.inProgress ||
              project.status == ProjectStatus.completed) {
            return _result(
              context,
              icon: Icons.check_circle_outline,
              color: AppColors.success,
              title: 'This job is already active',
              message:
                  'You have committed to this job. It is active and direct '
                  'chat with the homeowner is open.',
              actionLabel: 'Open the job',
              onAction: () => context.go('/contractor/jobs/$projectId'),
            );
          }

          if (!project.awaitingContractorCommitment) {
            return _result(
              context,
              icon: Icons.info_outline,
              color: AppColors.warning,
              title: 'No commitment payment needed',
              message:
                  'This job is not waiting for a commitment payment right '
                  'now. It may have been re-opened or cancelled.',
              actionLabel: 'Back to jobs',
              onAction: () => context.go('/contractor/projects'),
            );
          }

          final due = project.contractorCommitDueAt;
          final expired = due != null && due.isBefore(DateTime.now());
          if (expired) {
            return _result(
              context,
              icon: Icons.timer_off_outlined,
              color: AppColors.warning,
              title: 'Commitment window expired',
              message:
                  'The 48-hour window to claim this job has passed. It has '
                  'been re-opened so the homeowner can choose another '
                  'contractor.',
              actionLabel: 'Back to jobs',
              onAction: () => context.go('/contractor/projects'),
            );
          }

          final fee = (project.contractorFeeAmount ?? 0).toDouble();
          final amount = fee > 0
              ? fee / AppConstants.commitmentFeePct
              : 0.0;
          final payout = amount - fee;
          final hoursLeft =
              due == null ? null : due.difference(DateTime.now()).inHours;

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.warningSoft,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(project.title,
                        style: const TextStyle(
                            fontWeight: FontWeight.w800, fontSize: 16)),
                    const SizedBox(height: 6),
                    Text(
                      'The homeowner has paid. Pay your commitment fee to '
                      'confirm this job, unlock direct chat and start work.'
                      '${hoursLeft != null ? ' About $hoursLeft hour${hoursLeft == 1 ? '' : 's'} left before it re-opens to other contractors.' : ''}',
                      style: const TextStyle(
                          fontSize: 12.5, height: 1.4),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  border: Border.all(color: AppColors.border),
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  children: [
                    _row('Project amount (held in escrow)',
                        Formatters.currency(amount)),
                    const SizedBox(height: 8),
                    _row('Your payout after completion',
                        Formatters.currency(payout)),
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 10),
                      child: Divider(height: 1),
                    ),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Commitment fee due now',
                            style: TextStyle(
                                fontWeight: FontWeight.w800, fontSize: 15)),
                        Text(Formatters.currency(fee),
                            style: const TextStyle(
                                fontSize: 24, fontWeight: FontWeight.w800)),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
              AsyncPrimaryButton(
                label: 'Pay ${Formatters.currency(fee, withCents: true)} & claim job',
                icon: Icons.verified_outlined,
                onPressed: () => _pay(context, ref),
              ),
              const SizedBox(height: 12),
              const Center(
                child: Text(
                  'Test mode. Paying the commitment fee activates the job '
                  'and unlocks direct chat with the homeowner.',
                  textAlign: TextAlign.center,
                  style:
                      TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _pay(BuildContext context, WidgetRef ref) async {
    try {
      await ref.read(paymentServiceProvider).contractorPayCommitment(projectId);
      ref.invalidate(projectByIdProvider(projectId));
      ref.invalidate(contractorJobProjectsProvider);
      ref.invalidate(contractorBalanceProvider);
      if (!context.mounted) return;
      context.snack('Commitment fee paid. The job is now active.');
      context.go('/contractor/jobs/$projectId');
    } catch (e) {
      if (!context.mounted) return;
      context.snack('Payment failed: $e', error: true);
    }
  }

  Widget _row(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Expanded(
          child: Text(label,
              style: const TextStyle(color: AppColors.textSecondary)),
        ),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      ],
    );
  }

  Widget _result(
    BuildContext context, {
    required IconData icon,
    required Color color,
    required String title,
    required String message,
    required String actionLabel,
    required VoidCallback onAction,
  }) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 56, color: color),
            const SizedBox(height: 16),
            Text(title,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 18, fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
            Text(message,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: onAction,
              child: Text(actionLabel),
            ),
          ],
        ),
      ),
    );
  }
}
