/// Enums that mirror Supabase `CREATE TYPE` declarations.
/// Names match the DB string values exactly so we can store them as-is.

enum UserRole { homeowner, contractor }

enum ProjectStatus {
  draft,
  open,
  inReview,
  quoted,
  negotiating,
  awarded,
  pendingPayment,
  paid,
  inProgress,
  completed,
  cancelled,
  expired,
}

enum QuoteStatus { pending, accepted, rejected, withdrawn }

enum OfferKind { budgetOffer, counterOffer, quickOffer, contractorOffer }

enum OfferStatus {
  pending,
  accepted,
  rejected,
  countered,
  withdrawn,
  expired,
  paymentPending,
}

enum MessageKind { text, offerCard, quoteCard, system }

enum QualityLevel { budget, standard, premium }

enum ProjectScope { fullRemodel, partialRemodel, repair, newInstall }

enum PaymentStatus { held, released, refunded }

enum PaymentMethod { card, bank, wire }

enum WithdrawalStatus { pending, completed, failed }

enum InsuranceStatus { none, submitted, verified, expired }

enum LicenseStatus { none, submitted, verified, expired }

// ---------- DB <-> Dart converters ----------
class EnumCodec {
  EnumCodec._();

  // userRole
  static UserRole userRoleFromDb(String? s) =>
      s == 'contractor' ? UserRole.contractor : UserRole.homeowner;
  static String userRoleToDb(UserRole r) =>
      r == UserRole.contractor ? 'contractor' : 'homeowner';

  // projectStatus
  static ProjectStatus projectStatusFromDb(String? s) {
    switch (s) {
      case 'draft':
        return ProjectStatus.draft;
      case 'open':
        return ProjectStatus.open;
      case 'in_review':
        return ProjectStatus.inReview;
      case 'quoted':
        return ProjectStatus.quoted;
      case 'negotiating':
        return ProjectStatus.negotiating;
      case 'awarded':
        return ProjectStatus.awarded;
      case 'pending_payment':
        return ProjectStatus.pendingPayment;
      case 'paid':
        return ProjectStatus.paid;
      case 'in_progress':
        return ProjectStatus.inProgress;
      case 'completed':
        return ProjectStatus.completed;
      case 'cancelled':
        return ProjectStatus.cancelled;
      case 'expired':
        return ProjectStatus.expired;
      default:
        return ProjectStatus.open;
    }
  }

  static String projectStatusToDb(ProjectStatus v) {
    switch (v) {
      case ProjectStatus.draft:
        return 'draft';
      case ProjectStatus.open:
        return 'open';
      case ProjectStatus.inReview:
        return 'in_review';
      case ProjectStatus.quoted:
        return 'quoted';
      case ProjectStatus.negotiating:
        return 'negotiating';
      case ProjectStatus.awarded:
        return 'awarded';
      case ProjectStatus.pendingPayment:
        return 'pending_payment';
      case ProjectStatus.paid:
        return 'paid';
      case ProjectStatus.inProgress:
        return 'in_progress';
      case ProjectStatus.completed:
        return 'completed';
      case ProjectStatus.cancelled:
        return 'cancelled';
      case ProjectStatus.expired:
        return 'expired';
    }
  }

  static String projectStatusLabel(ProjectStatus v) {
    switch (v) {
      case ProjectStatus.draft:
        return 'Draft';
      case ProjectStatus.open:
        return 'Open for bids';
      case ProjectStatus.inReview:
        return 'Reviewing quotes';
      case ProjectStatus.quoted:
        return 'Quoted';
      case ProjectStatus.negotiating:
        return 'Negotiating';
      case ProjectStatus.awarded:
        return 'Awarded';
      case ProjectStatus.pendingPayment:
        return 'Payment required';
      case ProjectStatus.paid:
        return 'Awaiting contractor';
      case ProjectStatus.inProgress:
        return 'In progress';
      case ProjectStatus.completed:
        return 'Completed';
      case ProjectStatus.cancelled:
        return 'Cancelled';
      case ProjectStatus.expired:
        return 'Expired';
    }
  }

  // quoteStatus
  static QuoteStatus quoteStatusFromDb(String? s) {
    switch (s) {
      case 'accepted':
        return QuoteStatus.accepted;
      case 'rejected':
        return QuoteStatus.rejected;
      case 'withdrawn':
        return QuoteStatus.withdrawn;
      default:
        return QuoteStatus.pending;
    }
  }

  static String quoteStatusToDb(QuoteStatus s) => s.name;

  // offerKind
  static OfferKind offerKindFromDb(String? s) {
    switch (s) {
      case 'counter_offer':
        return OfferKind.counterOffer;
      case 'quick_offer':
        return OfferKind.quickOffer;
      case 'contractor_offer':
        return OfferKind.contractorOffer;
      default:
        return OfferKind.budgetOffer;
    }
  }

  static String offerKindToDb(OfferKind k) {
    switch (k) {
      case OfferKind.counterOffer:
        return 'counter_offer';
      case OfferKind.quickOffer:
        return 'quick_offer';
      case OfferKind.budgetOffer:
        return 'budget_offer';
      case OfferKind.contractorOffer:
        return 'contractor_offer';
    }
  }

  static String offerKindLabel(OfferKind k) {
    switch (k) {
      case OfferKind.budgetOffer:
        return 'Budget offer';
      case OfferKind.counterOffer:
        return 'Counter';
      case OfferKind.quickOffer:
        return 'Quick offer';
      case OfferKind.contractorOffer:
        return 'Contractor offer';
    }
  }

  // offerStatus
  static OfferStatus offerStatusFromDb(String? s) {
    switch (s) {
      case 'accepted':
        return OfferStatus.accepted;
      case 'rejected':
        return OfferStatus.rejected;
      case 'countered':
        return OfferStatus.countered;
      case 'withdrawn':
        return OfferStatus.withdrawn;
      case 'expired':
        return OfferStatus.expired;
      case 'payment_pending':
        return OfferStatus.paymentPending;
      default:
        return OfferStatus.pending;
    }
  }

  static String offerStatusToDb(OfferStatus s) {
    switch (s) {
      case OfferStatus.paymentPending:
        return 'payment_pending';
      case OfferStatus.pending:
        return 'pending';
      case OfferStatus.accepted:
        return 'accepted';
      case OfferStatus.rejected:
        return 'rejected';
      case OfferStatus.countered:
        return 'countered';
      case OfferStatus.withdrawn:
        return 'withdrawn';
      case OfferStatus.expired:
        return 'expired';
    }
  }

  // messageKind
  static MessageKind messageKindFromDb(String? s) {
    switch (s) {
      case 'offer_card':
        return MessageKind.offerCard;
      case 'quote_card':
        return MessageKind.quoteCard;
      case 'system':
        return MessageKind.system;
      default:
        return MessageKind.text;
    }
  }

  static String messageKindToDb(MessageKind k) {
    switch (k) {
      case MessageKind.offerCard:
        return 'offer_card';
      case MessageKind.quoteCard:
        return 'quote_card';
      case MessageKind.system:
        return 'system';
      case MessageKind.text:
        return 'text';
    }
  }

  // qualityLevel
  static QualityLevel? qualityLevelFromDb(String? s) {
    if (s == null) return null;
    switch (s) {
      case 'budget':
        return QualityLevel.budget;
      case 'standard':
        return QualityLevel.standard;
      case 'premium':
        return QualityLevel.premium;
      default:
        return null;
    }
  }

  static String? qualityLevelToDb(QualityLevel? q) => q?.name;

  static String qualityLevelLabel(QualityLevel q) {
    switch (q) {
      case QualityLevel.budget:
        return 'Budget';
      case QualityLevel.standard:
        return 'Standard';
      case QualityLevel.premium:
        return 'Premium';
    }
  }

  static String qualityLevelDescription(QualityLevel q) {
    switch (q) {
      case QualityLevel.budget:
        return 'Entry-level fixtures and finishes';
      case QualityLevel.standard:
        return 'Mid-range, reliable, mainstream brands';
      case QualityLevel.premium:
        return 'High-end finishes and custom work';
    }
  }

  // projectScope
  static ProjectScope? projectScopeFromDb(String? s) {
    switch (s) {
      case 'full_remodel':
        return ProjectScope.fullRemodel;
      case 'partial_remodel':
        return ProjectScope.partialRemodel;
      case 'repair':
        return ProjectScope.repair;
      case 'new_install':
        return ProjectScope.newInstall;
      default:
        return null;
    }
  }

  static String? projectScopeToDb(ProjectScope? p) {
    if (p == null) return null;
    switch (p) {
      case ProjectScope.fullRemodel:
        return 'full_remodel';
      case ProjectScope.partialRemodel:
        return 'partial_remodel';
      case ProjectScope.repair:
        return 'repair';
      case ProjectScope.newInstall:
        return 'new_install';
    }
  }

  static String projectScopeLabel(ProjectScope p) {
    switch (p) {
      case ProjectScope.fullRemodel:
        return 'Full remodel';
      case ProjectScope.partialRemodel:
        return 'Partial remodel';
      case ProjectScope.repair:
        return 'Repair';
      case ProjectScope.newInstall:
        return 'New install';
    }
  }

  // paymentStatus
  static PaymentStatus paymentStatusFromDb(String? s) {
    switch (s) {
      case 'released':
        return PaymentStatus.released;
      case 'refunded':
        return PaymentStatus.refunded;
      default:
        return PaymentStatus.held;
    }
  }

  static String paymentStatusToDb(PaymentStatus s) => s.name;

  // paymentMethod
  static PaymentMethod paymentMethodFromDb(String? s) {
    switch (s) {
      case 'bank':
        return PaymentMethod.bank;
      case 'wire':
        return PaymentMethod.wire;
      default:
        return PaymentMethod.card;
    }
  }

  static String paymentMethodToDb(PaymentMethod m) => m.name;

  // withdrawalStatus
  static WithdrawalStatus withdrawalStatusFromDb(String? s) {
    switch (s) {
      case 'completed':
        return WithdrawalStatus.completed;
      case 'failed':
        return WithdrawalStatus.failed;
      default:
        return WithdrawalStatus.pending;
    }
  }

  static String withdrawalStatusToDb(WithdrawalStatus s) => s.name;

  // insuranceStatus
  static InsuranceStatus insuranceFromDb(String? s) {
    switch (s) {
      case 'submitted':
        return InsuranceStatus.submitted;
      case 'verified':
        return InsuranceStatus.verified;
      case 'expired':
        return InsuranceStatus.expired;
      default:
        return InsuranceStatus.none;
    }
  }

  // licenseStatus
  static LicenseStatus licenseFromDb(String? s) {
    switch (s) {
      case 'submitted':
        return LicenseStatus.submitted;
      case 'verified':
        return LicenseStatus.verified;
      case 'expired':
        return LicenseStatus.expired;
      default:
        return LicenseStatus.none;
    }
  }
}
