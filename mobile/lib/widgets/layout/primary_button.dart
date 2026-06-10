import 'package:flutter/material.dart';
import '../../core/theme/app_colors.dart';

/// A button that shows a spinner while [onPressed] is running and is
/// disabled in the meantime, preventing double-taps.
class AsyncPrimaryButton extends StatefulWidget {
  final String label;
  final Future<void> Function()? onPressed;
  final IconData? icon;
  final bool destructive;
  final bool outlined;
  final bool fullWidth;

  const AsyncPrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.destructive = false,
    this.outlined = false,
    this.fullWidth = true,
  });

  @override
  State<AsyncPrimaryButton> createState() => _AsyncPrimaryButtonState();
}

class _AsyncPrimaryButtonState extends State<AsyncPrimaryButton> {
  bool _busy = false;

  Future<void> _handle() async {
    if (_busy || widget.onPressed == null) return;
    setState(() => _busy = true);
    try {
      await widget.onPressed!();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.destructive ? AppColors.danger : AppColors.primary;
    final child = _busy
        ? const SizedBox(
            height: 18,
            width: 18,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              valueColor: AlwaysStoppedAnimation(Colors.white),
            ),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (widget.icon != null) ...[
                Icon(widget.icon, size: 18),
                const SizedBox(width: 8),
              ],
              Text(widget.label),
            ],
          );

    final button = widget.outlined
        ? OutlinedButton(
            onPressed: _busy ? null : _handle,
            style: OutlinedButton.styleFrom(
              foregroundColor: color,
              side: BorderSide(color: color),
            ),
            child: child,
          )
        : ElevatedButton(
            onPressed: _busy ? null : _handle,
            style: ElevatedButton.styleFrom(backgroundColor: color),
            child: child,
          );

    return widget.fullWidth
        ? SizedBox(width: double.infinity, child: button)
        : button;
  }
}
