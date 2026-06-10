import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/supabase/supabase_client.dart';
import '../models/models.dart';

class ProfileService {
  final SupabaseClient _sb = SupabaseService.client;

  Future<Profile?> fetchProfile(String userId) async {
    final row = await _sb
        .from('profiles')
        .select()
        .eq('id', userId)
        .maybeSingle();
    if (row == null) return null;
    return Profile.fromJson(row);
  }

  Future<Profile?> fetchMyProfile() async {
    final id = SupabaseService.currentUserId;
    if (id == null) return null;
    return fetchProfile(id);
  }

  Future<Profile> updateProfile({
    String? fullName,
    String? phone,
    String? avatarUrl,
  }) async {
    final id = SupabaseService.currentUserId!;
    final updates = <String, dynamic>{
      if (fullName != null) 'full_name': fullName,
      if (phone != null) 'phone': phone,
      if (avatarUrl != null) 'avatar_url': avatarUrl,
    };
    final row = await _sb
        .from('profiles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
    return Profile.fromJson(row);
  }

  Future<void> setRole(UserRole role) async {
    final id = SupabaseService.currentUserId!;
    await _sb
        .from('profiles')
        .update({'role': EnumCodec.userRoleToDb(role)}).eq('id', id);
  }

  Future<ContractorProfile?> fetchContractorProfile(String userId) async {
    final row = await _sb
        .from('contractor_profiles')
        .select()
        .eq('user_id', userId)
        .maybeSingle();
    if (row == null) return null;
    return ContractorProfile.fromJson(row);
  }

  Future<ContractorProfile> upsertContractorProfile({
    required String companyName,
    String? bio,
    String? licenseNumber,
    int? yearsInBusiness,
    String? website,
    String? logoUrl,
    String? coverImageUrl,
  }) async {
    final id = SupabaseService.currentUserId!;
    final row = await _sb
        .from('contractor_profiles')
        .upsert({
          'user_id': id,
          'company_name': companyName,
          if (bio != null) 'bio': bio,
          if (licenseNumber != null) 'license_number': licenseNumber,
          if (yearsInBusiness != null) 'years_in_business': yearsInBusiness,
          if (website != null) 'website': website,
          if (logoUrl != null) 'logo_url': logoUrl,
          if (coverImageUrl != null) 'cover_image_url': coverImageUrl,
        })
        .select()
        .single();
    return ContractorProfile.fromJson(row);
  }

  Future<void> setContractorCategories(List<String> categoryIds) async {
    final id = SupabaseService.currentUserId!;
    await _sb.from('contractor_categories').delete().eq('contractor_id', id);
    if (categoryIds.isEmpty) return;
    await _sb.from('contractor_categories').insert(
          categoryIds.map((c) => {
                'contractor_id': id,
                'category_id': c,
              }).toList(),
        );
  }

  Future<void> setServiceAreas(
    List<Map<String, dynamic>> areas,
  ) async {
    final id = SupabaseService.currentUserId!;
    await _sb
        .from('contractor_service_areas')
        .delete()
        .eq('contractor_id', id);
    if (areas.isEmpty) return;
    await _sb.from('contractor_service_areas').insert(
          areas.map((a) => {...a, 'contractor_id': id}).toList(),
        );
  }

  Future<List<String>> fetchMyCategoryIds() async {
    final id = SupabaseService.currentUserId;
    if (id == null) return [];
    final rows = await _sb
        .from('contractor_categories')
        .select('category_id')
        .eq('contractor_id', id);
    return List<String>.from(rows.map((r) => r['category_id'] as String));
  }

  Future<List<Map<String, dynamic>>> fetchMyServiceAreas() async {
    final id = SupabaseService.currentUserId;
    if (id == null) return [];
    final rows = await _sb
        .from('contractor_service_areas')
        .select()
        .eq('contractor_id', id);
    return List<Map<String, dynamic>>.from(rows);
  }
}
