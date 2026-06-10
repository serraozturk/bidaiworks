/**
 * Application-level TypeScript types.
 *
 * Current architecture:
 * - quotes removed
 * - full offer flow is handled through offers
 * - checkout/payment should use offer_id
 * - project brief details are stored in project_answers,
 *   project_required_photos and project_material_preferences
 */

export type UserRole = 'homeowner' | 'contractor';

export type ProjectStatus =
  | 'draft'
  | 'open'
  | 'in_review'
  | 'negotiating'
  | 'awarded'
  | 'pending_payment'
  | 'paid'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export type PaymentStatus = 'held' | 'released' | 'refunded';
export type PaymentMethod = 'card' | 'bank' | 'wire';
export type WithdrawalStatus = 'pending' | 'completed' | 'failed';

export type OfferKind =
  | 'contractor_offer'
  | 'homeowner_budget_offer'
  | 'budget_offer'
  | 'counter_offer'
  | 'quick_offer';

export type OfferStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'countered'
  | 'withdrawn'
  | 'expired';

export type OfferType =
  | 'fixed_price'
  | 'estimate_based_on_details'
  | 'final_after_site_visit'
  | 'labor_only'
  | 'labor_and_materials';

export type MessageKind = 'text' | 'offer_card' | 'system';

export type QualityLevel = 'budget' | 'standard' | 'premium' | 'luxury';

export type ProjectScope =
  | 'full_remodel'
  | 'partial_remodel'
  | 'repair'
  | 'new_install';

export type ProjectQuestionType =
  | 'text'
  | 'textarea'
  | 'single_select'
  | 'multi_select'
  | 'number'
  | 'yes_no';

/** Display metadata for the quality-level UI */
export const QUALITY_LEVELS: Record<
  QualityLevel,
  { label: string; description: string; example: string }
> = {
  budget: {
    label: 'Budget',
    description: 'Entry-level fixtures and finishes',
    example: 'Big-box store cabinets, laminate counters, basic tile',
  },
  standard: {
    label: 'Standard',
    description: 'Mid-range, reliable, mainstream brands',
    example: 'Semi-custom cabinets, quartz counters, porcelain tile',
  },
  premium: {
    label: 'Premium',
    description: 'High-end finishes and custom work',
    example: 'Custom cabinetry, natural stone, designer fixtures',
  },
  luxury: {
    label: 'Luxury',
    description: 'Top-tier materials, custom details and designer finishes',
    example: 'Fully custom cabinetry, premium slabs, luxury fixtures',
  },
};

/** Display metadata for the project-scope UI */
export const PROJECT_SCOPES: Record<
  ProjectScope,
  { label: string; description: string }
> = {
  full_remodel: {
    label: 'Full remodel',
    description: 'Gut and rebuild everything',
  },
  partial_remodel: {
    label: 'Partial remodel',
    description: 'Keep some elements, replace others',
  },
  repair: {
    label: 'Repair',
    description: "Fix what's broken, no scope expansion",
  },
  new_install: {
    label: 'New install',
    description: 'Brand-new build, addition, deck, fixture or system',
  },
};

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  parent_id?: string | null;
  slug: string;
  name: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  active?: boolean;
  commission_rate?: number | null;
}

export interface ContractorProfile {
  user_id: string;
  company_name: string;
  license_number: string | null;
  license_status?: 'none' | 'submitted' | 'verified' | 'expired';
  license_expires_at?: string | null;
  bio: string | null;
  years_in_business: number | null;
  website: string | null;
  logo_url: string | null;
  cover_image_url?: string | null;
  insurance_status?: 'none' | 'submitted' | 'verified' | 'expired';
  insurance_carrier?: string | null;
  insurance_expires_at?: string | null;
  verified: boolean;
  verified_at?: string | null;
  rating_avg: number;
  rating_count: number;
  google_rating?: number | null;
  google_review_count?: number | null;
  google_profile_url?: string | null;
  google_place_id?: string | null;
  google_last_synced_at?: string | null;
  completed_jobs_count?: number;
  response_time_hours?: number | null;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  homeowner_id: string;
  category_id: string;

  title: string;
  description: string;
  zip_code: string;
  city: string | null;
  state: string | null;
  street_address: string | null;

  square_footage: number | null;
  budget_min: number | null;
  budget_max: number | null;
  desired_start_date: string | null;

  quality_level: QualityLevel | null;
  project_scope: ProjectScope | null;
  material_preferences: string | null;

  property_type: string | null;
  homeowner_readiness: string | null;
  desired_start_timing: string | null;
  desired_completion_timing: string | null;
  access_notes: string | null;
  measurement_notes: string | null;
  photos_complete: boolean;
  brief_complete: boolean;

  ai_estimate_min: number | null;
  ai_estimate_max: number | null;
  ai_estimate_reasoning: string | null;

  status: ProjectStatus;

  /**
   * Old field kept only if it still exists in your DB.
   * New system should use awarded_offer_id.
   */
  awarded_offer_id: string | null;

  created_at: string;
  updated_at: string;
}

export interface ProjectPhoto {
  id: string;
  project_id: string;
  url: string;
  caption: string | null;
  position: number;
  created_at: string;
}

export interface ProjectAnswer {
  id: string;
  project_id: string;
  question_key: string;
  question_label: string;
  answer_value:
    | string
    | number
    | boolean
    | string[]
    | Record<string, unknown>
    | null;
  created_at: string;
}

export interface ProjectRequiredPhoto {
  id: string;
  project_id: string;
  photo_key: string;
  photo_label: string;
  photo_description: string | null;
  image_url: string | null;
  is_required: boolean;
  uploaded_at: string | null;
  created_at: string;
}

export interface ProjectMaterialPreference {
  id: string;
  project_id: string;
  item_key: string;
  item_label: string;
  preferred_quality: string | null;
  preferred_material: string | null;
  preferred_brand: string | null;
  custom_note: string | null;
  zip_based_suggestion: Record<string, unknown> | null;
  created_at: string;
}

export interface Offer {
  id: string;
  project_id: string;
  conversation_id: string | null;
  parent_offer_id: string | null;

  sender_id: string;
  sender_role: UserRole;

  kind: OfferKind;
  amount: number;
  timeline_days: number | null;

  scope_summary: string | null;
  message: string | null;

  included_scope: string | null;
  excluded_scope: string | null;
  material_allowance: string | null;
  assumptions: string | null;
  risk_notes: string | null;
  warranty: string | null;

  offer_type: OfferType | null;
  earliest_start_date: string | null;

  materials_included: boolean;
  labor_included: boolean;
  cleanup_included: boolean;
  permits_included: boolean;
  site_visit_required: boolean;

  status: OfferStatus;
  expires_at: string | null;
  responded_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface Payment {
  id: string;
  project_id: string;

  /**
   * Old field kept only if it still exists in your DB.
   * New system should use offer_id.
   */
  offer_id: string | null;

  payer_id: string;
  payee_id: string;

  total_amount: number;
  deposit_amount: number;
  deposit_pct: number;

  method: PaymentMethod;
  card_last4: string | null;

  status: PaymentStatus;
  held_at: string;
  released_at: string | null;
  refunded_at: string | null;

  created_at: string;
  updated_at: string;
}

export interface Withdrawal {
  id: string;
  contractor_id: string;
  amount: number;
  status: WithdrawalStatus;
  bank_name: string | null;
  routing_last4: string | null;
  account_last4: string | null;
  requested_at: string;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Conversation {
  id: string;
  project_id: string;
  homeowner_id: string;
  contractor_id: string;
  last_message_at: string;
  last_read_homeowner_at?: string;
  last_read_contractor_at?: string;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  kind?: MessageKind;
  offer_id?: string | null;

  /**
   * Old field kept only if it still exists in your DB.
   * New system should use offer_id.
   */

  created_at: string;
}

export interface Review {
  id: string;
  project_id: string;
  reviewer_id: string;
  contractor_id: string;
  rating: number;
  rating_overall?: number | null;
  rating_work_quality?: number | null;
  rating_communication?: number | null;
  rating_punctuality?: number | null;
  rating_value?: number | null;
  comment: string | null;
  created_at: string;
}

/* ---------- Composite shapes returned by joined queries ---------- */

export interface ProjectWithCategory extends Project {
  categories: Category;
  project_photos?: ProjectPhoto[];
  project_answers?: ProjectAnswer[];
  project_required_photos?: ProjectRequiredPhoto[];
  project_material_preferences?: ProjectMaterialPreference[];
}

export interface OfferWithSender extends Offer {
  profiles?: Profile | null;
}

export interface OfferWithContractor extends Offer {
  contractor_profiles?: ContractorProfile | null;
  profiles?: Profile | null;
}

export interface ConversationWithProject extends Conversation {
  projects?: ProjectWithCategory | null;
}

export interface PaymentWithOffer extends Payment {
  offers?: Offer | null;
  projects?: Project | null;
}
