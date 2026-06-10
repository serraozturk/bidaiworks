import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_staggered_grid_view/flutter_staggered_grid_view.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../widgets/cards/project_card.dart';
import '../../widgets/layout/app_avatar.dart';
import '../../widgets/layout/empty_state.dart';

class HomeownerProjectsScreen extends ConsumerWidget {
  const HomeownerProjectsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final projects = ref.watch(myProjectsProvider);
    final profile = ref.watch(currentProfileProvider).valueOrNull;
    return Scaffold(
      appBar: AppBar(
        titleSpacing: 16,
        title: Row(
          children: [
            const Text('Your projects'),
            const SizedBox(width: 6),
            const Icon(Icons.home_outlined,
                size: 16, color: AppColors.homeownerInk),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Settings',
            icon: AppAvatar(
              url: profile?.avatarUrl,
              fallbackInitials: profile?.initials ?? 'H',
              size: 32,
            ),
            onPressed: () => context.push('/settings'),
          ),
          const SizedBox(width: 8),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: () async => ref.refresh(myProjectsProvider.future),
        child: projects.when(
          loading: () => const LoadingView(),
          error: (e, _) => ErrorView(
            error: e,
            onRetry: () => ref.invalidate(myProjectsProvider),
          ),
          data: (list) {
            if (list.isEmpty) {
              return ListView(children: const [
                SizedBox(height: 60),
                EmptyState(
                  icon: Icons.dashboard_outlined,
                  title: 'No projects yet',
                  message:
                      'Post your first renovation project and contractors will start sending quotes.',
                ),
              ]);
            }
            return MasonryGridView.count(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              itemCount: list.length,
              itemBuilder: (_, i) {
                final p = list[i];
                return ProjectCard(
                  project: p,
                  onTap: () => context.push('/homeowner/projects/${p.id}'),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
