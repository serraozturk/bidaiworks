import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/extensions/context_extensions.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/constants.dart';
import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../widgets/layout/empty_state.dart';
import '../../widgets/layout/primary_button.dart';

class ContractorOnboardingScreen extends ConsumerStatefulWidget {
  const ContractorOnboardingScreen({super.key});

  @override
  ConsumerState<ContractorOnboardingScreen> createState() =>
      _ContractorOnboardingScreenState();
}

class _ContractorOnboardingScreenState
    extends ConsumerState<ContractorOnboardingScreen> {
  final _company = TextEditingController();
  final _bio = TextEditingController();
  final _years = TextEditingController();
  final _license = TextEditingController();
  final _website = TextEditingController();
  final Set<String> _selectedCategoryIds = {};
  final List<_ServiceArea> _areas = [_ServiceArea()];
  int _step = 0;

  @override
  void dispose() {
    _company.dispose();
    _bio.dispose();
    _years.dispose();
    _license.dispose();
    _website.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    if (_company.text.trim().isEmpty) {
      context.snack('Company name is required', error: true);
      return;
    }
    if (_selectedCategoryIds.isEmpty) {
      context.snack('Pick at least one service category', error: true);
      return;
    }
    final cleanedAreas = _areas
        .where((a) =>
            a.zip.text.trim().isNotEmpty ||
            (a.city.text.trim().isNotEmpty && a.state.text.trim().isNotEmpty))
        .toList();
    if (cleanedAreas.isEmpty) {
      context.snack('Add at least one service area', error: true);
      return;
    }
    final svc = ref.read(profileServiceProvider);
    await svc.upsertContractorProfile(
      companyName: _company.text.trim(),
      bio: _bio.text.trim(),
      yearsInBusiness: int.tryParse(_years.text.trim()),
      licenseNumber: _license.text.trim(),
      website: _website.text.trim(),
    );
    await svc.setContractorCategories(_selectedCategoryIds.toList());
    await svc.setServiceAreas(cleanedAreas
        .map((a) => {
              if (a.zip.text.trim().isNotEmpty) 'zip_code': a.zip.text.trim(),
              if (a.city.text.trim().isNotEmpty) 'city': a.city.text.trim(),
              if (a.state.text.trim().isNotEmpty)
                'state': a.state.text.trim().toUpperCase(),
            })
        .toList());
    if (!mounted) return;
    ref.invalidate(currentProfileProvider);
    context.go('/contractor/jobs');
  }

  @override
  Widget build(BuildContext context) {
    final cats = ref.watch(categoriesProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Set up your business'),
      ),
      body: SafeArea(
        child: Stepper(
          currentStep: _step,
          type: StepperType.vertical,
          onStepContinue: () {
            if (_step < 2) {
              setState(() => _step += 1);
            } else {
              _save();
            }
          },
          onStepCancel: () {
            if (_step > 0) setState(() => _step -= 1);
          },
          controlsBuilder: (ctx, details) => Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Row(
              children: [
                Expanded(
                  child: _step == 2
                      ? AsyncPrimaryButton(label: 'Finish', onPressed: _save)
                      : ElevatedButton(
                          onPressed: details.onStepContinue,
                          child: const Text('Continue'),
                        ),
                ),
                if (_step > 0) ...[
                  const SizedBox(width: 8),
                  OutlinedButton(
                    onPressed: details.onStepCancel,
                    child: const Text('Back'),
                  ),
                ],
              ],
            ),
          ),
          steps: [
            Step(
              title: const Text('Company'),
              isActive: _step >= 0,
              content: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: _company,
                    decoration: const InputDecoration(
                        labelText: 'Company name',
                        prefixIcon: Icon(Icons.business_outlined)),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _bio,
                    maxLines: 3,
                    decoration: const InputDecoration(
                      labelText: 'Short bio (what you specialize in)',
                    ),
                  ),
                  const SizedBox(height: 12),
                  Row(children: [
                    Expanded(
                      child: TextField(
                        controller: _years,
                        keyboardType: TextInputType.number,
                        decoration: const InputDecoration(
                            labelText: 'Years in business'),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: TextField(
                        controller: _license,
                        decoration: const InputDecoration(labelText: 'License #'),
                      ),
                    ),
                  ]),
                  const SizedBox(height: 12),
                  TextField(
                    controller: _website,
                    keyboardType: TextInputType.url,
                    decoration: const InputDecoration(
                      labelText: 'Website',
                      prefixIcon: Icon(Icons.public),
                    ),
                  ),
                ],
              ),
            ),
            Step(
              title: const Text('Categories you serve'),
              isActive: _step >= 1,
              content: cats.when(
                loading: () => const SizedBox(
                    height: 80, child: Center(child: LoadingView())),
                error: (e, _) => ErrorView(error: e),
                data: (list) => Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: list.map((c) {
                    final selected = _selectedCategoryIds.contains(c.id);
                    return FilterChip(
                      label: Text(c.name),
                      selected: selected,
                      avatar: Icon(
                        IconData(CategoryIcons.code(c.icon),
                            fontFamily: 'MaterialIcons'),
                        size: 16,
                        color: selected ? Colors.white : AppColors.textSecondary,
                      ),
                      selectedColor: AppColors.primary,
                      labelStyle: TextStyle(
                        color: selected ? Colors.white : AppColors.textPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                      onSelected: (v) => setState(() {
                        if (v) {
                          _selectedCategoryIds.add(c.id);
                        } else {
                          _selectedCategoryIds.remove(c.id);
                        }
                      }),
                    );
                  }).toList(),
                ),
              ),
            ),
            Step(
              title: const Text('Service areas'),
              isActive: _step >= 2,
              content: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < _areas.length; i++) ...[
                    _AreaInput(
                      area: _areas[i],
                      onRemove: _areas.length == 1
                          ? null
                          : () => setState(() => _areas.removeAt(i)),
                    ),
                    const SizedBox(height: 12),
                  ],
                  OutlinedButton.icon(
                    onPressed: () =>
                        setState(() => _areas.add(_ServiceArea())),
                    icon: const Icon(Icons.add),
                    label: const Text('Add another area'),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ServiceArea {
  final TextEditingController zip = TextEditingController();
  final TextEditingController city = TextEditingController();
  final TextEditingController state = TextEditingController();
}

class _AreaInput extends StatelessWidget {
  final _ServiceArea area;
  final VoidCallback? onRemove;

  const _AreaInput({required this.area, this.onRemove});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        children: [
          Row(children: [
            Expanded(
              flex: 2,
              child: TextField(
                controller: area.zip,
                keyboardType: TextInputType.number,
                maxLength: 5,
                decoration: const InputDecoration(
                  labelText: 'ZIP',
                  counterText: '',
                ),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              flex: 3,
              child: TextField(
                controller: area.city,
                decoration: const InputDecoration(labelText: 'City'),
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              flex: 2,
              child: TextField(
                controller: area.state,
                maxLength: 2,
                textCapitalization: TextCapitalization.characters,
                decoration: const InputDecoration(
                  labelText: 'State',
                  counterText: '',
                ),
              ),
            ),
          ]),
          if (onRemove != null)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: onRemove,
                icon: const Icon(Icons.close, size: 16),
                label: const Text('Remove'),
                style: TextButton.styleFrom(foregroundColor: AppColors.danger),
              ),
            ),
        ],
      ),
    );
  }
}
