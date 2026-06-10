import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/router/app_router.dart';
import 'core/supabase/supabase_client.dart';
import 'core/theme/app_theme.dart';
import 'core/utils/constants.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(SystemUiOverlayStyle.dark);

  try {
    await dotenv.load(fileName: '.env');
  } catch (_) {
    // .env not bundled — fall back to compile-time env if you wired one.
  }

  await SupabaseService.init();

  runApp(const ProviderScope(child: BidAiApp()));
}

class BidAiApp extends ConsumerStatefulWidget {
  const BidAiApp({super.key});

  @override
  ConsumerState<BidAiApp> createState() => _BidAiAppState();
}

class _BidAiAppState extends ConsumerState<BidAiApp> {
  late final GoRouter _router;

  @override
  void initState() {
    super.initState();
    _router = AppRouter.create(ref);
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: AppConstants.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      routerConfig: _router,
    );
  }
}
