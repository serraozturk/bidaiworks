import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/supabase/supabase_client.dart';
import '../models/models.dart';

class CategoryService {
  final SupabaseClient _sb = SupabaseService.client;

  Future<List<Category>> all() async {
    final rows = await _sb
        .from('categories')
        .select()
        .order('sort_order', ascending: true);
    return rows.map((r) => Category.fromJson(r)).toList();
  }
}
