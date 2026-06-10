import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/extensions/context_extensions.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/constants.dart';
import '../../providers/providers.dart';
import '../../widgets/cards/contractor_card.dart';
import '../../widgets/layout/empty_state.dart';

class ContractorBrowseScreen extends ConsumerStatefulWidget {
  const ContractorBrowseScreen({super.key});

  @override
  ConsumerState<ContractorBrowseScreen> createState() =>
      _ContractorBrowseScreenState();
}

class _ContractorBrowseScreenState
    extends ConsumerState<ContractorBrowseScreen> {
  final _zip = TextEditingController();
  String? _categoryId;

  @override
  void dispose() {
    _zip.dispose();
    super.dispose();
  }

  void _applyFilter() {
    ref.read(contractorBrowseFilterProvider.notifier).state = (
      categoryId: _categoryId,
      zip: _zip.text.trim().isEmpty ? null : _zip.text.trim(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cats = ref.watch(categoriesProvider);
    final list = ref.watch(contractorBrowseProvider);
    final saved = ref.watch(savedContractorIdsProvider).valueOrNull ?? [];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Discover contractors'),
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: Row(children: [
              Expanded(
                child: TextField(
                  controller: _zip,
                  keyboardType: TextInputType.number,
                  maxLength: 5,
                  decoration: const InputDecoration(
                    hintText: 'ZIP',
                    prefixIcon: Icon(Icons.search),
                    counterText: '',
                  ),
                  onSubmitted: (_) => _applyFilter(),
                ),
              ),
              const SizedBox(width: 8),
              FilledButton(
                onPressed: _applyFilter,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  minimumSize: const Size(56, 52),
                ),
                child: const Icon(Icons.tune),
              ),
            ]),
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
                        fontWeight: FontWeight.w600,
                      ),
                      onSelected: (_) {
                        setState(() => _categoryId = null);
                        _applyFilter();
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
                      fontWeight: FontWeight.w600,
                    ),
                    onSelected: (_) {
                      setState(() => _categoryId = c.id);
                      _applyFilter();
                    },
                  );
                },
              ),
            ),
          ),
          const SizedBox(height: 8),
          Expanded(
            child: list.when(
              loading: () => const LoadingView(),
              error: (e, _) => ErrorView(
                error: e,
                onRetry: () => ref.invalidate(contractorBrowseProvider),
              ),
              data: (rows) {
                if (rows.isEmpty) {
                  return const EmptyState(
                    icon: Icons.search_off,
                    title: 'No matches',
                    message:
                        'Try removing the ZIP filter or pick a different category.',
                  );
                }
                return RefreshIndicator(
                  onRefresh: () async =>
                      ref.refresh(contractorBrowseProvider.future),
                  child: ListView.separated(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                    itemCount: rows.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (_, i) {
                      final r = rows[i];
                      final isSaved = saved.contains(r.profile.userId);
                      return ContractorCard(
                        row: r,
                        saved: isSaved,
                        onTap: () => context
                            .push('/homeowner/contractors/${r.profile.userId}'),
                        onSavedToggle: () async {
                          await ref
                              .read(contractorServiceProvider)
                              .savedToggle(r.profile.userId, !isSaved);
                          ref.invalidate(savedContractorIdsProvider);
                          if (context.mounted) {
                            context.snack(isSaved
                                ? 'Removed from saved'
                                : 'Saved for later');
                          }
                        },
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
