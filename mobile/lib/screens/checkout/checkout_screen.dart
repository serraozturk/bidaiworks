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

/// Homeowner checkout. The homeowner pays the full project amount plus a
/// protection hold; the funds are held in bidAI escrow. The project then
/// waits for the contractor to confirm by paying their commitment fee.
class CheckoutScreen extends ConsumerStatefulWidget {
  final String quoteId;
  const CheckoutScreen({super.key, required this.quoteId});

  @override
  ConsumerState<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends ConsumerState<CheckoutScreen> {
  final _cardNumber = TextEditingController(text: '4242 4242 4242 4242');
  final _exp = TextEditingController(text: '12/30');
  final _cvc = TextEditingController(text: '123');

  Quote? _quote;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _cardNumber.dispose();
    _exp.dispose();
    _cvc.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final q = await ref.read(quoteServiceProvider).byId(widget.quoteId);
      if (mounted) {
        setState(() {
          _quote = q;
          _loading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = '$e';
          _loading = false;
        });
      }
    }
  }

  num get _amount => _quote?.amount ?? 0;
  num get _protection => AppConstants.protectionHoldAmount;
  num get _total => _amount + _protection;

  Future<void> _pay() async {
    final q = _quote;
    if (q == null) return;
    final digits = _cardNumber.text.replaceAll(RegExp(r'\s+'), '');
    final last4 =
        digits.length >= 4 ? digits.substring(digits.length - 4) : null;
    try {
      await ref.read(paymentServiceProvider).homeownerPayProject(
            projectId: q.projectId,
            cardLast4: last4,
          );
      if (!mounted) return;
      ref.invalidate(myProjectsProvider);
      ref.invalidate(projectByIdProvider(q.projectId));
      context.snack(
        'Payment confirmed and held in escrow. The contractor now has 48 '
        'hours to confirm the job by paying their commitment fee.',
      );
      context.go('/homeowner/projects/${q.projectId}');
    } catch (e) {
      if (!mounted) return;
      context.snack('Payment failed: $e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Checkout')),
      body: _loading
          ? const LoadingView()
          : _error != null
              ? ErrorView(error: _error!, onRetry: _load)
              : _quote == null
                  ? const EmptyState(
                      icon: Icons.error_outline,
                      title: 'Checkout unavailable',
                      message: 'We could not load this deal. Go back and try again.',
                    )
                  : ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        _summaryCard(),
                        const SizedBox(height: 16),
                        _protectionNote(),
                        const SizedBox(height: 16),
                        Text('Payment method', style: context.text.titleMedium),
                        const SizedBox(height: 8),
                        _cardForm(),
                        const SizedBox(height: 24),
                        AsyncPrimaryButton(
                          label:
                              'Pay ${Formatters.currency(_total, withCents: true)}',
                          icon: Icons.lock_outline,
                          onPressed: _pay,
                        ),
                        const SizedBox(height: 12),
                        const Center(
                          child: Text(
                            'Test mode. Funds are held in bidAI escrow until the '
                            'project is completed.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                                color: AppColors.textSecondary, fontSize: 12),
                          ),
                        ),
                      ],
                    ),
    );
  }

  Widget _summaryCard() {
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
          const Text('Payment summary',
              style: TextStyle(
                  color: AppColors.textSecondary,
                  fontWeight: FontWeight.w700,
                  fontSize: 12)),
          const SizedBox(height: 10),
          _row('Project amount', Formatters.currency(_amount)),
          const SizedBox(height: 6),
          _row('bidAI protection hold', Formatters.currency(_protection)),
          if (_quote?.timelineDays != null) ...[
            const SizedBox(height: 6),
            _row('Timeline', '${_quote!.timelineDays} days'),
          ],
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 10),
            child: Divider(height: 1),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Total due today',
                  style: TextStyle(fontWeight: FontWeight.w800, fontSize: 15)),
              Text(Formatters.currency(_total),
                  style: const TextStyle(
                      fontSize: 26, fontWeight: FontWeight.w800)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _row(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: AppColors.textSecondary)),
        Text(value, style: const TextStyle(fontWeight: FontWeight.w700)),
      ],
    );
  }

  Widget _protectionNote() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.successSoft,
        borderRadius: BorderRadius.circular(14),
      ),
      child: const Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(Icons.shield_outlined, size: 20, color: AppColors.success),
          SizedBox(width: 10),
          Expanded(
            child: Text(
              'After you pay, the contractor confirms the job by paying their '
              'commitment fee. Direct chat opens once they commit — and if '
              'they do not confirm in time, you are refunded in full.',
              style: TextStyle(fontSize: 12.5, height: 1.4),
            ),
          ),
        ],
      ),
    );
  }

  Widget _cardForm() {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        children: [
          TextField(
            controller: _cardNumber,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Card number',
              prefixIcon: Icon(Icons.credit_card),
            ),
          ),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(
              child: TextField(
                controller: _exp,
                decoration: const InputDecoration(labelText: 'MM/YY'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: TextField(
                controller: _cvc,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'CVC'),
              ),
            ),
          ]),
        ],
      ),
    );
  }
}
