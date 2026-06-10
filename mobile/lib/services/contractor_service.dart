import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/supabase/supabase_client.dart';
import '../models/models.dart';

class ContractorBrowseRow {
  final ContractorProfile profile;
  final Profile baseProfile;
  final List<Category> categories;

  const ContractorBrowseRow({
    required this.profile,
    required this.baseProfile,
    this.categories = const [],
  });
}

class ContractorService {
  final SupabaseClient _sb = SupabaseService.client;

  Future<List<ContractorBrowseRow>> browse({
    String? categoryId,
    String? zip,
    String? city,
    String? state,
    int limit = 50,
  }) async {
    var query = _sb.from('contractor_profiles').select(
        '*, profiles!inner(*), contractor_categories(category_id, categories(*)), contractor_service_areas(zip_code, city, state)');

    final rows = await query
        .order('rating_avg', ascending: false)
        .limit(limit);

    final list = <ContractorBrowseRow>[];
    for (final r in rows) {
      try {
        final cp = ContractorProfile.fromJson(r);
        final p = Profile.fromJson(r['profiles'] as Map<String, dynamic>);

        // Filter by category client-side (Supabase nested filtering is verbose)
        final cats = <Category>[];
        final ccArr = r['contractor_categories'];
        if (ccArr is List) {
          for (final cc in ccArr) {
            final c = cc['categories'];
            if (c is Map<String, dynamic>) cats.add(Category.fromJson(c));
          }
        }

        if (categoryId != null && cats.every((c) => c.id != categoryId)) {
          continue;
        }

        if (zip != null || (city != null && state != null)) {
          final areas = r['contractor_service_areas'] as List? ?? [];
          final ok = areas.any((a) {
            if (a is! Map) return false;
            if (zip != null && a['zip_code'] == zip) return true;
            if (city != null &&
                state != null &&
                a['city'] != null &&
                a['state'] != null &&
                (a['city'] as String).toLowerCase() == city.toLowerCase() &&
                (a['state'] as String).toUpperCase() == state.toUpperCase()) {
              return true;
            }
            return false;
          });
          if (!ok) continue;
        }

        list.add(ContractorBrowseRow(
          profile: cp,
          baseProfile: p,
          categories: cats,
        ));
      } catch (_) {
        continue;
      }
    }
    return list;
  }

  Future<ContractorBrowseRow?> byId(String userId) async {
    final r = await _sb
        .from('contractor_profiles')
        .select(
            '*, profiles!inner(*), contractor_categories(category_id, categories(*)), contractor_service_areas(*), contractor_portfolio_photos(*)')
        .eq('user_id', userId)
        .maybeSingle();
    if (r == null) return null;
    final cp = ContractorProfile.fromJson(r);
    final p = Profile.fromJson(r['profiles'] as Map<String, dynamic>);
    final cats = <Category>[];
    final ccArr = r['contractor_categories'];
    if (ccArr is List) {
      for (final cc in ccArr) {
        final c = cc['categories'];
        if (c is Map<String, dynamic>) cats.add(Category.fromJson(c));
      }
    }
    return ContractorBrowseRow(
      profile: cp,
      baseProfile: p,
      categories: cats,
    );
  }

  Future<List<Map<String, dynamic>>> portfolioPhotos(String contractorId) async {
    final rows = await _sb
        .from('contractor_portfolio_photos')
        .select()
        .eq('contractor_id', contractorId)
        .order('position');
    return List<Map<String, dynamic>>.from(rows);
  }

  Future<void> savedToggle(String contractorId, bool save) async {
    final me = SupabaseService.currentUserId!;
    if (save) {
      await _sb.from('saved_contractors').upsert({
        'homeowner_id': me,
        'contractor_id': contractorId,
      });
    } else {
      await _sb
          .from('saved_contractors')
          .delete()
          .eq('homeowner_id', me)
          .eq('contractor_id', contractorId);
    }
  }

  Future<List<String>> savedIds() async {
    final me = SupabaseService.currentUserId;
    if (me == null) return [];
    final rows = await _sb
        .from('saved_contractors')
        .select('contractor_id')
        .eq('homeowner_id', me);
    return List<String>.from(rows.map((r) => r['contractor_id'] as String));
  }
}
