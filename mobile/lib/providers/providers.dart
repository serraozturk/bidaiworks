import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../core/supabase/supabase_client.dart';
import '../models/models.dart';
import '../services/ai_estimate_service.dart';
import '../services/auth_service.dart';
import '../services/category_service.dart';
import '../services/contractor_service.dart';
import '../services/message_service.dart';
import '../services/offer_service.dart';
import '../services/payment_service.dart';
import '../services/profile_service.dart';
import '../services/project_service.dart';
import '../services/quote_service.dart';
import '../services/review_service.dart';

// -------- Service singletons -----------
final authServiceProvider = Provider<AuthService>((_) => AuthService());
final profileServiceProvider =
    Provider<ProfileService>((_) => ProfileService());
final categoryServiceProvider =
    Provider<CategoryService>((_) => CategoryService());
final projectServiceProvider =
    Provider<ProjectService>((_) => ProjectService());
final contractorServiceProvider =
    Provider<ContractorService>((_) => ContractorService());
final quoteServiceProvider = Provider<QuoteService>((_) => QuoteService());
final offerServiceProvider = Provider<OfferService>((_) => OfferService());
final messageServiceProvider =
    Provider<MessageService>((_) => MessageService());
final paymentServiceProvider =
    Provider<PaymentService>((_) => PaymentService());
final reviewServiceProvider = Provider<ReviewService>((_) => ReviewService());
final aiEstimateServiceProvider =
    Provider<AiEstimateService>((_) => AiEstimateService());

// -------- Auth state -----------
final authStateProvider = StreamProvider<AuthState>((ref) {
  return ref.watch(authServiceProvider).onAuthChange;
});

final currentUserProvider = Provider<User?>((ref) {
  ref.watch(authStateProvider);
  return SupabaseService.currentUser;
});

final currentProfileProvider = FutureProvider<Profile?>((ref) async {
  final user = ref.watch(currentUserProvider);
  if (user == null) return null;
  return ref.read(profileServiceProvider).fetchProfile(user.id);
});

final currentRoleProvider = Provider<UserRole?>((ref) {
  return ref.watch(currentProfileProvider).valueOrNull?.role;
});

// -------- Categories -----------
final categoriesProvider = FutureProvider<List<Category>>((ref) {
  return ref.read(categoryServiceProvider).all();
});

// -------- Projects (homeowner side) -----------
final myProjectsProvider = FutureProvider<List<Project>>((ref) {
  ref.watch(authStateProvider);
  return ref.read(projectServiceProvider).myProjects();
});

final projectByIdProvider =
    FutureProvider.family<Project?, String>((ref, id) async {
  return ref.read(projectServiceProvider).byId(id);
});

// -------- Project feed (contractor side) -----------
final jobFeedFilterProvider =
    StateProvider<({String? categoryId, String? zip})>(
        (_) => (categoryId: null, zip: null));

final jobFeedProvider = FutureProvider<List<Project>>((ref) {
  final filter = ref.watch(jobFeedFilterProvider);
  return ref.read(projectServiceProvider).jobFeed(
        categoryId: filter.categoryId,
        zipCode: filter.zip,
      );
});

// -------- Quotes -----------
final quotesForProjectProvider =
    FutureProvider.family<List<Quote>, String>((ref, projectId) {
  return ref.read(quoteServiceProvider).forProject(projectId);
});

final myQuotesProvider = FutureProvider<List<Quote>>((ref) {
  return ref.read(quoteServiceProvider).myQuotes();
});

// -------- Contractors browse -----------
final contractorBrowseFilterProvider =
    StateProvider<({String? categoryId, String? zip})>(
        (_) => (categoryId: null, zip: null));

final contractorBrowseProvider =
    FutureProvider<List<ContractorBrowseRow>>((ref) {
  final filter = ref.watch(contractorBrowseFilterProvider);
  return ref.read(contractorServiceProvider).browse(
        categoryId: filter.categoryId,
        zip: filter.zip,
      );
});

final contractorByIdProvider =
    FutureProvider.family<ContractorBrowseRow?, String>((ref, id) {
  return ref.read(contractorServiceProvider).byId(id);
});

final savedContractorIdsProvider = FutureProvider<List<String>>((ref) {
  ref.watch(authStateProvider);
  return ref.read(contractorServiceProvider).savedIds();
});

// -------- Conversations -----------
final myConversationsProvider = FutureProvider<List<Conversation>>((ref) {
  ref.watch(authStateProvider);
  return ref.read(messageServiceProvider).myConversations();
});

// Realtime messages in a single conversation
final conversationMessagesProvider =
    StreamProvider.family<List<Message>, String>((ref, conversationId) {
  return ref.read(messageServiceProvider).streamMessages(conversationId);
});

// -------- Reviews -----------
final reviewsForContractorProvider =
    FutureProvider.family<List<Review>, String>((ref, id) {
  return ref.read(reviewServiceProvider).forContractor(id);
});

// -------- Contractor financials -----------
final contractorBalanceProvider = FutureProvider<ContractorBalance>((ref) {
  ref.watch(authStateProvider);
  return ref.read(paymentServiceProvider).contractorBalance();
});

final contractorPaymentsProvider = FutureProvider<List<Payment>>((ref) {
  ref.watch(authStateProvider);
  return ref.read(paymentServiceProvider).contractorPayments();
});

/// Projects the contractor has been paid on by a homeowner — drives the
/// contractor "Active jobs" screen (awaiting-commitment vs. live jobs).
final contractorJobProjectsProvider =
    FutureProvider<List<Project>>((ref) async {
  ref.watch(authStateProvider);
  await ref.read(paymentServiceProvider).expireStaleDeals();
  final pays = await ref.read(paymentServiceProvider).contractorPayments();
  final ids = pays.map((p) => p.projectId).toSet().toList();
  return ref.read(projectServiceProvider).byIds(ids);
});

final myWithdrawalsProvider = FutureProvider<List<Withdrawal>>((ref) {
  ref.watch(authStateProvider);
  return ref.read(paymentServiceProvider).myWithdrawals();
});

// -------- Offers -----------
final offersInConversationProvider =
    FutureProvider.family<List<Offer>, String>((ref, conversationId) {
  return ref.read(offerServiceProvider).forConversation(conversationId);
});

final homeownerIncomingOffersProvider = FutureProvider<List<Offer>>((ref) {
  return ref.read(offerServiceProvider).myIncomingHomeowner();
});
