// ============================================================================
// Global Station — TypeScript Types
// ============================================================================

export type BookingStatus = 'pending_payment' | 'confirmed' | 'completed' | 'reviewed' | 'cancelled';
export type AchieverStatus = 'pending' | 'approved' | 'suspended' | 'rejected';
export type DegreeLevel = 'undergraduate' | 'masters' | 'phd' | 'alumni';

export interface AchieverProfile {
  id: string;
  display_name: string;
  avatar_url: string | null;
  university_id: number | null;
  degree_level: DegreeLevel;
  subject: string;
  graduation_year: number | null;
  currently_enrolled: boolean;
  bio: string | null;
  help_topics: string[];
  languages: string[];
  session_price_vnd: number;
  session_duration_mins: number;
  status: AchieverStatus;
  verified_at: string | null;
  total_sessions: number;
  avg_rating: number;
  created_at: string;
}

export interface AchieverAvailability {
  id: number;
  achiever_id: string;
  day_of_week: number; // 0=Monday … 6=Sunday
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
  is_active: boolean;
}

export interface Booking {
  id: number;
  applicant_id: string;
  achiever_id: string;
  user_university_id: number | null;
  scheduled_at: string;
  duration_mins: number;
  session_price_vnd: number;
  glowbal_fee_vnd: number;
  achiever_payout_vnd: number;
  status: BookingStatus;
  payment_reference: string | null;
  payment_confirmed_at: string | null;
  meeting_link: string | null;
  applicant_notes: string | null;
  cancellation_reason: string | null;
  cancelled_by: 'applicant' | 'achiever' | 'admin' | null;
  created_at: string;
  updated_at: string;
}

export interface SessionReview {
  id: number;
  booking_id: number;
  reviewer_id: string;
  achiever_id: string;
  rating: number;
  comment: string | null;
  is_visible: boolean;
  created_at: string;
}

// ── Joined / composite types ───────────────────────────────────────────────

export interface AchieverWithUniversity extends AchieverProfile {
  university: {
    id: number;
    name: string;
    country: string;
  } | null;
}

export interface BookingWithParties extends Booking {
  achiever: {
    id: string;
    display_name: string;
    avatar_url: string | null;
    university_name: string | null;
  };
  applicant: {
    id: string;
    full_name: string | null;
    email: string | null;
  };
}

export interface ReviewWithReviewer extends SessionReview {
  reviewer_name: string | null;
}

// ── Form / input types ─────────────────────────────────────────────────────

export interface AchieverApplicationInput {
  display_name: string;
  avatar_url?: string | null;
  university_id: number;
  degree_level: DegreeLevel;
  subject: string;
  graduation_year?: number | null;
  currently_enrolled: boolean;
  bio: string;
  help_topics: string[];
  languages: string[];
  session_price_vnd: number;
  session_duration_mins: number;
}

export interface CreateBookingInput {
  achiever_id: string;
  scheduled_at: string;
  duration_mins: number;
  session_price_vnd: number;
  applicant_notes: string;
  user_university_id?: number | null;
}

export interface CreateReviewInput {
  booking_id: number;
  rating: number;
  comment?: string;
}

// ── Filter types ───────────────────────────────────────────────────────────

export interface AchieverFilters {
  university_id?: number;
  subject?: string;
  min_price?: number;
  max_price?: number;
  languages?: string[];
  currently_enrolled?: boolean;
  sort?: 'rating' | 'newest' | 'price_asc' | 'price_desc';
}
