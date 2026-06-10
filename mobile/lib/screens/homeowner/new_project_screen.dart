import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/extensions/context_extensions.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/constants.dart';
import '../../core/utils/formatters.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../services/ai_estimate_service.dart';
import '../../widgets/layout/empty_state.dart';
import '../../widgets/layout/primary_button.dart';

class NewProjectScreen extends ConsumerStatefulWidget {
  const NewProjectScreen({super.key});

  @override
  ConsumerState<NewProjectScreen> createState() => _NewProjectScreenState();
}

class _NewProjectScreenState extends ConsumerState<NewProjectScreen> {
  final _form = GlobalKey<FormState>();
  final _title = TextEditingController();
  final _description = TextEditingController();
  final _zip = TextEditingController();
  final _city = TextEditingController();
  final _state = TextEditingController();
  final _sqft = TextEditingController();
  final _budgetMin = TextEditingController();
  final _budgetMax = TextEditingController();
  final _materials = TextEditingController();
  final _street = TextEditingController();
  String? _categoryId;
  QualityLevel? _quality;
  ProjectScope? _scope;
  DateTime? _startDate;
  final List<File> _photos = [];
  EstimateResult? _estimate;
  bool _busyEstimate = false;

  @override
  void dispose() {
    _title.dispose();
    _description.dispose();
    _zip.dispose();
    _city.dispose();
    _state.dispose();
    _sqft.dispose();
    _budgetMin.dispose();
    _budgetMax.dispose();
    _materials.dispose();
    _street.dispose();
    super.dispose();
  }

  Future<void> _pickPhotos() async {
    final picker = ImagePicker();
    final files = await picker.pickMultiImage(imageQuality: 75);
    if (files.isEmpty) return;
    setState(() => _photos.addAll(files.map((x) => File(x.path))));
  }

  Future<void> _runEstimate() async {
    if (_categoryId == null ||
        _zip.text.trim().length != 5 ||
        _description.text.trim().length < 10) {
      context.snack(
          'Pick a category, valid ZIP, and a description of at least 10 chars',
          error: true);
      return;
    }
    final allCats = ref.read(categoriesProvider).valueOrNull;
    final cat = allCats == null
        ? null
        : (() {
            for (final c in allCats) {
              if (c.id == _categoryId) return c;
            }
            return null;
          })();
    if (cat == null) {
      context.snack('Category not found', error: true);
      return;
    }
    setState(() => _busyEstimate = true);
    try {
      final r = await ref.read(aiEstimateServiceProvider).estimate(
            categoryName: cat.name,
            zipCode: _zip.text.trim(),
            description: _description.text.trim(),
            squareFootage: int.tryParse(_sqft.text.trim()),
            qualityLevel: _quality,
            projectScope: _scope,
            materialPreferences: _materials.text.trim().isEmpty
                ? null
                : _materials.text.trim(),
          );
      if (!mounted) return;
      setState(() => _estimate = r);
    } catch (e) {
      if (!mounted) return;
      context.snack('AI estimate failed: $e', error: true);
    } finally {
      if (mounted) setState(() => _busyEstimate = false);
    }
  }

  Future<void> _publish() async {
    if (!_form.currentState!.validate()) return;
    if (_categoryId == null) {
      context.snack('Pick a category', error: true);
      return;
    }
    try {
      final project = await ref.read(projectServiceProvider).createProject(
            categoryId: _categoryId!,
            title: _title.text.trim(),
            description: _description.text.trim(),
            zipCode: _zip.text.trim(),
            city: _city.text.trim().isEmpty ? null : _city.text.trim(),
            state: _state.text.trim().isEmpty
                ? null
                : _state.text.trim().toUpperCase(),
            squareFootage: int.tryParse(_sqft.text.trim()),
            budgetMin: num.tryParse(_budgetMin.text.trim()),
            budgetMax: num.tryParse(_budgetMax.text.trim()),
            desiredStartDate: _startDate,
            qualityLevel: _quality,
            projectScope: _scope,
            materialPreferences: _materials.text.trim().isEmpty
                ? null
                : _materials.text.trim(),
            streetAddress:
                _street.text.trim().isEmpty ? null : _street.text.trim(),
            aiEstimateMin: _estimate?.min,
            aiEstimateMax: _estimate?.max,
            aiEstimateReasoning: _estimate?.reasoning,
          );
      // Upload photos in sequence (small batches keep memory friendly).
      for (var i = 0; i < _photos.length; i++) {
        try {
          await ref
              .read(projectServiceProvider)
              .addPhoto(projectId: project.id, file: _photos[i], position: i);
        } catch (_) {}
      }
      if (!mounted) return;
      ref.invalidate(myProjectsProvider);
      context.snack('Your project is live. Contractors can now find it.');
      context.pop();
    } catch (e) {
      if (!mounted) return;
      context.snack('Could not publish: $e', error: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final cats = ref.watch(categoriesProvider);
    return Scaffold(
      appBar: AppBar(title: const Text('Post a project')),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
          children: [
            _section('Category'),
            cats.when(
              loading: () => const LoadingView(),
              error: (e, _) => ErrorView(error: e),
              data: (list) => Wrap(
                spacing: 8,
                runSpacing: 8,
                children: list.map((c) {
                  final selected = _categoryId == c.id;
                  return ChoiceChip(
                    label: Text(c.name),
                    selected: selected,
                    avatar: Icon(
                      IconData(CategoryIcons.code(c.icon),
                          fontFamily: 'MaterialIcons'),
                      size: 16,
                      color:
                          selected ? Colors.white : AppColors.textSecondary,
                    ),
                    selectedColor: AppColors.primary,
                    labelStyle: TextStyle(
                      color: selected ? Colors.white : AppColors.textPrimary,
                      fontWeight: FontWeight.w600,
                    ),
                    onSelected: (v) =>
                        setState(() => _categoryId = v ? c.id : null),
                  );
                }).toList(),
              ),
            ),
            _section('Project details'),
            TextFormField(
              controller: _title,
              decoration: const InputDecoration(
                  labelText: 'Title (e.g. Master bath remodel)'),
              validator: (v) =>
                  (v ?? '').trim().length < 4 ? 'A bit more detail please' : null,
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _description,
              maxLines: 4,
              decoration: const InputDecoration(
                  labelText: 'Describe what you want done'),
              validator: (v) =>
                  (v ?? '').trim().length < 10 ? 'Min 10 characters' : null,
            ),
            const SizedBox(height: 12),
            Row(children: [
              Expanded(
                child: TextFormField(
                  controller: _zip,
                  keyboardType: TextInputType.number,
                  maxLength: 5,
                  decoration: const InputDecoration(
                      labelText: 'ZIP', counterText: ''),
                  validator: (v) =>
                      RegExp(r'^\d{5}$').hasMatch(v ?? '') ? null : '5 digits',
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  controller: _city,
                  decoration: const InputDecoration(labelText: 'City'),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                width: 80,
                child: TextFormField(
                  controller: _state,
                  maxLength: 2,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(
                      labelText: 'State', counterText: ''),
                ),
              ),
            ]),
            const SizedBox(height: 12),
            TextFormField(
              controller: _street,
              decoration: const InputDecoration(
                labelText: 'Street address (private — only awarded contractor)',
                prefixIcon: Icon(Icons.lock_outline),
              ),
            ),
            _section('Optional details'),
            Row(children: [
              Expanded(
                child: TextFormField(
                  controller: _sqft,
                  keyboardType: TextInputType.number,
                  decoration:
                      const InputDecoration(labelText: 'Approx. sq ft'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  controller: _budgetMin,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Budget min'),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: TextFormField(
                  controller: _budgetMax,
                  keyboardType: TextInputType.number,
                  decoration: const InputDecoration(labelText: 'Budget max'),
                ),
              ),
            ]),
            const SizedBox(height: 12),
            _qualityRow(),
            const SizedBox(height: 12),
            _scopeRow(),
            const SizedBox(height: 12),
            ListTile(
              tileColor: AppColors.surfaceAlt,
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12)),
              leading: const Icon(Icons.calendar_today_outlined),
              title: Text(_startDate == null
                  ? 'Desired start date'
                  : Formatters.date(_startDate)),
              trailing: const Icon(Icons.chevron_right),
              onTap: () async {
                final now = DateTime.now();
                final d = await showDatePicker(
                  context: context,
                  initialDate: now.add(const Duration(days: 14)),
                  firstDate: now,
                  lastDate: now.add(const Duration(days: 365)),
                );
                if (d != null) setState(() => _startDate = d);
              },
            ),
            const SizedBox(height: 12),
            TextFormField(
              controller: _materials,
              maxLines: 2,
              decoration: const InputDecoration(
                  labelText: 'Material preferences (optional)'),
            ),
            _section('Photos'),
            _photoStrip(),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: _pickPhotos,
              icon: const Icon(Icons.add_photo_alternate_outlined),
              label: const Text('Add photos'),
            ),
            const SizedBox(height: 24),
            _aiPanel(),
            const SizedBox(height: 24),
            AsyncPrimaryButton(
              label: 'Publish project',
              icon: Icons.send,
              onPressed: _publish,
            ),
          ],
        ),
      ),
    );
  }

  Widget _qualityRow() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: QualityLevel.values.map((q) {
        final selected = _quality == q;
        return ChoiceChip(
          label: Text(EnumCodec.qualityLevelLabel(q)),
          selected: selected,
          selectedColor: AppColors.accent,
          labelStyle: TextStyle(
            color: selected ? Colors.white : AppColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
          onSelected: (v) => setState(() => _quality = v ? q : null),
        );
      }).toList(),
    );
  }

  Widget _scopeRow() {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: ProjectScope.values.map((s) {
        final selected = _scope == s;
        return ChoiceChip(
          label: Text(EnumCodec.projectScopeLabel(s)),
          selected: selected,
          selectedColor: AppColors.primary,
          labelStyle: TextStyle(
            color: selected ? Colors.white : AppColors.textPrimary,
            fontWeight: FontWeight.w600,
          ),
          onSelected: (v) => setState(() => _scope = v ? s : null),
        );
      }).toList(),
    );
  }

  Widget _photoStrip() {
    if (_photos.isEmpty) {
      return Container(
        height: 96,
        decoration: BoxDecoration(
          color: AppColors.surfaceAlt,
          borderRadius: BorderRadius.circular(12),
        ),
        alignment: Alignment.center,
        child: const Text('No photos yet — add a few for better quotes',
            style: TextStyle(color: AppColors.textSecondary)),
      );
    }
    return SizedBox(
      height: 96,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: _photos.length,
        separatorBuilder: (_, __) => const SizedBox(width: 8),
        itemBuilder: (_, i) => Stack(
          children: [
            ClipRRect(
              borderRadius: BorderRadius.circular(12),
              child: Image.file(_photos[i],
                  width: 96, height: 96, fit: BoxFit.cover),
            ),
            Positioned(
              top: 4,
              right: 4,
              child: GestureDetector(
                onTap: () => setState(() => _photos.removeAt(i)),
                child: const CircleAvatar(
                  radius: 12,
                  backgroundColor: Colors.black54,
                  child: Icon(Icons.close, color: Colors.white, size: 14),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _aiPanel() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.primary.withOpacity(0.18)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(children: [
            const Icon(Icons.auto_awesome, color: AppColors.primary),
            const SizedBox(width: 8),
            Text('AI cost estimate', style: context.text.titleMedium),
          ]),
          const SizedBox(height: 4),
          const Text(
            'Get a fast ballpark from Claude based on your details.',
            style: TextStyle(color: AppColors.textSecondary),
          ),
          const SizedBox(height: 12),
          if (_estimate != null) ...[
            Text(
              Formatters.range(_estimate!.min, _estimate!.max),
              style: context.text.headlineMedium
                  ?.copyWith(color: AppColors.primary),
            ),
            const SizedBox(height: 6),
            Text(_estimate!.reasoning,
                style: const TextStyle(
                    color: AppColors.textSecondary, height: 1.4)),
            const SizedBox(height: 12),
          ],
          AsyncPrimaryButton(
            label: _estimate == null ? 'Generate estimate' : 'Re-estimate',
            icon: Icons.auto_awesome,
            outlined: true,
            onPressed: _busyEstimate ? null : _runEstimate,
          ),
        ],
      ),
    );
  }

  Widget _section(String title) => Padding(
        padding: const EdgeInsets.only(top: 24, bottom: 8),
        child: Text(title, style: context.text.titleMedium),
      );
}
