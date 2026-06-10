import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/extensions/context_extensions.dart';
import '../../core/theme/app_colors.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../widgets/layout/app_avatar.dart';
import '../../widgets/layout/empty_state.dart';
import '../../widgets/layout/primary_button.dart';
import '../../widgets/layout/rating_row.dart';

class ContractorProfileScreen extends ConsumerWidget {
  const ContractorProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(currentProfileProvider).valueOrNull;
    final user = ref.watch(currentUserProvider);
    if (user == null) return const LoadingView();

    return Scaffold(
      appBar: AppBar(
        title: const Text('My business'),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings_outlined),
            onPressed: () => context.push('/settings'),
          ),
        ],
      ),
      body: FutureBuilder<ContractorProfile?>(
        future: ref.read(profileServiceProvider).fetchContractorProfile(user.id),
        builder: (_, snap) {
          if (snap.connectionState != ConnectionState.done) {
            return const LoadingView();
          }
          final cp = snap.data;
          if (cp == null) {
            return EmptyState(
              icon: Icons.engineering_outlined,
              title: 'Set up your business',
              message:
                  'Complete your business profile to start receiving project leads.',
              cta: 'Set up now',
              onCtaTap: () => context.push('/onboarding/contractor'),
            );
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(children: [
                AppAvatar(
                  url: cp.logoUrl ?? profile?.avatarUrl,
                  fallbackInitials: cp.companyName.isNotEmpty
                      ? cp.companyName.substring(0, 1).toUpperCase()
                      : 'C',
                  size: 56,
                  ring: cp.verified,
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(children: [
                        Expanded(
                          child: Text(cp.companyName,
                              style: context.text.headlineMedium),
                        ),
                        if (cp.verified)
                          const Icon(Icons.verified,
                              color: AppColors.primary, size: 18),
                      ]),
                      const SizedBox(height: 4),
                      RatingRow(rating: cp.ratingAvg, count: cp.ratingCount),
                    ],
                  ),
                ),
              ]),
              if (cp.bio != null) ...[
                const SizedBox(height: 16),
                Text(cp.bio!),
              ],
              const SizedBox(height: 24),
              _navTile(
                icon: Icons.account_balance_wallet_outlined,
                title: 'Earnings & withdrawals',
                onTap: () => context.push('/contractor/earnings'),
              ),
              _navTile(
                icon: Icons.star_outline,
                title: 'My reviews',
                onTap: () => context.push('/contractor/reviews'),
              ),
              _navTile(
                icon: Icons.edit_outlined,
                title: 'Edit business profile',
                onTap: () => context.push('/onboarding/contractor'),
              ),
              const SizedBox(height: 24),
              AsyncPrimaryButton(
                label: 'Sign out',
                outlined: true,
                onPressed: () async {
                  await ref.read(authServiceProvider).signOut();
                  ref.invalidate(currentProfileProvider);
                  if (context.mounted) context.go('/login');
                },
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _navTile(
      {required IconData icon,
      required String title,
      required VoidCallback onTap}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: AppColors.surface,
        border: Border.all(color: AppColors.border),
        borderRadius: BorderRadius.circular(12),
      ),
      child: ListTile(
        leading: Icon(icon, color: AppColors.primary),
        title: Text(title),
        trailing: const Icon(Icons.chevron_right),
        onTap: onTap,
      ),
    );
  }
}
