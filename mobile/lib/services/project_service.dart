import 'dart:io';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/supabase/supabase_client.dart';
import '../core/utils/constants.dart';
import '../models/models.dart';

class ProjectService {
  final SupabaseClient _sb = SupabaseService.client;

  static const String _selectWithJoins =
      '*, categories(*), project_photos(*)';

  /// Homeowner: projects I created.
  Future<List<Project>> myProjects() async {
    final id = SupabaseService.currentUserId!;
    final rows = await _sb
        .from('projects')
        .select(_selectWithJoins)
        .eq('homeowner_id', id)
        .order('created_at', ascending: false);
    return rows.map((r) => Project.fromJson(r)).toList();
  }

  /// Contractor: projects RLS lets me see (open, in my service area, in my categories).
  Future<List<Project>> jobFeed({String? categoryId, String? zipCode}) async {
    var query = _sb
        .from('projects')
        .select(_selectWithJoins);
    if (categoryId != null) query = query.eq('category_id', categoryId);
    if (zipCode != null) query = query.eq('zip_code', zipCode);
    final rows = await query
        .inFilter('status', ['open', 'in_review', 'quoted', 'negotiating'])
        .order('created_at', ascending: false);
    return rows.map((r) => Project.fromJson(r)).toList();
  }

  Future<Project?> byId(String id) async {
    final row = await _sb
        .from('projects')
        .select(_selectWithJoins)
        .eq('id', id)
        .maybeSingle();
    if (row == null) return null;
    return Project.fromJson(row);
  }

  /// Load several projects by id (used for the contractor's job list).
  Future<List<Project>> byIds(List<String> ids) async {
    if (ids.isEmpty) return [];
    final rows = await _sb
        .from('projects')
        .select(_selectWithJoins)
        .inFilter('id', ids)
        .order('created_at', ascending: false);
    return rows.map((r) => Project.fromJson(r)).toList();
  }

  Future<Project> createProject({
    required String categoryId,
    required String title,
    required String description,
    required String zipCode,
    String? city,
    String? state,
    int? squareFootage,
    num? budgetMin,
    num? budgetMax,
    DateTime? desiredStartDate,
    QualityLevel? qualityLevel,
    ProjectScope? projectScope,
    String? materialPreferences,
    String? streetAddress,
    num? aiEstimateMin,
    num? aiEstimateMax,
    String? aiEstimateReasoning,
  }) async {
    final id = SupabaseService.currentUserId!;
    final row = await _sb
        .from('projects')
        .insert({
          'homeowner_id': id,
          'category_id': categoryId,
          'title': title,
          'description': description,
          'zip_code': zipCode,
          'city': city,
          'state': state,
          'square_footage': squareFootage,
          'budget_min': budgetMin,
          'budget_max': budgetMax,
          'desired_start_date':
              desiredStartDate?.toIso8601String().substring(0, 10),
          'quality_level': EnumCodec.qualityLevelToDb(qualityLevel),
          'project_scope': EnumCodec.projectScopeToDb(projectScope),
          'material_preferences': materialPreferences,
          'street_address': streetAddress,
          'ai_estimate_min': aiEstimateMin,
          'ai_estimate_max': aiEstimateMax,
          'ai_estimate_reasoning': aiEstimateReasoning,
          'status': 'open',
        })
        .select(_selectWithJoins)
        .single();
    return Project.fromJson(row);
  }

  Future<Project> updateProject(
    String id,
    Map<String, dynamic> patch,
  ) async {
    final row = await _sb
        .from('projects')
        .update(patch)
        .eq('id', id)
        .select(_selectWithJoins)
        .single();
    return Project.fromJson(row);
  }

  Future<void> markCompleted(String id) async {
    await _sb.from('projects').update({'status': 'completed'}).eq('id', id);
  }

  Future<void> cancel(String id) async {
    await _sb.from('projects').update({'status': 'cancelled'}).eq('id', id);
  }

  /// Upload a project photo and insert a project_photos row.
  Future<ProjectPhoto> addPhoto({
    required String projectId,
    required File file,
    int position = 0,
    String? caption,
  }) async {
    final ext = file.path.split('.').last.toLowerCase();
    final path =
        '$projectId/${DateTime.now().millisecondsSinceEpoch}.$ext';
    final bytes = await file.readAsBytes();
    await _sb.storage
        .from(AppConstants.bucketProjectPhotos)
        .uploadBinary(path, bytes,
            fileOptions: const FileOptions(upsert: true));
    final publicUrl = _sb.storage
        .from(AppConstants.bucketProjectPhotos)
        .getPublicUrl(path);

    final row = await _sb
        .from('project_photos')
        .insert({
          'project_id': projectId,
          'url': publicUrl,
          'caption': caption,
          'position': position,
        })
        .select()
        .single();
    return ProjectPhoto.fromJson(row);
  }

  Future<void> deletePhoto(String photoId) async {
    await _sb.from('project_photos').delete().eq('id', photoId);
  }
}
