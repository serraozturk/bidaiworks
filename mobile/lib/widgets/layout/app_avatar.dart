import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

class AppAvatar extends StatelessWidget {
  final String? url;
  final String fallbackInitials;
  final double size;
  final bool ring;
  final Color? ringColor;

  const AppAvatar({
    super.key,
    this.url,
    required this.fallbackInitials,
    this.size = 40,
    this.ring = false,
    this.ringColor,
  });

  @override
  Widget build(BuildContext context) {
    final base = ClipRRect(
      borderRadius: BorderRadius.circular(size),
      child: url == null || url!.isEmpty
          ? Container(
              width: size,
              height: size,
              color: AppColors.surfaceAlt,
              alignment: Alignment.center,
              child: Text(
                fallbackInitials,
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AppColors.textSecondary,
                  fontSize: size * 0.4,
                ),
              ),
            )
          : CachedNetworkImage(
              imageUrl: url!,
              width: size,
              height: size,
              fit: BoxFit.cover,
              placeholder: (_, __) => Container(
                color: AppColors.surfaceAlt,
                width: size,
                height: size,
              ),
              errorWidget: (_, __, ___) => Container(
                color: AppColors.surfaceAlt,
                width: size,
                height: size,
                alignment: Alignment.center,
                child: Text(
                  fallbackInitials,
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.textSecondary,
                    fontSize: size * 0.4,
                  ),
                ),
              ),
            ),
    );

    if (!ring) return base;
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        border: Border.all(color: ringColor ?? AppColors.primary, width: 2),
      ),
      child: base,
    );
  }
}
