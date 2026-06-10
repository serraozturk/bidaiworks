import 'package:intl/intl.dart';

/// Currency, date, range, and label helpers used across the UI.
class Formatters {
  Formatters._();

  static final NumberFormat _usd = NumberFormat.simpleCurrency(
    locale: 'en_US',
    decimalDigits: 0,
  );
  static final NumberFormat _usdCents = NumberFormat.simpleCurrency(
    locale: 'en_US',
    decimalDigits: 2,
  );
  static final DateFormat _shortDate = DateFormat.yMMMd();
  static final DateFormat _dayMonth = DateFormat('MMM d');
  static final DateFormat _time = DateFormat('h:mm a');

  static String currency(num? amount, {bool withCents = false}) {
    if (amount == null) return '—';
    return (withCents ? _usdCents : _usd).format(amount);
  }

  static String range(num? min, num? max) {
    if (min == null && max == null) return '—';
    if (min == null) return 'up to ${currency(max)}';
    if (max == null) return 'from ${currency(min)}';
    if (min == max) return currency(min);
    return '${currency(min)} – ${currency(max)}';
  }

  static String date(DateTime? d) => d == null ? '—' : _shortDate.format(d);

  static String relativeShort(DateTime? d) {
    if (d == null) return '—';
    final now = DateTime.now();
    final diff = now.difference(d);
    if (diff.inSeconds < 60) return 'just now';
    if (diff.inMinutes < 60) return '${diff.inMinutes}m';
    if (diff.inHours < 24) return '${diff.inHours}h';
    if (diff.inDays < 7) return '${diff.inDays}d';
    if (now.year == d.year) return _dayMonth.format(d);
    return _shortDate.format(d);
  }

  static String time(DateTime d) => _time.format(d);

  /// "Bathroom Remodel" stays as-is, "in_progress" → "In progress"
  static String humanize(String value) {
    return value
        .replaceAll('_', ' ')
        .split(' ')
        .map((w) => w.isEmpty ? w : w[0].toUpperCase() + w.substring(1))
        .join(' ');
  }
}
