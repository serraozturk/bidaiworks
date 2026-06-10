import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';
import '../../models/models.dart';
import '../../services/contractor_service.dart';
import '../layout/app_avatar.dart';
import '../layout/rating_row.dart';

class ContractorCard extends StatelessWidget {
  final ContractorBrowseRow row;
  final VoidCallback? onTap;
  final bool saved;
  final VoidCallback? onSavedToggle;

  const ContractorCard({
    super.key,
    required this.row,
    this.onTap,
    this.saved = false,
    this.onSavedToggle,
  });

  @override
  Widget build(BuildContext context) {
    final p = row.profile;
    final base = row.baseProfile;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Ink(
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: Border.all(color: AppColors.border),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              AppAvatar(
                url: p.logoUrl ?? base.avatarUrl,
                fallbackInitials: _initials(p.companyName),
                size: 52,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            p.companyName,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                        if (p.verified)
                          const Padding(
                            padding: EdgeInsets.only(left: 4),
                            child: Icon(
                              Icons.verified,
                              color: AppColors.primary,
                              size: 16,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    if (row.categories.isNotEmpty)
                      Text(
                        row.categories.take(2).map((c) => c.name).join(' · '),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    const SizedBox(height: 6),
                    Row(
                      children: [
                        RatingRow(
                          rating: p.ratingAvg,
                          count: p.ratingCount,
                          size: 13,
                        ),
                        const SizedBox(width: 10),
                        if (p.completedJobsCount > 0)
                          Text(
                            '${p.completedJobsCount} jobs',
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                      ],
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: onSavedToggle,
                visualDensity: VisualDensity.compact,
                icon: Icon(
                  saved ? Icons.favorite : Icons.favorite_border,
                  color: saved ? AppColors.danger : AppColors.textTertiary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String _initials(String name) {
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts[1].substring(0, 1))
        .toUpperCase();
  }
}
