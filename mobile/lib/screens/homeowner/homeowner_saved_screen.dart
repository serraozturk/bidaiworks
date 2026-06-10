import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../providers/providers.dart';
import '../../services/contractor_service.dart';
import '../../widgets/cards/contractor_card.dart';
import '../../widgets/layout/empty_state.dart';

class HomeownerSavedScreen extends ConsumerWidget {
  const HomeownerSavedScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ids = ref.watch(savedContractorIdsProvider);
    final all = ref.watch(contractorBrowseProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Saved contractors')),
      body: ids.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(error: e),
        data: (saved) {
          if (saved.isEmpty) {
            return const EmptyState(
              icon: Icons.favorite_border,
              title: 'Nothing saved yet',
              message:
                  'Tap the heart on any contractor card to save them for later.',
            );
          }
          return all.when(
            loading: () => const LoadingView(),
            error: (e, _) => ErrorView(error: e),
            data: (rows) {
              final filtered = <ContractorBrowseRow>[
                for (final r in rows)
                  if (saved.contains(r.profile.userId)) r
              ];
              if (filtered.isEmpty) {
                return const EmptyState(
                  icon: Icons.favorite_border,
                  title: 'No matches in your area',
                  message:
                      'Some saved contractors may not be visible right now. Pull to refresh.',
                );
              }
              return RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(savedContractorIdsProvider);
                  ref.invalidate(contractorBrowseProvider);
                },
                child: ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
                  itemCount: filtered.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 10),
                  itemBuilder: (_, i) => ContractorCard(
                    row: filtered[i],
                    saved: true,
                    onTap: () => context.push(
                        '/homeowner/contractors/${filtered[i].profile.userId}'),
                    onSavedToggle: () async {
                      await ref
                          .read(contractorServiceProvider)
                          .savedToggle(filtered[i].profile.userId, false);
                      ref.invalidate(savedContractorIdsProvider);
                    },
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
