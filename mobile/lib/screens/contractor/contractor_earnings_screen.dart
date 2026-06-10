import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/extensions/context_extensions.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../widgets/layout/empty_state.dart';
import '../../widgets/layout/primary_button.dart';

class ContractorEarningsScreen extends ConsumerWidget {
  const ContractorEarningsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final balance = ref.watch(contractorBalanceProvider);
    final payments = ref.watch(contractorPaymentsProvider);
    final withdrawals = ref.watch(myWithdrawalsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Earnings')),
      body: RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(contractorBalanceProvider);
          ref.invalidate(contractorPaymentsProvider);
          ref.invalidate(myWithdrawalsProvider);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            balance.when(
              loading: () => const LoadingView(),
              error: (e, _) => ErrorView(error: e),
              data: (b) => _BalanceCard(
                balance: b,
                onWithdraw: () => _withdrawSheet(context, ref, b.available),
              ),
            ),
            const SizedBox(height: 24),
            Text('Payments received', style: context.text.titleMedium),
            const SizedBox(height: 8),
            payments.when(
              loading: () => const LoadingView(),
              error: (e, _) => ErrorView(error: e),
              data: (list) {
                if (list.isEmpty) {
                  return const EmptyState(
                    icon: Icons.payments_outlined,
                    title: 'Nothing yet',
                    message:
                        'Once a homeowner pays a deposit on a project you\'ve been awarded, it shows up here.',
                  );
                }
                return Column(
                  children: list
                      .map((p) => _PaymentTile(payment: p))
                      .toList(),
                );
              },
            ),
            const SizedBox(height: 24),
            Text('Withdrawals', style: context.text.titleMedium),
            const SizedBox(height: 8),
            withdrawals.when(
              loading: () => const LoadingView(),
              error: (e, _) => ErrorView(error: e),
              data: (list) {
                if (list.isEmpty) {
                  return const EmptyState(
                    icon: Icons.account_balance_outlined,
                    title: 'No withdrawals yet',
                    message: 'Move released funds to your bank when ready.',
                  );
                }
                return Column(
                  children: list.map((w) => _WithdrawalTile(w: w)).toList(),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _withdrawSheet(
      BuildContext context, WidgetRef ref, num available) async {
    final amount = TextEditingController(
        text: available > 0 ? available.toStringAsFixed(2) : '');
    final bank = TextEditingController();
    final routing = TextEditingController();
    final account = TextEditingController();

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
              Text('Request withdrawal',
                  style: Theme.of(ctx).textTheme.titleLarge),
              const SizedBox(height: 4),
              Text(
                'Available: ${Formatters.currency(available, withCents: true)}',
                style: const TextStyle(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: amount,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Amount',
                  prefixText: '\$ ',
                ),
              ),
              const SizedBox(height: 8),
              TextField(
                controller: bank,
                decoration: const InputDecoration(labelText: 'Bank name'),
              ),
              const SizedBox(height: 8),
              Row(children: [
                Expanded(
                  child: TextField(
                    controller: routing,
                    keyboardType: TextInputType.number,
                    maxLength: 4,
                    decoration: const InputDecoration(
                        labelText: 'Routing last 4', counterText: ''),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: TextField(
                    controller: account,
                    keyboardType: TextInputType.number,
                    maxLength: 4,
                    decoration: const InputDecoration(
                        labelText: 'Account last 4', counterText: ''),
                  ),
                ),
              ]),
              const SizedBox(height: 16),
              AsyncPrimaryButton(
                label: 'Request',
                onPressed: () async {
                  final amt = num.tryParse(amount.text.trim());
                  if (amt == null || amt <= 0) {
                    context.snack('Enter a valid amount', error: true);
                    return;
                  }
                  if (amt > available) {
                    context.snack('Amount exceeds available balance',
                        error: true);
                    return;
                  }
                  if (bank.text.trim().isEmpty ||
                      routing.text.length < 4 ||
                      account.text.length < 4) {
                    context.snack('All bank fields are required',
                        error: true);
                    return;
                  }
                  try {
                    await ref.read(paymentServiceProvider).requestWithdrawal(
                          amount: amt,
                          bankName: bank.text.trim(),
                          routingLast4: routing.text.trim(),
                          accountLast4: account.text.trim(),
                        );
                    if (!context.mounted) return;
                    ref.invalidate(myWithdrawalsProvider);
                    ref.invalidate(contractorBalanceProvider);
                    Navigator.of(ctx).pop();
                    context.snack('Withdrawal requested.');
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
}

class _BalanceCard extends StatelessWidget {
  final ContractorBalance balance;
  final VoidCallback onWithdraw;

  const _BalanceCard({required this.balance, required this.onWithdraw});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.primaryDark],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Available to withdraw',
              style: TextStyle(color: Color(0xCCFFFFFF), fontSize: 13)),
          const SizedBox(height: 4),
          Text(
            Formatters.currency(balance.available, withCents: true),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 36,
              fontWeight: FontWeight.w800,
            ),
          ),
          const SizedBox(height: 12),
          Row(children: [
            _stat('In escrow', balance.held),
            const SizedBox(width: 16),
            _stat('Lifetime', balance.released),
            const SizedBox(width: 16),
            _stat('Withdrawn', balance.withdrawn),
          ]),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: balance.available > 0 ? onWithdraw : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: AppColors.primary,
                disabledBackgroundColor: Colors.white.withOpacity(0.5),
              ),
              child: const Text('Withdraw'),
            ),
          ),
        ],
      ),
    );
  }

  Widget _stat(String label, num amount) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label,
              style: const TextStyle(color: Color(0xAAFFFFFF), fontSize: 11)),
          const SizedBox(height: 2),
          Text(
            Formatters.currency(amount),
            style: const TextStyle(
                color: Colors.white, fontWeight: FontWeight.w700),
          ),
        ],
      ),
    );
  }
}

class _PaymentTile extends StatelessWidget {
  final Payment payment;
  const _PaymentTile({required this.payment});

  @override
  Widget build(BuildContext context) {
    final isReleased = payment.status == PaymentStatus.released;
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(children: [
        Icon(isReleased ? Icons.check_circle : Icons.lock_clock,
            color: isReleased ? AppColors.success : AppColors.warning),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                  isReleased
                      ? Formatters.currency(payment.totalAmount,
                          withCents: true)
                      : '${Formatters.currency(payment.depositAmount, withCents: true)} held',
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              Text(
                isReleased
                    ? 'Released ${Formatters.relativeShort(payment.releasedAt)}'
                    : 'Held since ${Formatters.relativeShort(payment.heldAt)}',
                style: const TextStyle(
                    color: AppColors.textSecondary, fontSize: 12),
              ),
            ],
          ),
        ),
      ]),
    );
  }
}

class _WithdrawalTile extends StatelessWidget {
  final Withdrawal w;
  const _WithdrawalTile({required this.w});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(children: [
        const Icon(Icons.account_balance, color: AppColors.primary),
        const SizedBox(width: 10),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(Formatters.currency(w.amount, withCents: true),
                  style: const TextStyle(fontWeight: FontWeight.w700)),
              Text(
                  'To ${w.bankName ?? '—'} •••• ${w.accountLast4 ?? '----'} · ${w.status.name}',
                  style: const TextStyle(
                      color: AppColors.textSecondary, fontSize: 12)),
            ],
          ),
        ),
      ]),
    );
  }
}
