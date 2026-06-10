import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/formatters.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../widgets/layout/empty_state.dart';
import '../../widgets/layout/rating_row.dart';

class HomeownerReviewsScreen extends ConsumerWidget {
  const HomeownerReviewsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final svc = ref.watch(reviewServiceProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Your reviews')),
      body: FutureBuilder<List<Review>>(
        future: svc.myReviews(),
        builder: (_, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const LoadingView();
          }
          if (snap.hasError) return ErrorView(error: snap.error!);
          final list = snap.data ?? <Review>[];
          if (list.isEmpty) {
            return const EmptyState(
              icon: Icons.rate_review_outlined,
              title: 'No reviews yet',
              message:
                  'Reviews you leave for contractors after a project is completed will appear here.',
            );
          }
          return ListView.separated(
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
                        showCount: false,
                      ),
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
          );
        },
      ),
    );
  }
}
