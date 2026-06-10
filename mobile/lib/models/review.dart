class Review {
  final String id;
  final String projectId;
  final String reviewerId;
  final String contractorId;
  final int rating;
  final int? ratingOverall;
  final int? ratingWorkQuality;
  final int? ratingCommunication;
  final int? ratingPunctuality;
  final int? ratingValue;
  final String? comment;
  final DateTime createdAt;

  final List<String> photoUrls;
  final String? reviewerName;
  final String? projectTitle;

  const Review({
    required this.id,
    required this.projectId,
    required this.reviewerId,
    required this.contractorId,
    required this.rating,
    this.ratingOverall,
    this.ratingWorkQuality,
    this.ratingCommunication,
    this.ratingPunctuality,
    this.ratingValue,
    this.comment,
    required this.createdAt,
    this.photoUrls = const [],
    this.reviewerName,
    this.projectTitle,
  });

  int get displayRating => ratingOverall ?? rating;

  factory Review.fromJson(Map<String, dynamic> j) {
    final photos = <String>[];
    final rawPhotos = j['review_photos'];
    if (rawPhotos is List) {
      for (final p in rawPhotos) {
        if (p is Map<String, dynamic> && p['url'] != null) {
          photos.add(p['url'] as String);
        }
      }
    }
    return Review(
      id: j['id'] as String,
      projectId: j['project_id'] as String,
      reviewerId: j['reviewer_id'] as String,
      contractorId: j['contractor_id'] as String,
      rating: (j['rating'] as num?)?.toInt() ?? 0,
      ratingOverall: (j['rating_overall'] as num?)?.toInt(),
      ratingWorkQuality: (j['rating_work_quality'] as num?)?.toInt(),
      ratingCommunication: (j['rating_communication'] as num?)?.toInt(),
      ratingPunctuality: (j['rating_punctuality'] as num?)?.toInt(),
      ratingValue: (j['rating_value'] as num?)?.toInt(),
      comment: j['comment'] as String?,
      createdAt: DateTime.parse(j['created_at'] as String),
      photoUrls: photos,
    );
  }
}
