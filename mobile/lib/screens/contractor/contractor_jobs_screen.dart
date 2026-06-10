import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../core/utils/constants.dart';
import '../../providers/providers.dart';
import '../../widgets/cards/project_card.dart';
import '../../widgets/layout/app_avatar.dart';
import '../../widgets/layout/empty_state.dart';

class ContractorJobsScreen extends ConsumerStatefulWidget {
  const ContractorJobsScreen({super.key});

  @override
  ConsumerState<ContractorJobsScreen> createState() =>
      _ContractorJobsScreenState();
}

class _ContractorJobsScreenState extends ConsumerState<ContractorJobsScreen> {
  String? _categoryId;
  final _zip = TextEditingController();

  @override
  void dispose() {
    _zip.dispose();
    super.dispose();
  }

  void _apply() {
    ref.read(jobFeedFilterProvider.notifier).state = (
      categoryId: _categoryId,
      zip: _zip.text.trim().isEmpty ? null : _zip.text.trim(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final feed = ref.watch(jobFeedProvider);
    final cats = ref.watch(categoriesProvider);
    final profile = ref.watch(currentProfileProvider).valueOrNull;

    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(
          children: [
            const Text('Find work'),
            const SizedBox(width: 6),
            const Icon(Icons.engineering_outlined,
                size: 16, color: AppColors.contractorInk),
          ],
        ),
        actions: [
          IconButton(
            icon: AppAvatar(
              url: profile?.avatarUrl,
              fallbackInitials: profile?.initials ?? 'C',
              size: 32,
            ),
            onPressed: () => context.push('/settings'),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: TextField(
              controller: _zip,
              keyboardType: TextInputType.number,
              maxLength: 5,
              decoration: const InputDecoration(
                hintText: 'Filter by ZIP',
                prefixIcon: Icon(Icons.search),
                counterText: '',
              ),
              onSubmitted: (_) => _apply(),
            ),
          ),
          SizedBox(
            height: 48,
            child: cats.when(
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
              data: (list) => ListView.separated(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                scrollDirection: Axis.horizontal,
                itemCount: list.length + 1,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (_, i) {
                  if (i == 0) {
                    final selected = _categoryId == null;
                    return ChoiceChip(
                      label: const Text('All'),
                      selected: selected,
                      selectedColor: AppColors.primary,
                      labelStyle: TextStyle(
                          color: selected ? Colors.white : AppColors.textPrimary,
                          fontWeight: FontWeight.w600),
                      onSelected: (_) {
                        setState(() => _categoryId = null);
                        _apply();
                      },
                    );
                  }
                  final c = list[i - 1];
                  final selected = _categoryId == c.id;
                  return ChoiceChip(
                    label: Text(c.name),
                    selected: selected,
                    avatar: Icon(
                      IconData(CategoryIcons.code(c.icon),
                          fontFamily: 'MaterialIcons'),
                      size: 14,
                      color:
                          selected ? Colors.white : AppColors.textSecondary,
                    ),
                    selectedColor: AppColors.primary,
                    labelStyle: TextStyle(
                        color: selected ? Colors.white : AppColors.textPrimary,
                        fontWeight: FontWeight.w600),
                    onSelected: (_) {
                      setState(() => _categoryId = c.id);
                      _apply();
                    },
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: feed.when(
              loading: () => const LoadingView(),
              error: (e, _) => ErrorView(
                  error: e, onRetry: () => ref.invalidate(jobFeedProvider)),
              data: (list) {
                if (list.isEmpty) {
                  return const EmptyState(
                    icon: Icons.work_off_outlined,
                    title: 'No matching jobs right now',
                    message:
                        'Make sure your service categories and areas are set up in your profile.',
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async => ref.refresh(jobFeedProvider.future),
                  child: MasonryGridView.count(
                    padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
                    crossAxisCount: 2,
                    mainAxisSpacing: 12,
                    crossAxisSpacing: 12,
                    itemCount: list.length,
                    itemBuilder: (_, i) {
                      final p = list[i];
                      return ProjectCard(
                        project: p,
                        onTap: () =>
                            context.push('/contractor/jobs/${p.id}'),
                      );
                    },
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
