import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../providers/providers.dart';
import '../../widgets/layout/empty_state.dart';
import '../../widgets/layout/rating_row.dart';

class ContractorReviewsScreen extends ConsumerWidget {
  const ContractorReviewsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentUserProvider);
    if (user == null) return const LoadingView();
    final reviews = ref.watch(reviewsForContractorProvider(user.id));
    return Scaffold(
      appBar: AppBar(title: const Text('Reviews of you')),
      body: reviews.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(error: e),
        data: (list) {
          if (list.isEmpty) {
            return const EmptyState(
              icon: Icons.star_outline,
              title: 'No reviews yet',
              message:
                  'Reviews appear here after homeowners mark their projects completed.',
            );
          }
          return RefreshIndicator(
            onRefresh: () async =>
                ref.refresh(reviewsForContractorProvider(user.id).future),
            child: ListView.separated(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              itemCount: list.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (_, i) {
                final r = list[i];
                return Container(
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
                        RatingRow(
                            rating: r.displayRating.toDouble(),
                            showCount: false),
                        const Spacer(),
                        Text(Formatters.relativeShort(r.createdAt),
                            style: const TextStyle(
                                color: AppColors.textTertiary, fontSize: 12)),
                      ]),
                      if (r.comment != null) ...[
                        const SizedBox(height: 6),
                        Text(r.comment!),
                      ],
                    ],
                  ),
                );
              },
            ),
          );
        },
      ),
    );
  }
}
