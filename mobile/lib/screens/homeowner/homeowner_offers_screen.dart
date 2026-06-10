import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/extensions/context_extensions.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../widgets/layout/empty_state.dart';
import '../../widgets/layout/status_badge.dart';

class HomeownerOffersScreen extends ConsumerWidget {
  const HomeownerOffersScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final offers = ref.watch(homeownerIncomingOffersProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Offers')),
      body: RefreshIndicator(
        onRefresh: () async =>
            ref.refresh(homeownerIncomingOffersProvider.future),
        child: offers.when(
          loading: () => const LoadingView(),
          error: (e, _) => ErrorView(error: e),
          data: (list) {
            if (list.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 60),
                EmptyState(
                  icon: Icons.local_offer_outlined,
                  title: 'No offers yet',
                  message:
                      'Quick offers from contractors will show up here. Compare them side-by-side before you decide.',
                ),
              ]);
            }
            return ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final o = list[i];
                return Container(
                  decoration: BoxDecoration(
                    color: AppColors.surface,
                    border: Border.all(color: AppColors.border),
                    borderRadius: BorderRadius.circular(14),
                  ),
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                              color: AppColors.contractorTint,
                              borderRadius: BorderRadius.circular(6)),
                          child: Text(EnumCodec.offerKindLabel(o.kind),
                              style: const TextStyle(
                                  color: AppColors.contractorInk,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 11)),
                        ),
                        const Spacer(),
                        StatusBadge.forOffer(o.status),
                      ]),
                      const SizedBox(height: 10),
                      Text(Formatters.currency(o.amount),
                          style: const TextStyle(
                              fontSize: 22, fontWeight: FontWeight.w800)),
                      if (o.timelineDays != null)
                        Text('${o.timelineDays}-day timeline',
                            style: const TextStyle(
                                color: AppColors.textSecondary)),
                      if (o.scopeSummary != null) ...[
                        const SizedBox(height: 6),
                        Text(o.scopeSummary!,
                            style: const TextStyle(
                                color: AppColors.textSecondary)),
                      ],
                      const SizedBox(height: 10),
                      Row(children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () => context
                                .push('/homeowner/projects/${o.projectId}'),
                            child: const Text('Open project'),
                          ),
                        ),
                        if (o.conversationId != null) ...[
                          const SizedBox(width: 8),
                          Expanded(
                            child: ElevatedButton.icon(
                              onPressed: () => context
                                  .push('/messages/${o.conversationId}'),
                              icon: const Icon(Icons.chat_bubble_outline,
                                  size: 16),
                              label: const Text('Reply'),
                            ),
                          ),
                        ],
                      ]),
                    ],
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
