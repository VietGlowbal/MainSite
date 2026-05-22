// ============================================================================
// GLOWBAL Mentorship Hub — TypeScript Types
// ============================================================================
//
// This is the canonical type set for the redesigned 1-2-1 / mentorship
// experience. It lives alongside `src/types/achievers.ts` (legacy) which is
// kept for backward compatibility with the admin and review pages while we
// migrate. New code should import from here.

export type Currency = 'USD' | 'GBP' | 'VND';

export type MentorStatus = 'pending' | 'approved' | 'suspended' | 'rejected';

export type DegreeLevel = 'undergraduate' | 'masters' | 'phd' | 'alumni';

export type SlotStatus = 'open' | 'held' | 'booked' | 'closed';

export type BookingStatus =
  | 'pending_payment'
  | 'confirmed'
  | 'completed'
  | 'reviewed'
  | 'cancelled';

// ── Mentor profile (renamed from AchieverProfile) ───────────────────────────

export interface MentorProfile {
  id: string;
  display_name: string;
  legal_name: string | null;
  date_of_birth: string | null;
  avatar_url: string | null;

  university_id: number | null;
  degree_level: DegreeLevel;
  subject: string;
  graduation_year: number | null;
  study_start_year: number | null;
  currently_enrolled: boolean;

  bio: string | null;
  help_topics: string[];
  strengths: string[];
  languages: string[];

  // Multi-currency hourly pricing. Stored in the smallest currency unit
  // (cents for USD/GBP, đồng for VND). `hourly_rate_amount` represents
  // a 60-minute session.
  hourly_rate_amount: number;
  hourly_rate_currency: Currency;

  // Verification documents (private storage keys)
  cv_storage_key: string | null;
  acceptance_letter_storage_key: string | null;
  transcript_storage_key: string | null;
  student_card_storage_key: string | null;

  status: MentorStatus;
  verified_at: string | null;
  total_sessions: number;
  avg_rating: number;
  stripe_account_id: string | null;
  created_at: string;
}

export interface MentorWithUniversity extends MentorProfile {
  university: {
    id: number;
    name: string;
    country: string;
  } | null;
}

// ── Calendar slots (replace weekly availability for new flow) ───────────────

export interface MentorAvailabilitySlot {
  id: number;
  mentor_id: string;
  starts_at: string; // ISO timestamp UTC
  ends_at: string;
  status: SlotStatus;
  booking_id: number | null;
  hold_expires_at: string | null;
  created_at: string;
}

// ── Booking ─────────────────────────────────────────────────────────────────

export interface MentorshipBooking {
  id: number;
  applicant_id: string;
  achiever_id: string; // legacy column name → mentor id
  user_university_id: number | null;
  scheduled_at: string;
  duration_mins: number;

  // New canonical money fields. Legacy columns (session_price_vnd,
  // glowbal_fee_vnd, achiever_payout_vnd) still exist on the row.
  currency: Currency;
  amount_total: number;
  amount_mentor: number;
  amount_service_fee: number;

  status: BookingStatus;

  // Stripe identifiers
  stripe_session_id: string | null;
  stripe_payment_intent_id: string | null;
  payment_reference: string | null;
  payment_confirmed_at: string | null;

  // Slot link for cleanup on cancel
  slot_id: number | null;

  // Help request prompts
  help_topic: string | null;
  help_questions: string | null;
  help_outcome: string | null;
  applicant_notes: string | null; // legacy

  meeting_link: string | null;

  cancellation_reason: string | null;
  cancelled_by: 'applicant' | 'achiever' | 'admin' | null;

  created_at: string;
  updated_at: string;
}

export interface MentorshipBookingWithMentor extends MentorshipBooking {
  mentor: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    university_name: string | null;
  };
}

// ── Reviews ─────────────────────────────────────────────────────────────────

export interface MentorReview {
  id: number;
  booking_id: number;
  reviewer_id: string;
  achiever_id: string; // legacy column name → mentor id
  rating: number;
  comment: string | null;
  is_visible: boolean;
  created_at: string;
}

export interface MentorReviewWithReviewer extends MentorReview {
  reviewer_name: string | null;
}

// ── Filters ────────────────────────────────────────────────────────────────

export interface MentorBrowseFilters {
  query?: string;
  university_id?: number;
  country?: string;
  subject?: string;
  languages?: string[];
  currently_enrolled?: boolean;
  // Filter by available date — find mentors with at least one open slot
  // on or after this YYYY-MM-DD.
  available_from?: string;
  sort?: 'rating' | 'newest' | 'price_asc' | 'price_desc';
}
