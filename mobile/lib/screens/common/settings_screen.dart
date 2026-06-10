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

class SettingsScreen extends ConsumerStatefulWidget {
  const SettingsScreen({super.key});

  @override
  ConsumerState<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends ConsumerState<SettingsScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();
  bool _initialized = false;

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  void _initFrom(Profile p) {
    if (_initialized) return;
    _initialized = true;
    _name.text = p.fullName ?? '';
    _phone.text = p.phone ?? '';
  }

  @override
  Widget build(BuildContext context) {
    final profile = ref.watch(currentProfileProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: profile.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(error: e),
        data: (p) {
          if (p == null) {
            return const EmptyState(
              icon: Icons.error_outline,
              title: 'No profile',
              message: 'Please sign in again.',
            );
          }
          _initFrom(p);
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Center(
                child: AppAvatar(
                  url: p.avatarUrl,
                  fallbackInitials: p.initials,
                  size: 88,
                ),
              ),
              const SizedBox(height: 16),
              Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: p.role == UserRole.contractor
                        ? AppColors.contractorTint
                        : AppColors.homeownerTint,
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    p.role == UserRole.contractor ? 'Contractor' : 'Homeowner',
                    style: TextStyle(
                      color: p.role == UserRole.contractor
                          ? AppColors.contractorInk
                          : AppColors.homeownerInk,
                      fontWeight: FontWeight.w700,
                      fontSize: 12,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _name,
                decoration: const InputDecoration(
                    labelText: 'Full name',
                    prefixIcon: Icon(Icons.person_outline)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                    labelText: 'Phone',
                    prefixIcon: Icon(Icons.phone_outlined)),
              ),
              const SizedBox(height: 16),
              AsyncPrimaryButton(
                label: 'Save changes',
                onPressed: () async {
                  await ref.read(profileServiceProvider).updateProfile(
                        fullName: _name.text.trim(),
                        phone: _phone.text.trim(),
                      );
                  ref.invalidate(currentProfileProvider);
                  if (context.mounted) context.snack('Profile saved');
                },
              ),
              const SizedBox(height: 12),
              if (p.role == UserRole.homeowner)
                AsyncPrimaryButton(
                  label: 'My reviews',
                  outlined: true,
                  icon: Icons.star_outline,
                  onPressed: () async => context.push('/homeowner/reviews'),
                ),
              const SizedBox(height: 24),
              const Divider(),
              const SizedBox(height: 12),
              AsyncPrimaryButton(
                label: 'Sign out',
                destructive: true,
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
}
