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

class ProjectCompareScreen extends ConsumerWidget {
  final String projectId;
  const ProjectCompareScreen({super.key, required this.projectId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quotes = ref.watch(quotesForProjectProvider(projectId));
    return Scaffold(
      appBar: AppBar(title: const Text('Compare quotes')),
      body: quotes.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(error: e),
        data: (qs) {
          if (qs.length < 2) {
            return const EmptyState(
              icon: Icons.compare_arrows,
              title: 'Need at least two quotes',
              message: 'Compare opens up once you have multiple quotes.',
            );
          }
          final maxAmt = qs.map((q) => q.amount).reduce((a, b) => a > b ? a : b);
          return SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: ConstrainedBox(
              constraints: BoxConstraints(
                  minWidth: MediaQuery.of(context).size.width),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: qs
                    .map((q) => SizedBox(
                          width: 280,
                          child: Padding(
                            padding: const EdgeInsets.all(12),
                            child: _QuoteCompareCard(
                              quote: q,
                              maxAmount: maxAmt,
                              onAccept: () async {
                                final ok = await context.confirm(
                                  title: 'Accept this quote?',
                                  message:
                                      'This locks the project. All other quotes are rejected.',
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
                                    context.snack('Failed: $e', error: true);
                                  }
                                }
                              },
                            ),
                          ),
                        ))
                    .toList(),
              ),
            ),
          );
        },
      ),
    );
  }
}

class _QuoteCompareCard extends StatelessWidget {
  final Quote quote;
  final num maxAmount;
  final Future<void> Function() onAccept;

  const _QuoteCompareCard({
    required this.quote,
    required this.maxAmount,
    required this.onAccept,
  });

  @override
  Widget build(BuildContext context) {
    final pct = maxAmount == 0 ? 0.0 : (quote.amount / maxAmount).toDouble();
    final cp = quote.contractor;
    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(16),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            AppAvatar(
              url: cp?.logoUrl,
              fallbackInitials: (cp?.companyName.isNotEmpty ?? false)
                  ? cp!.companyName.substring(0, 1).toUpperCase()
                  : '?',
              size: 36,
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(cp?.companyName ?? 'Contractor',
                  style: const TextStyle(fontWeight: FontWeight.w700)),
            ),
          ]),
          const SizedBox(height: 6),
          if (cp != null)
            RatingRow(rating: cp.ratingAvg, count: cp.ratingCount, size: 12),
          const SizedBox(height: 12),
          Text(Formatters.currency(quote.amount),
              style: const TextStyle(
                  fontSize: 28, fontWeight: FontWeight.w800)),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(99),
            child: LinearProgressIndicator(
              value: pct.clamp(0.0, 1.0),
              backgroundColor: AppColors.surfaceAlt,
              minHeight: 6,
              valueColor: const AlwaysStoppedAnimation(AppColors.primary),
            ),
          ),
          const SizedBox(height: 12),
          if (quote.timelineDays != null)
            _row('Timeline', '${quote.timelineDays} days'),
          if (quote.includedScope != null)
            _row('Included', quote.includedScope!),
          if (quote.excludedScope != null)
            _row('Excluded', quote.excludedScope!),
          if (quote.notes != null) _row('Notes', quote.notes!),
          if (quote.message != null) _row('Cover note', quote.message!),
          const SizedBox(height: 12),
          if (quote.status == QuoteStatus.pending)
            AsyncPrimaryButton(label: 'Accept', onPressed: onAccept),
        ],
      ),
    );
  }

  Widget _row(String label, String value) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
          Text(label,
              style: const TextStyle(
                  color: AppColors.textTertiary,
                  fontSize: 11,
                  fontWeight: FontWeight.w600)),
          Text(value,
              style: const TextStyle(fontSize: 13, height: 1.35)),
        ]),
      );
}
