import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/supabase/supabase_client.dart';
import '../models/models.dart';

class ReviewService {
  final SupabaseClient _sb = SupabaseService.client;

  Future<List<Review>> forContractor(String contractorId) async {
    final rows = await _sb
        .from('reviews')
        .select('*, review_photos(*)')
        .eq('contractor_id', contractorId)
        .order('created_at', ascending: false);
    return rows.map((r) => Review.fromJson(r)).toList();
  }

  Future<List<Review>> myReviews() async {
    final me = SupabaseService.currentUserId!;
    final rows = await _sb
        .from('reviews')
        .select('*, review_photos(*), projects(title)')
        .eq('reviewer_id', me)
        .order('created_at', ascending: false);
    return rows.map((r) => Review.fromJson(r)).toList();
  }

  Future<Review> create({
    required String projectId,
    required String contractorId,
    required int overall,
    int? workQuality,
    int? communication,
    int? punctuality,
    int? value,
    String? comment,
  }) async {
    final me = SupabaseService.currentUserId!;
    final r = await _sb
        .from('reviews')
        .insert({
          'project_id': projectId,
          'reviewer_id': me,
          'contractor_id': contractorId,
          'rating': overall,
          'rating_overall': overall,
          'rating_work_quality': workQuality,
          'rating_communication': communication,
          'rating_punctuality': punctuality,
          'rating_value': value,
          'comment': comment,
        })
        .select('*, review_photos(*)')
        .single();
    return Review.fromJson(r);
  }
}
