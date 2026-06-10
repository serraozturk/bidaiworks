import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../models/models.dart';

class StatusBadge extends StatelessWidget {
  final String label;
  final Color background;
  final Color foreground;
  final IconData? icon;

  const StatusBadge({
    super.key,
    required this.label,
    required this.background,
    required this.foreground,
    this.icon,
  });

  static StatusBadge forProject(ProjectStatus s) {
    switch (s) {
      case ProjectStatus.open:
      case ProjectStatus.inReview:
      case ProjectStatus.quoted:
      case ProjectStatus.negotiating:
        return StatusBadge(
          label: EnumCodec.projectStatusLabel(s),
          background: AppColors.infoSoft,
          foreground: AppColors.info,
        );
      case ProjectStatus.awarded:
      case ProjectStatus.pendingPayment:
      case ProjectStatus.paid:
        return StatusBadge(
          label: EnumCodec.projectStatusLabel(s),
          background: AppColors.warningSoft,
          foreground: AppColors.warning,
        );
      case ProjectStatus.inProgress:
        return StatusBadge(
          label: EnumCodec.projectStatusLabel(s),
          background: AppColors.primarySoft,
          foreground: AppColors.primary,
        );
      case ProjectStatus.completed:
        return StatusBadge(
          label: EnumCodec.projectStatusLabel(s),
          background: AppColors.successSoft,
          foreground: AppColors.success,
        );
      case ProjectStatus.cancelled:
      case ProjectStatus.expired:
      case ProjectStatus.draft:
        return StatusBadge(
          label: EnumCodec.projectStatusLabel(s),
          background: AppColors.surfaceAlt,
          foreground: AppColors.textTertiary,
        );
    }
  }

  static StatusBadge forQuote(QuoteStatus s) {
    switch (s) {
      case QuoteStatus.pending:
        return const StatusBadge(
          label: 'Pending',
          background: AppColors.warningSoft,
          foreground: AppColors.warning,
        );
      case QuoteStatus.accepted:
        return const StatusBadge(
          label: 'Accepted',
          background: AppColors.successSoft,
          foreground: AppColors.success,
        );
      case QuoteStatus.rejected:
        return const StatusBadge(
          label: 'Rejected',
          background: AppColors.dangerSoft,
          foreground: AppColors.danger,
        );
      case QuoteStatus.withdrawn:
        return const StatusBadge(
          label: 'Withdrawn',
          background: AppColors.surfaceAlt,
          foreground: AppColors.textTertiary,
        );
    }
  }

  static StatusBadge forOffer(OfferStatus s) {
    switch (s) {
      case OfferStatus.pending:
        return const StatusBadge(
          label: 'Pending',
          background: AppColors.warningSoft,
          foreground: AppColors.warning,
        );
      case OfferStatus.accepted:
        return const StatusBadge(
          label: 'Accepted',
          background: AppColors.successSoft,
          foreground: AppColors.success,
        );
      case OfferStatus.rejected:
        return const StatusBadge(
          label: 'Rejected',
          background: AppColors.dangerSoft,
          foreground: AppColors.danger,
        );
      case OfferStatus.countered:
        return const StatusBadge(
          label: 'Countered',
          background: AppColors.primarySoft,
          foreground: AppColors.primary,
        );
      case OfferStatus.withdrawn:
        return const StatusBadge(
          label: 'Withdrawn',
          background: AppColors.surfaceAlt,
          foreground: AppColors.textTertiary,
        );
      case OfferStatus.expired:
        return const StatusBadge(
          label: 'Expired',
          background: AppColors.surfaceAlt,
          foreground: AppColors.textTertiary,
        );
      case OfferStatus.paymentPending:
        return const StatusBadge(
          label: 'Payment',
          background: AppColors.warningSoft,
          foreground: AppColors.warning,
        );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 12, color: foreground),
            const SizedBox(width: 4),
          ],
          Text(
            label,
            style: TextStyle(
              color: foreground,
              fontWeight: FontWeight.w600,
              fontSize: 11,
            ),
          ),
        ],
      ),
    );
  }
}
