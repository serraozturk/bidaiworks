import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../widgets/layout/empty_state.dart';
import '../../widgets/layout/status_badge.dart';

class ContractorQuotesScreen extends ConsumerWidget {
  const ContractorQuotesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final quotes = ref.watch(myQuotesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('My quotes')),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(myQuotesProvider.future),
        child: quotes.when(
          loading: () => const LoadingView(),
          error: (e, _) => ErrorView(error: e),
          data: (list) {
            if (list.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 60),
                EmptyState(
                  icon: Icons.receipt_long_outlined,
                  title: 'No quotes yet',
                  message:
                      'Find a job in the Jobs tab and send your first quote.',
                ),
              ]);
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) => _QuoteRow(quote: list[i]),
            );
          },
        ),
      ),
    );
  }
}

class _QuoteRow extends StatelessWidget {
  final Quote quote;
  const _QuoteRow({required this.quote});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(14),
      onTap: () => context.push('/contractor/jobs/${quote.projectId}'),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(14),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(children: [
              Expanded(
                child: Text(Formatters.currency(quote.amount),
                    style: const TextStyle(
                        fontSize: 22, fontWeight: FontWeight.w800)),
              ),
              StatusBadge.forQuote(quote.status),
            ]),
            const SizedBox(height: 4),
            if (quote.timelineDays != null)
              Text('${quote.timelineDays}-day timeline',
                  style: const TextStyle(color: AppColors.textSecondary)),
            const SizedBox(height: 6),
            Text('Sent ${Formatters.relativeShort(quote.createdAt)}',
                style: const TextStyle(
                    color: AppColors.textTertiary, fontSize: 12)),
          ],
        ),
      ),
    );
  }
}
