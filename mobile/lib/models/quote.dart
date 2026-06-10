import 'contractor_profile.dart';
import 'enums.dart';
import 'profile.dart';

class Quote {
  final String id;
  final String projectId;
  final String contractorId;
  final num amount;
  final int? timelineDays;
  final String? message;
  final String? includedScope;
  final String? excludedScope;
  final String? notes;
  final QuoteStatus status;
  final DateTime createdAt;
  final DateTime updatedAt;

  // Joined
  final ContractorProfile? contractor;
  final Profile? contractorBaseProfile;

  const Quote({
    required this.id,
    required this.projectId,
    required this.contractorId,
    required this.amount,
    this.timelineDays,
    this.message,
    this.includedScope,
    this.excludedScope,
    this.notes,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
    this.contractor,
    this.contractorBaseProfile,
  });

  factory Quote.fromJson(Map<String, dynamic> j) {
    ContractorProfile? cp;
    Profile? p;
    final rawCp = j['contractor_profiles'];
    if (rawCp is Map<String, dynamic>) {
      cp = ContractorProfile.fromJson(rawCp);
      final rawProf = rawCp['profiles'];
      if (rawProf is Map<String, dynamic>) p = Profile.fromJson(rawProf);
    }
    return Quote(
      id: j['id'] as String,
      projectId: j['project_id'] as String,
      contractorId: j['contractor_id'] as String,
      amount: (j['amount'] as num),
      timelineDays: (j['timeline_days'] as num?)?.toInt(),
      message: j['message'] as String?,
      includedScope: j['included_scope'] as String?,
      excludedScope: j['excluded_scope'] as String?,
      notes: j['notes'] as String?,
      status: EnumCodec.quoteStatusFromDb(j['status'] as String?),
      createdAt: DateTime.parse(j['created_at'] as String),
      updatedAt: DateTime.parse(j['updated_at'] as String),
      contractor: cp,
      contractorBaseProfile: p,
    );
  }
}
