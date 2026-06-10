import 'package:flutter/material.dart';

/// bidAI brand palette — clean marketplace, Vinted-inspired neutrals
/// with a confident accent. All colors used by the app live here.
class AppColors {
  AppColors._();

  // Primary brand
  static const Color primary = Color(0xFF0B6CFF); // Trustworthy blue
  static const Color primaryDark = Color(0xFF0850C4);
  static const Color primarySoft = Color(0xFFE6F0FF);

  // Accent
  static const Color accent = Color(0xFF00B894); // Teal-green for success/quotes

  // Roles — never use for buttons, only for badges/avatars
  static const Color homeownerTint = Color(0xFFFFF4E5);
  static const Color homeownerInk = Color(0xFFB45309);
  static const Color contractorTint = Color(0xFFE6F4FF);
  static const Color contractorInk = Color(0xFF0850C4);

  // Surfaces
  static const Color background = Color(0xFFFAFAFA);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color surfaceAlt = Color(0xFFF5F5F7);
  static const Color overlay = Color(0x99000000);

  // Text
  static const Color textPrimary = Color(0xFF111114);
  static const Color textSecondary = Color(0xFF55555B);
  static const Color textTertiary = Color(0xFF8A8A91);
  static const Color textOnPrimary = Color(0xFFFFFFFF);

  // Borders
  static const Color border = Color(0xFFE5E5E9);
  static const Color borderStrong = Color(0xFFD0D0D6);

  // Status
  static const Color success = Color(0xFF16A34A);
  static const Color successSoft = Color(0xFFDCFCE7);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningSoft = Color(0xFFFEF3C7);
  static const Color danger = Color(0xFFDC2626);
  static const Color dangerSoft = Color(0xFFFEE2E2);
  static const Color info = Color(0xFF2563EB);
  static const Color infoSoft = Color(0xFFDBEAFE);

  // Rating
  static const Color star = Color(0xFFF59E0B);
}
