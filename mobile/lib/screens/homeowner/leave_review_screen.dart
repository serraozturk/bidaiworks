import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_rating_bar/flutter_rating_bar.dart';
import 'package:go_router/go_router.dart';

import '../../core/extensions/context_extensions.dart';
import '../../core/theme/app_colors.dart';
import '../../providers/providers.dart';
import '../../widgets/layout/empty_state.dart';
import '../../widgets/layout/primary_button.dart';

class LeaveReviewScreen extends ConsumerStatefulWidget {
  final String projectId;
  const LeaveReviewScreen({super.key, required this.projectId});

  @override
  ConsumerState<LeaveReviewScreen> createState() => _LeaveReviewScreenState();
}

class _LeaveReviewScreenState extends ConsumerState<LeaveReviewScreen> {
  int _overall = 5;
  int _quality = 5;
  int _comm = 5;
  int _punct = 5;
  int _value = 5;
  final _comment = TextEditingController();
  String? _contractorId;

  @override
  void dispose() {
    _comment.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final project = ref.watch(projectByIdProvider(widget.projectId));
    final quotes = ref.watch(quotesForProjectProvider(widget.projectId));

    return Scaffold(
      appBar: AppBar(title: const Text('Leave a review')),
      body: project.when(
        loading: () => const LoadingView(),
        error: (e, _) => ErrorView(error: e),
        data: (p) {
          if (p == null) {
            return const EmptyState(
                icon: Icons.error_outline,
                title: 'Project not found',
                message: 'Cannot leave a review.');
          }
          // Pre-fill contractor from awarded/accepted quote
          quotes.whenData((qs) {
            if (_contractorId == null) {
              final accepted =
                  qs.where((q) => q.status.name == 'accepted').toList();
              if (accepted.isNotEmpty) {
                _contractorId = accepted.first.contractorId;
              }
            }
          });

          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Text(p.title, style: context.text.headlineMedium),
              const SizedBox(height: 4),
              Text('How did it go?',
                  style: context.text.bodyMedium
                      ?.copyWith(color: AppColors.textSecondary)),
              const SizedBox(height: 24),
              _starsRow(
                  'Overall', _overall, (v) => setState(() => _overall = v)),
              _starsRow('Work quality', _quality,
                  (v) => setState(() => _quality = v)),
              _starsRow('Communication', _comm,
                  (v) => setState(() => _comm = v)),
              _starsRow('Punctuality', _punct,
                  (v) => setState(() => _punct = v)),
              _starsRow('Value', _value,
                  (v) => setState(() => _value = v)),
              const SizedBox(height: 16),
              TextField(
                controller: _comment,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Tell others how it went (optional)',
                ),
              ),
              const SizedBox(height: 24),
              AsyncPrimaryButton(
                label: 'Submit review',
                icon: Icons.send,
                onPressed: () async {
                  if (_contractorId == null) {
                    context.snack('No contractor on this project',
                        error: true);
                    return;
                  }
                  try {
                    await ref.read(reviewServiceProvider).create(
                          projectId: p.id,
                          contractorId: _contractorId!,
                          overall: _overall,
                          workQuality: _quality,
                          communication: _comm,
                          punctuality: _punct,
                          value: _value,
                          comment: _comment.text.trim().isEmpty
                              ? null
                              : _comment.text.trim(),
                        );
                    if (!mounted) return;
                    context.snack('Thanks for the review!');
                    context.pop();
                  } catch (e) {
                    if (!mounted) return;
                    context.snack('Failed: $e', error: true);
                  }
                },
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _starsRow(String label, int value, ValueChanged<int> onChange) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(child: Text(label, style: context.text.titleSmall)),
          RatingBar.builder(
            initialRating: value.toDouble(),
            allowHalfRating: false,
            itemCount: 5,
            itemSize: 28,
            unratedColor: AppColors.surfaceAlt,
            itemBuilder: (_, __) =>
                const Icon(Icons.star, color: AppColors.star),
            onRatingUpdate: (v) => onChange(v.toInt()),
          ),
        ],
      ),
    );
  }
}
