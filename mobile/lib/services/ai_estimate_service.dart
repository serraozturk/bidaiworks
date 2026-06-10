import 'dart:convert';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/supabase/supabase_client.dart';
import '../models/models.dart';

class EstimateBreakdown {
  final num labor;
  final num materials;
  final num permitsAndOverhead;
  final num contingency;

  const EstimateBreakdown({
    this.labor = 0,
    this.materials = 0,
    this.permitsAndOverhead = 0,
    this.contingency = 0,
  });

  factory EstimateBreakdown.fromJson(Map<String, dynamic> j) =>
      EstimateBreakdown(
        labor: (j['labor'] as num?) ?? 0,
        materials: (j['materials'] as num?) ?? 0,
        permitsAndOverhead: (j['permits_and_overhead'] as num?) ?? 0,
        contingency: (j['contingency'] as num?) ?? 0,
      );
}

class EstimateResult {
  final num min;
  final num max;
  final String reasoning;
  final EstimateBreakdown? breakdown;

  const EstimateResult({
    required this.min,
    required this.max,
    required this.reasoning,
    this.breakdown,
  });
}

class AiEstimateService {
  final SupabaseClient _sb = SupabaseService.client;

  /// Calls the Supabase Edge Function `ai-estimate` deployed alongside
  /// the mobile app. The function uses the same Anthropic Claude prompt
  /// as the web app's /api/ai-estimate route — so estimates are identical.
  Future<EstimateResult> estimate({
    required String categoryName,
    required String zipCode,
    required String description,
    int? squareFootage,
    QualityLevel? qualityLevel,
    ProjectScope? projectScope,
    String? materialPreferences,
  }) async {
    final res = await _sb.functions.invoke(
      'ai-estimate',
      body: {
        'categoryName': categoryName,
        'zipCode': zipCode,
        'description': description,
        if (squareFootage != null) 'squareFootage': squareFootage,
        if (qualityLevel != null)
          'qualityLevel': EnumCodec.qualityLevelToDb(qualityLevel),
        if (projectScope != null)
          'projectScope': EnumCodec.projectScopeToDb(projectScope),
        if (materialPreferences != null)
          'materialPreferences': materialPreferences,
      },
    );

    final data = res.data;
    Map<String, dynamic> body;
    if (data is Map<String, dynamic>) {
      body = data;
    } else if (data is String) {
      body = jsonDecode(data) as Map<String, dynamic>;
    } else {
      // Fallback: use a heuristic so the UX doesn't break if the function fails.
      return _heuristic(categoryName);
    }

    final min = (body['min'] as num?) ?? 0;
    final max = (body['max'] as num?) ?? 0;
    final reasoning = body['reasoning'] as String? ?? '';
    EstimateBreakdown? brk;
    final bk = body['breakdown'];
    if (bk is Map<String, dynamic>) brk = EstimateBreakdown.fromJson(bk);
    return EstimateResult(
      min: min,
      max: max,
      reasoning: reasoning,
      breakdown: brk,
    );
  }

  EstimateResult _heuristic(String categoryName) {
    final base = <String, List<num>>{
      'Kitchen Remodel': [15000, 60000],
      'Bathroom Remodel': [8000, 30000],
      'Roofing': [6000, 20000],
      'Flooring': [3000, 15000],
      'Interior / Exterior Paint': [2000, 8000],
      'Windows & Doors': [4000, 18000],
      'Plumbing': [500, 8000],
      'Electrical': [500, 10000],
      'HVAC': [4000, 14000],
    };
    final r = base[categoryName] ?? [3000, 12000];
    return EstimateResult(
      min: r[0],
      max: r[1],
      reasoning:
          'Heuristic fallback (AI service unavailable). Range is based on typical US averages.',
    );
  }
}
