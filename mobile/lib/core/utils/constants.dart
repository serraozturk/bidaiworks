/// App-wide constants — categories list mirrors `supabase/seed.sql`,
/// status labels mirror types in `src/lib/types.ts`.
class AppConstants {
  AppConstants._();

  static const String appName = 'bidAI';
  static const String tagline = 'Home renovation marketplace';

  /// Supabase storage bucket for project photos. Must exist in dashboard.
  static const String bucketProjectPhotos = 'project-photos';
  static const String bucketContractorPortfolio = 'contractor-portfolio';
  static const String bucketContractorCover = 'contractor-cover';
  static const String bucketReviewPhotos = 'review-photos';
  static const String bucketAvatars = 'avatars';

  static const Duration realtimeTimeout = Duration(seconds: 10);

  /// Contractor commitment fee — 8% of the project amount, paid by the
  /// contractor to claim a job after the homeowner has paid.
  static const double commitmentFeePct = 0.08;

  /// Flat homeowner protection hold added on top of the project amount
  /// at checkout. Held in escrow alongside the project funds.
  static const double protectionHoldAmount = 300;

  /// Hours the contractor has to pay the commitment fee after the
  /// homeowner pays, before the job re-opens to other contractors.
  static const int contractorCommitWindowHours = 48;
}

/// Icon mapping for category slugs — kept in sync with web `lucide` icons
/// but uses Material icons in mobile.
class CategoryIcons {
  CategoryIcons._();

  static const Map<String, int> _byIconName = {
    'utensils': 0xe56c,
    'bath': 0xe1d7,
    'home': 0xe88a,
    'square': 0xe3e3,
    'paint-bucket': 0xe40a,
    'door-open': 0xef72,
    'droplets': 0xf32b,
    'plug': 0xf21f,
    'wind': 0xefd8,
    'building-2': 0xe71b,
    'layers': 0xe53b,
    'tree-pine': 0xf067,
    'sprout': 0xf06a,
    'panels-top-left': 0xf268,
    'wrench': 0xe898,
  };

  static int code(String? icon) =>
      _byIconName[icon ?? ''] ?? 0xe40a; // default: build
}
