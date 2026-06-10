import 'category.dart';
import 'enums.dart';

class ProjectPhoto {
  final String id;
  final String projectId;
  final String url;
  final String? caption;
  final int position;
  final DateTime createdAt;

  const ProjectPhoto({
    required this.id,
    required this.projectId,
    required this.url,
    this.caption,
    this.position = 0,
    required this.createdAt,
  });

  factory ProjectPhoto.fromJson(Map<String, dynamic> j) => ProjectPhoto(
        id: j['id'] as String,
        projectId: j['project_id'] as String,
        url: j['url'] as String,
        caption: j['caption'] as String?,
        position: (j['position'] as num?)?.toInt() ?? 0,
        createdAt: DateTime.parse(j['created_at'] as String),
      );
}

class Project {
  final String id;
  final String homeownerId;
  final String categoryId;
  final String title;
  final String description;
  final String zipCode;
  final String? city;
  final String? state;
  final int? squareFootage;
  final num? budgetMin;
  final num? budgetMax;
  final DateTime? desiredStartDate;
  final QualityLevel? qualityLevel;
  final ProjectScope? projectScope;
  final String? materialPreferences;
  final String? streetAddress;
  final num? aiEstimateMin;
  final num? aiEstimateMax;
  final String? aiEstimateReasoning;
  final ProjectStatus status;
  final String? awardedQuoteId;
  final String? awardedOfferId;
  final String? selectedOfferId;
  final String? paymentStatus;
  final num? protectionHoldAmount;
  final num? contractorFeeAmount;
  final String? contractorFeeStatus;
  final DateTime? contractorCommitDueAt;
  final DateTime? paidAt;
  final DateTime createdAt;
  final DateTime updatedAt;

  // Optional joined data
  final Category? category;
  final List<ProjectPhoto> photos;

  const Project({
    required this.id,
    required this.homeownerId,
    required this.categoryId,
    required this.title,
    required this.description,
    required this.zipCode,
    this.city,
    this.state,
    this.squareFootage,
    this.budgetMin,
    this.budgetMax,
    this.desiredStartDate,
    this.qualityLevel,
    this.projectScope,
    this.materialPreferences,
    this.streetAddress,
    this.aiEstimateMin,
    this.aiEstimateMax,
    this.aiEstimateReasoning,
    required this.status,
    this.awardedQuoteId,
    this.awardedOfferId,
    this.selectedOfferId,
    this.paymentStatus,
    this.protectionHoldAmount,
    this.contractorFeeAmount,
    this.contractorFeeStatus,
    this.contractorCommitDueAt,
    this.paidAt,
    required this.createdAt,
    required this.updatedAt,
    this.category,
    this.photos = const [],
  });

  factory Project.fromJson(Map<String, dynamic> j) {
    Category? cat;
    final rawCat = j['categories'];
    if (rawCat is Map<String, dynamic>) {
      cat = Category.fromJson(rawCat);
    }
    final rawPhotos = j['project_photos'];
    final photos = <ProjectPhoto>[];
    if (rawPhotos is List) {
      for (final p in rawPhotos) {
        if (p is Map<String, dynamic>) photos.add(ProjectPhoto.fromJson(p));
      }
      photos.sort((a, b) => a.position.compareTo(b.position));
    }

    return Project(
      id: j['id'] as String,
      homeownerId: j['homeowner_id'] as String,
      categoryId: j['category_id'] as String,
      title: j['title'] as String,
      description: j['description'] as String? ?? '',
      zipCode: j['zip_code'] as String,
      city: j['city'] as String?,
      state: j['state'] as String?,
      squareFootage: (j['square_footage'] as num?)?.toInt(),
      budgetMin: j['budget_min'] as num?,
      budgetMax: j['budget_max'] as num?,
      desiredStartDate: j['desired_start_date'] != null
          ? DateTime.tryParse(j['desired_start_date'].toString())
          : null,
      qualityLevel: EnumCodec.qualityLevelFromDb(j['quality_level'] as String?),
      projectScope: EnumCodec.projectScopeFromDb(j['project_scope'] as String?),
      materialPreferences: j['material_preferences'] as String?,
      streetAddress: j['street_address'] as String?,
      aiEstimateMin: j['ai_estimate_min'] as num?,
      aiEstimateMax: j['ai_estimate_max'] as num?,
      aiEstimateReasoning: j['ai_estimate_reasoning'] as String?,
      status: EnumCodec.projectStatusFromDb(j['status'] as String?),
      awardedQuoteId: j['awarded_quote_id'] as String?,
      awardedOfferId: j['awarded_offer_id'] as String?,
      selectedOfferId: j['selected_offer_id'] as String?,
      paymentStatus: j['payment_status'] as String?,
      protectionHoldAmount: j['protection_hold_amount'] as num?,
      contractorFeeAmount: j['contractor_fee_amount'] as num?,
      contractorFeeStatus: j['contractor_fee_status'] as String?,
      contractorCommitDueAt: j['contractor_commit_due_at'] != null
          ? DateTime.tryParse(j['contractor_commit_due_at'].toString())
          : null,
      paidAt: j['paid_at'] != null
          ? DateTime.tryParse(j['paid_at'].toString())
          : null,
      createdAt: DateTime.parse(j['created_at'] as String),
      updatedAt: DateTime.parse(j['updated_at'] as String),
      category: cat,
      photos: photos,
    );
  }

  String get locationLabel {
    if (city != null && state != null) return '$city, $state $zipCode';
    if (city != null) return '$city $zipCode';
    return zipCode;
  }

  String? get heroPhotoUrl => photos.isNotEmpty ? photos.first.url : null;

  bool get isOpen =>
      status == ProjectStatus.open ||
      status == ProjectStatus.inReview ||
      status == ProjectStatus.quoted ||
      status == ProjectStatus.negotiating;

  /// Homeowner has paid; the awarded contractor must still pay the 8%
  /// commitment fee before the job becomes active.
  bool get awaitingContractorCommitment =>
      status == ProjectStatus.paid && contractorFeeStatus == 'due';

  /// Contractor has committed and the job is live.
  bool get isActiveJob => status == ProjectStatus.inProgress;
}
