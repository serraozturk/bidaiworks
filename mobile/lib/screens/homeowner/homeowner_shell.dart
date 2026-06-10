import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../core/theme/app_colors.dart';

class HomeownerShell extends StatelessWidget {
  final Widget child;
  const HomeownerShell({super.key, required this.child});

  static const _tabs = <_Tab>[
    _Tab(path: '/homeowner/projects', icon: Icons.dashboard_outlined,
        active: Icons.dashboard, label: 'Projects'),
    _Tab(path: '/homeowner/contractors', icon: Icons.search_outlined,
        active: Icons.search, label: 'Discover'),
    _Tab(path: '/homeowner/messages', icon: Icons.chat_bubble_outline,
        active: Icons.chat_bubble, label: 'Inbox'),
    _Tab(path: '/homeowner/offers', icon: Icons.local_offer_outlined,
        active: Icons.local_offer, label: 'Offers'),
    _Tab(path: '/homeowner/saved', icon: Icons.favorite_border,
        active: Icons.favorite, label: 'Saved'),
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
      floatingActionButton: idx == 0
          ? FloatingActionButton.extended(
              onPressed: () => context.push('/homeowner/projects/new'),
              icon: const Icon(Icons.add),
              label: const Text('Post project'),
            )
          : null,
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
