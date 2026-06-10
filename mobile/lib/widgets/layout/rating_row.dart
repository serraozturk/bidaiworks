import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class RatingRow extends StatelessWidget {
  final double rating;
  final int? count;
  final double size;
  final bool showCount;

  const RatingRow({
    super.key,
    required this.rating,
    this.count,
    this.size = 14,
    this.showCount = true,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(Icons.star_rounded, color: AppColors.star, size: size + 2),
        const SizedBox(width: 2),
        Text(
          rating.toStringAsFixed(1),
          style: TextStyle(
            fontWeight: FontWeight.w700,
            fontSize: size,
            color: AppColors.textPrimary,
          ),
        ),
        if (showCount && count != null) ...[
          const SizedBox(width: 4),
          Text(
            '($count)',
            style: TextStyle(
              fontSize: size - 1,
              color: AppColors.textTertiary,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ],
    );
  }
}
