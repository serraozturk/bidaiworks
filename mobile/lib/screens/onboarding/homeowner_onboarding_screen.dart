import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/extensions/context_extensions.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/providers.dart';
import '../../widgets/layout/primary_button.dart';

class HomeownerOnboardingScreen extends ConsumerStatefulWidget {
  const HomeownerOnboardingScreen({super.key});

  @override
  ConsumerState<HomeownerOnboardingScreen> createState() =>
      _HomeownerOnboardingScreenState();
}

class _HomeownerOnboardingScreenState
    extends ConsumerState<HomeownerOnboardingScreen> {
  final _name = TextEditingController();
  final _phone = TextEditingController();

  @override
  void initState() {
    super.initState();
    final p = ref.read(currentProfileProvider).valueOrNull;
    if (p?.fullName != null) _name.text = p!.fullName!;
    if (p?.phone != null) _phone.text = p!.phone!;
  }

  @override
  void dispose() {
    _name.dispose();
    _phone.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_name.text.trim().isEmpty) {
      context.snack('Please enter your name', error: true);
      return;
    }
    await ref.read(profileServiceProvider).updateProfile(
          fullName: _name.text.trim(),
          phone: _phone.text.trim(),
        );
    if (!mounted) return;
    ref.invalidate(currentProfileProvider);
    context.go('/homeowner/projects');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Welcome')),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("Tell us a bit about you", style: context.text.headlineMedium),
              const SizedBox(height: 6),
              Text(
                'This is what contractors will see when you message them.',
                style: context.text.bodyMedium
                    ?.copyWith(color: AppColors.textSecondary),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _name,
                decoration: const InputDecoration(
                  labelText: 'Full name',
                  prefixIcon: Icon(Icons.person_outline),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _phone,
                keyboardType: TextInputType.phone,
                decoration: const InputDecoration(
                  labelText: 'Phone (optional)',
                  prefixIcon: Icon(Icons.phone_outlined),
                ),
              ),
              const Spacer(),
              AsyncPrimaryButton(label: 'Continue', onPressed: _save),
              const SizedBox(height: 8),
              Center(
                child: TextButton(
                  onPressed: () => context.go('/homeowner/projects'),
                  child: const Text('Skip for now'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
