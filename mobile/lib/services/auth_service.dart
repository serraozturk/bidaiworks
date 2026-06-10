import 'package:supabase_flutter/supabase_flutter.dart';
import '../core/supabase/supabase_client.dart';
import '../models/models.dart';

class AuthService {
  final SupabaseClient _sb = SupabaseService.client;

  Stream<AuthState> get onAuthChange => _sb.auth.onAuthStateChange;

  User? get currentUser => _sb.auth.currentUser;
  String? get currentUserId => currentUser?.id;
  bool get isSignedIn => currentUser != null;

  Future<AuthResponse> signIn({
    required String email,
    required String password,
  }) =>
      _sb.auth.signInWithPassword(email: email, password: password);

  Future<AuthResponse> signUp({
    required String email,
    required String password,
    required UserRole role,
    String? fullName,
  }) async {
    final res = await _sb.auth.signUp(
      email: email,
      password: password,
      data: {
        'role': EnumCodec.userRoleToDb(role),
        if (fullName != null && fullName.isNotEmpty) 'full_name': fullName,
      },
    );
    return res;
  }

  Future<void> signOut() => _sb.auth.signOut();

  Future<void> resetPassword(String email) =>
      _sb.auth.resetPasswordForEmail(email);
}
