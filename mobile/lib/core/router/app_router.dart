import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../models/models.dart';
import '../../providers/providers.dart';
import '../../screens/auth/login_screen.dart';
import '../../screens/auth/signup_screen.dart';
import '../../screens/auth/splash_screen.dart';
import '../../screens/checkout/checkout_screen.dart';
import '../../screens/contractor/contractor_commit_screen.dart';
import '../../screens/contractor/contractor_earnings_screen.dart';
import '../../screens/contractor/contractor_jobs_screen.dart';
import '../../screens/contractor/contractor_profile_screen.dart';
import '../../screens/contractor/contractor_projects_screen.dart';
import '../../screens/contractor/contractor_quotes_screen.dart';
import '../../screens/contractor/contractor_reviews_screen.dart';
import '../../screens/contractor/contractor_shell.dart';
import '../../screens/contractor/quote_compose_screen.dart';
import '../../screens/contractor/project_detail_contractor_screen.dart';
import '../../screens/homeowner/contractor_detail_screen.dart';
import '../../screens/homeowner/contractor_browse_screen.dart';
import '../../screens/homeowner/homeowner_offers_screen.dart';
import '../../screens/homeowner/homeowner_projects_screen.dart';
import '../../screens/homeowner/homeowner_reviews_screen.dart';
import '../../screens/homeowner/homeowner_saved_screen.dart';
import '../../screens/homeowner/homeowner_shell.dart';
import '../../screens/homeowner/leave_review_screen.dart';
import '../../screens/homeowner/new_project_screen.dart';
import '../../screens/homeowner/project_compare_screen.dart';
import '../../screens/homeowner/project_detail_screen.dart';
import '../../screens/messages/conversation_list_screen.dart';
import '../../screens/messages/conversation_thread_screen.dart';
import '../../screens/onboarding/contractor_onboarding_screen.dart';
import '../../screens/onboarding/homeowner_onboarding_screen.dart';
import '../../screens/common/settings_screen.dart';

class AppRouter {
  AppRouter._();

  static final _rootKey = GlobalKey<NavigatorState>();
  static final _homeownerShellKey = GlobalKey<NavigatorState>();
  static final _contractorShellKey = GlobalKey<NavigatorState>();

  static GoRouter create(Ref ref) {
    return GoRouter(
      navigatorKey: _rootKey,
      initialLocation: '/',
      refreshListenable: _AuthRefresh(ref),
      redirect: (ctx, state) {
        final user = ref.read(currentUserProvider);
        final profileAsync = ref.read(currentProfileProvider);
        final loc = state.matchedLocation;

        // Always allow splash + auth routes
        const pub = {'/', '/login', '/signup'};

        if (user == null) {
          if (pub.contains(loc)) return null;
          return '/login';
        }

        // Authenticated. If profile still loading, hold splash.
        if (profileAsync.isLoading) {
          return loc == '/' ? null : '/';
        }
        final profile = profileAsync.valueOrNull;
        if (profile == null) return null;

        // Onboarding gate
        if (loc.startsWith('/onboarding/')) return null;

        if (profile.role == UserRole.contractor) {
          // Force onboarding if no contractor profile is set yet — we don't
          // know that here without an extra query. Onboarding screen handles
          // its own redirect when company_name is present, so allow direct
          // routes.
          if (loc == '/login' || loc == '/signup' || loc == '/') {
            return '/contractor/jobs';
          }
        } else {
          if (loc == '/login' || loc == '/signup' || loc == '/') {
            return '/homeowner/projects';
          }
        }
        return null;
      },
      routes: [
        GoRoute(path: '/', builder: (_, __) => const SplashScreen()),
        GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
        GoRoute(path: '/signup', builder: (_, __) => const SignupScreen()),
        GoRoute(
          path: '/onboarding/homeowner',
          builder: (_, __) => const HomeownerOnboardingScreen(),
        ),
        GoRoute(
          path: '/onboarding/contractor',
          builder: (_, __) => const ContractorOnboardingScreen(),
        ),
        GoRoute(path: '/settings', builder: (_, __) => const SettingsScreen()),

        // --- Homeowner shell with bottom nav ---
        ShellRoute(
          navigatorKey: _homeownerShellKey,
          builder: (ctx, state, child) => HomeownerShell(child: child),
          routes: [
            GoRoute(
              path: '/homeowner/projects',
              builder: (_, __) => const HomeownerProjectsScreen(),
            ),
            GoRoute(
              path: '/homeowner/contractors',
              builder: (_, __) => const ContractorBrowseScreen(),
            ),
            GoRoute(
              path: '/homeowner/messages',
              builder: (_, __) =>
                  const ConversationListScreen(roleHint: UserRole.homeowner),
            ),
            GoRoute(
              path: '/homeowner/offers',
              builder: (_, __) => const HomeownerOffersScreen(),
            ),
            GoRoute(
              path: '/homeowner/saved',
              builder: (_, __) => const HomeownerSavedScreen(),
            ),
          ],
        ),
        GoRoute(
          path: '/homeowner/projects/new',
          parentNavigatorKey: _rootKey,
          builder: (_, __) => const NewProjectScreen(),
        ),
        GoRoute(
          path: '/homeowner/projects/:id',
          parentNavigatorKey: _rootKey,
          builder: (_, s) =>
              ProjectDetailScreen(projectId: s.pathParameters['id']!),
        ),
        GoRoute(
          path: '/homeowner/projects/:id/compare',
          parentNavigatorKey: _rootKey,
          builder: (_, s) =>
              ProjectCompareScreen(projectId: s.pathParameters['id']!),
        ),
        GoRoute(
          path: '/homeowner/projects/:id/review',
          parentNavigatorKey: _rootKey,
          builder: (_, s) => LeaveReviewScreen(
            projectId: s.pathParameters['id']!,
          ),
        ),
        GoRoute(
          path: '/homeowner/reviews',
          parentNavigatorKey: _rootKey,
          builder: (_, __) => const HomeownerReviewsScreen(),
        ),
        GoRoute(
          path: '/homeowner/contractors/:id',
          parentNavigatorKey: _rootKey,
          builder: (_, s) => ContractorDetailScreen(
            contractorId: s.pathParameters['id']!,
          ),
        ),
        GoRoute(
          path: '/checkout/:quoteId',
          parentNavigatorKey: _rootKey,
          builder: (_, s) =>
              CheckoutScreen(quoteId: s.pathParameters['quoteId']!),
        ),

        // --- Contractor shell with bottom nav ---
        ShellRoute(
          navigatorKey: _contractorShellKey,
          builder: (ctx, state, child) => ContractorShell(child: child),
          routes: [
            GoRoute(
              path: '/contractor/jobs',
              builder: (_, __) => const ContractorJobsScreen(),
            ),
            GoRoute(
              path: '/contractor/quotes',
              builder: (_, __) => const ContractorQuotesScreen(),
            ),
            GoRoute(
              path: '/contractor/messages',
              builder: (_, __) =>
                  const ConversationListScreen(roleHint: UserRole.contractor),
            ),
            GoRoute(
              path: '/contractor/projects',
              builder: (_, __) => const ContractorProjectsScreen(),
            ),
            GoRoute(
              path: '/contractor/profile',
              builder: (_, __) => const ContractorProfileScreen(),
            ),
          ],
        ),
        GoRoute(
          path: '/contractor/jobs/:id',
          parentNavigatorKey: _rootKey,
          builder: (_, s) => ProjectDetailContractorScreen(
              projectId: s.pathParameters['id']!),
        ),
        GoRoute(
          path: '/contractor/jobs/:id/quote',
          parentNavigatorKey: _rootKey,
          builder: (_, s) =>
              QuoteComposeScreen(projectId: s.pathParameters['id']!),
        ),
        GoRoute(
          path: '/contractor/commit/:id',
          parentNavigatorKey: _rootKey,
          builder: (_, s) =>
              ContractorCommitScreen(projectId: s.pathParameters['id']!),
        ),
        GoRoute(
          path: '/contractor/earnings',
          parentNavigatorKey: _rootKey,
          builder: (_, __) => const ContractorEarningsScreen(),
        ),
        GoRoute(
          path: '/contractor/reviews',
          parentNavigatorKey: _rootKey,
          builder: (_, __) => const ContractorReviewsScreen(),
        ),

        // Shared
        GoRoute(
          path: '/messages/:conversationId',
          parentNavigatorKey: _rootKey,
          builder: (_, s) => ConversationThreadScreen(
            conversationId: s.pathParameters['conversationId']!,
          ),
        ),
      ],
    );
  }
}

/// Rebuilds the router whenever auth state changes.
class _AuthRefresh extends ChangeNotifier {
  _AuthRefresh(this._ref) {
    _ref.listen(authStateProvider, (_, __) => notifyListeners());
    _ref.listen(currentProfileProvider, (_, __) => notifyListeners());
  }

  final Ref _ref;
}
