import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/extensions/context_extensions.dart';
import '../../providers/providers.dart';
import '../../widgets/layout/empty_state.dart';
import '../../widgets/layout/primary_button.dart';

class QuoteComposeScreen extends ConsumerStatefulWidget {
  final String projectId;
  const QuoteComposeScreen({super.key, required this.projectId});

  @override
  ConsumerState<QuoteComposeScreen> createState() => _QuoteComposeScreenState();
}

class _QuoteComposeScreenState extends ConsumerState<QuoteComposeScreen> {
  final _form = GlobalKey<FormState>();
  final _amount = TextEditingController();
  final _timeline = TextEditingController();
  final _message = TextEditingController();
  final _included = TextEditingController();
  final _excluded = TextEditingController();
  final _notes = TextEditingController();

  @override
  void dispose() {
    _amount.dispose();
    _timeline.dispose();
    _message.dispose();
    _included.dispose();
    _excluded.dispose();
    _notes.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_form.currentState!.validate()) return;
    try {
      final me = ref.read(currentUserProvider);
      final quote = await ref.read(quoteServiceProvider).create(
            projectId: widget.projectId,
            amount: num.parse(_amount.text.trim()),
            timelineDays: int.tryParse(_timeline.text.trim()),
            message: _message.text.trim().isEmpty
                ? null
                : _message.text.trim(),
            includedScope: _included.text.trim().isEmpty
                ? null
                : _included.text.trim(),
            excludedScope: _excluded.text.trim().isEmpty
                ? null
                : _excluded.text.trim(),
            notes: _notes.text.trim().isEmpty ? null : _notes.text.trim(),
          );

      // Auto-post a quote_card into the conversation if one exists
      try {
        final project =
            await ref.read(projectServiceProvider).byId(widget.projectId);
        if (project != null && me != null) {
          final conv =
              await ref.read(messageServiceProvider).ensureConversation(
                    projectId: project.id,
                    homeownerId: project.homeownerId,
                    contractorId: me.id,
                  );
          await ref.read(messageServiceProvider).postQuoteCard(
                conversationId: conv.id,
                quoteId: quote.id,
                summary: 'Sent a quote — \$${quote.amount}',
              );
        }
      } catch (_) {}

      if (!mounted) return;
      ref.invalidate(myQuotesProvider);
      ref.invalidate(quotesForProjectProvider(widget.projectId));
      context.snack('Quote sent to the homeowner.');
      context.pop();
    } catch (e) {
      if (!mounted) return;
      context.snack('Failed to send: $e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Send formal quote')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            TextFormField(
              controller: _amount,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Total price (USD)',
                prefixText: '\$ ',
              ),
              validator: (v) {
                final n = num.tryParse((v ?? '').trim());
                if (n == null || n <= 0) return 'Enter a valid amount';
                return null;
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _timeline,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(
                labelText: 'Timeline (days)',
                suffixText: 'days',
              ),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _included,
              maxLines: 3,
              decoration:
                  const InputDecoration(labelText: 'What\'s included'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _excluded,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Not included'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _notes,
              maxLines: 2,
              decoration: const InputDecoration(labelText: 'Notes'),
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _message,
              maxLines: 3,
              decoration:
                  const InputDecoration(labelText: 'Cover note (optional)'),
            ),
            const SizedBox(height: 24),
            AsyncPrimaryButton(
              label: 'Send quote',
              icon: Icons.send,
              onPressed: _submit,
            ),
          ],
        ),
      ),
    );
  }
}
