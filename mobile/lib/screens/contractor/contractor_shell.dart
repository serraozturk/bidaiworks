import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';

class ContractorShell extends StatelessWidget {
  final Widget child;
  const ContractorShell({super.key, required this.child});

  static const _tabs = <_Tab>[
    _Tab(path: '/contractor/jobs', icon: Icons.work_outline,
        active: Icons.work, label: 'Jobs'),
    _Tab(path: '/contractor/quotes', icon: Icons.receipt_long_outlined,
        active: Icons.receipt_long, label: 'Quotes'),
    _Tab(path: '/contractor/messages', icon: Icons.chat_bubble_outline,
        active: Icons.chat_bubble, label: 'Inbox'),
    _Tab(path: '/contractor/projects', icon: Icons.construction_outlined,
        active: Icons.construction, label: 'Active'),
    _Tab(path: '/contractor/profile', icon: Icons.person_outline,
        active: Icons.person, label: 'Profile'),
  ];

  int _currentIndex(BuildContext ctx) {
    final loc = GoRouterState.of(ctx).matchedLocation;
    for (var i = 0; i < _tabs.length; i++) {
      if (loc.startsWith(_tabs[i].path)) return i;
    }
    return 0;
  }

  @override
  Widget build(BuildContext context) {
    final idx = _currentIndex(context);
    return Scaffold(
      body: child,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: idx,
        onTap: (i) => context.go(_tabs[i].path),
        items: [
          for (var i = 0; i < _tabs.length; i++)
            BottomNavigationBarItem(
              icon: Icon(_tabs[i].icon),
              activeIcon: Icon(_tabs[i].active, color: AppColors.primary),
              label: _tabs[i].label,
            ),
        ],
      ),
    );
  }
}

class _Tab {
  final String path;
  final IconData icon;
  final IconData active;
  final String label;
  const _Tab({
    required this.path,
    required this.icon,
    required this.active,
    required this.label,
  });
}
