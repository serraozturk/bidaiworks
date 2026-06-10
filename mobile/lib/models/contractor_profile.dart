import 'enums.dart';

class ContractorProfile {
  final String userId;
  final String companyName;
  final String? licenseNumber;
  final LicenseStatus licenseStatus;
  final String? bio;
  final int? yearsInBusiness;
  final String? website;
  final String? logoUrl;
  final String? coverImageUrl;
  final InsuranceStatus insuranceStatus;
  final String? insuranceCarrier;
  final DateTime? insuranceExpiresAt;
  final bool verified;
  final DateTime? verifiedAt;
  final double ratingAvg;
  final int ratingCount;
  final double? googleRating;
  final int? googleReviewCount;
  final String? googleProfileUrl;
  final int completedJobsCount;
  final int? responseTimeHours;
  final DateTime createdAt;
  final DateTime updatedAt;

  const ContractorProfile({
    required this.userId,
    required this.companyName,
    this.licenseNumber,
    this.licenseStatus = LicenseStatus.none,
    this.bio,
    this.yearsInBusiness,
    this.website,
    this.logoUrl,
    this.coverImageUrl,
    this.insuranceStatus = InsuranceStatus.none,
    this.insuranceCarrier,
    this.insuranceExpiresAt,
    this.verified = false,
    this.verifiedAt,
    this.ratingAvg = 0,
    this.ratingCount = 0,
    this.googleRating,
    this.googleReviewCount,
    this.googleProfileUrl,
    this.completedJobsCount = 0,
    this.responseTimeHours,
    required this.createdAt,
    required this.updatedAt,
  });

  factory ContractorProfile.fromJson(Map<String, dynamic> j) =>
      ContractorProfile(
        userId: j['user_id'] as String,
        companyName: j['company_name'] as String? ?? '',
        licenseNumber: j['license_number'] as String?,
        licenseStatus: EnumCodec.licenseFromDb(j['license_status'] as String?),
        bio: j['bio'] as String?,
        yearsInBusiness: (j['years_in_business'] as num?)?.toInt(),
        website: j['website'] as String?,
        logoUrl: j['logo_url'] as String?,
        coverImageUrl: j['cover_image_url'] as String?,
        insuranceStatus:
            EnumCodec.insuranceFromDb(j['insurance_status'] as String?),
        insuranceCarrier: j['insurance_carrier'] as String?,
        insuranceExpiresAt: j['insurance_expires_at'] != null
            ? DateTime.tryParse(j['insurance_expires_at'].toString())
            : null,
        verified: j['verified'] as bool? ?? false,
        verifiedAt: j['verified_at'] != null
            ? DateTime.tryParse(j['verified_at'].toString())
            : null,
        ratingAvg: (j['rating_avg'] as num?)?.toDouble() ?? 0,
        ratingCount: (j['rating_count'] as num?)?.toInt() ?? 0,
        googleRating: (j['google_rating'] as num?)?.toDouble(),
        googleReviewCount: (j['google_review_count'] as num?)?.toInt(),
        googleProfileUrl: j['google_profile_url'] as String?,
        completedJobsCount: (j['completed_jobs_count'] as num?)?.toInt() ?? 0,
        responseTimeHours: (j['response_time_hours'] as num?)?.toInt(),
        createdAt: DateTime.parse(j['created_at'] as String),
        updatedAt: DateTime.parse(j['updated_at'] as String),
      );

  Map<String, dynamic> toUpsert() => {
        'user_id': userId,
        'company_name': companyName,
        'license_number': licenseNumber,
        'bio': bio,
        'years_in_business': yearsInBusiness,
        'website': website,
        'logo_url': logoUrl,
        'cover_image_url': coverImageUrl,
      };
}
