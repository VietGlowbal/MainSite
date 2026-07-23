'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import { createClient } from '@/lib/supabase/client';
import type {
  CourseSearchSessionResponse,
  CourseSearchResult,
} from '@/app/api/course-search-sessions/route';
import { CourseResultCard } from './course-result-card';
import { UpgradePromptModal } from './upgrade-prompt-modal';
import { track } from '@vercel/analytics';
import { logSearchError } from '@/lib/error-logging/error-logger';

interface ExtendedUserEntitlement {
  plan: 'free' | 'plus' | 'team' | 'admin';
  courseSearchLimit: number;
  courseSearchesUsed: number;
  courseAddLimit: number;
  coursesAdded: number;
  canCreateSession?: boolean;
  upgradeRequired?: boolean;
  limitReason?: string;
}

type ModalStep = 'confirm' | 'results' | 'added';

interface CourseSearchSessionModalProps {
  isOpen: boolean;
  onClose: () => void;
  universityId: number;
  universityName: string;
  universityDomain: string;
}

interface StudentProfile {
  user_id: string;
  nationality: string | null;
  study_level: string | null;
  grades_summary: Record<string, unknown> | null;
  budget_range: string | null;
}

interface ConfirmStepData {
  courseSubject: string;
  studyLevel: string;
}

interface AddCoursesResponse {
  applicationsCreated: Array<{
    id: string;
    courseName: string;
    courseUrl: string;
    parseStatus: string;
  }>;
  skippedDuplicates: Array<{
    courseName: string;
    courseUrl: string;
    existingApplicationId: string;
  }>;
  failedValidation: Array<{
    courseName: string;
    courseUrl: string;
    reason: string;
  }>;
  usage: {
    coursesAdded: number;
    courseAddLimit: number;
    plan: string;
  };
}

const STUDY_LEVELS = [
  'Undergraduate',
  'Postgraduate Taught',
  'Postgraduate Research',
  'Foundation',
];

/**
 * CourseSearchSessionModal — Multi-step flow for searching and selecting courses
 * 
 * This modal provides a guided experience for students to:
 * 1. Confirm their details and search intent (Step: 'confirm')
 * 2. Review AI-powered course search results (Step: 'results')
 * 3. See confirmation that the course has been added (Step: 'added')
 * 
 * Design:
 * - Desktop: Centered overlay with max-width 800px
 * - Mobile (<640px): Full-screen overlay with slide-up animation
 * - Respects Escape key to close
 * - Uses Framer Motion for smooth transitions
 */
export function CourseSearchSessionModal({
  isOpen,
  onClose,
  universityId,
  universityName,
  universityDomain,
}: CourseSearchSessionModalProps) {
  const router = useRouter();
  const [step, setStep] = useState<ModalStep>('confirm');
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [entitlement, setEntitlement] = useState<ExtendedUserEntitlement | null>(null);
  const [isLoadingData, setIsLoadingData] = useState(false);
  
  // Search state
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<CourseSearchResult[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<ConfirmStepData>({
    courseSubject: '',
    studyLevel: '',
  });
  const [validationError, setValidationError] = useState<string>('');
  
  // Quota warning state
  const [showQuotaWarning, setShowQuotaWarning] = useState(false);
  
  // Selection state for Step 2
  const [selectedResultIds, setSelectedResultIds] = useState<Set<string>>(new Set());
  
  // Add courses state
  const [isAddingCourses, setIsAddingCourses] = useState(false);
  const [addCoursesError, setAddCoursesError] = useState<string | null>(null);
  const [addCoursesResponse, setAddCoursesResponse] = useState<AddCoursesResponse | null>(null);
  
  // Upgrade modal state for 403 errors
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Fetch user and their data when modal opens
  useEffect(() => {
    if (!isOpen) return;

    const fetchUserData = async () => {
      setIsLoadingData(true);
      const supabase = createClient();

      try {
        // Get authenticated user
        const { data: userData, error: userError } = await supabase.auth.getUser();
        
        if (userError || !userData.user) {
          setUserId(null);
          setProfile(null);
          setEntitlement(null);
          setIsLoadingData(false);
          return;
        }

        setUserId(userData.user.id);

        // Fetch student profile for prefilling
        const { data: profileData, error: profileError } = await supabase
          .from('student_profiles')
          .select('user_id, nationality, study_level, grades_summary, budget_range')
          .eq('user_id', userData.user.id)
          .single();

        if (!profileError && profileData) {
          setProfile(profileData);
          
          // Prefill study level if available
          if (profileData.study_level && !formData.studyLevel) {
            setFormData(prev => ({
              ...prev,
              studyLevel: profileData.study_level || '',
            }));
          }
        }

        // Fetch entitlement data
        const entitlementResponse = await fetch('/api/entitlements/check', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: userData.user.id }),
        });

        if (entitlementResponse.ok) {
          const entitlementData = await entitlementResponse.json();
          setEntitlement(entitlementData);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      } finally {
        setIsLoadingData(false);
      }
    };

    fetchUserData();
  }, [isOpen]);

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  // Reset to confirm step when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('confirm');
      setValidationError('');
      setSearchError(null);
      setShowQuotaWarning(false);
      setSelectedResultIds(new Set()); // Clear selection
      // Don't reset form data to preserve prefilled values
    }
  }, [isOpen]);

  // Validate form
  const validateForm = (): boolean => {
    if (!formData.courseSubject.trim()) {
      setValidationError('Please enter a course or subject');
      return false;
    }
    setValidationError('');
    return true;
  };

  // Handle form submission with auth check and API call
  const handleFindCourses = async () => {
    if (!validateForm()) return;
    
    setSearchError(null);
    
    // Task 6.2: Allow logged-out users to execute searches
    // Check authentication but don't require it for search execution
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    // For logged-in users, check if they can create a session
    if (user && entitlement && !entitlement.canCreateSession) {
      // Show upgrade message - already displayed in UI
      return;
    }

    // Show loading state
    setIsSearching(true);
    setSearchError(null);

    try {
      // Build request body
      // Task 6.2: For logged-out users, profile will be null and that's acceptable
      const requestBody = {
        universityId,
        query: formData.courseSubject.trim(),
        studyLevel: formData.studyLevel || undefined,
        studentProfile: profile ? {
          nationality: profile.nationality,
          studyLevel: profile.study_level,
          gradesSummary: profile.grades_summary,
          budgetRange: profile.budget_range,
        } : undefined,
      };

      // Call POST /api/course-search-sessions
      const response = await fetch('/api/course-search-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Task 22.1: Handle specific error codes with user-friendly messages
        if (response.status === 401) {
          // Session expired - redirect to auth
          const redirectUrl = `/apply?universityId=${universityId}&openCourseSearch=true`;
          router.push(`/auth?redirect=${encodeURIComponent(redirectUrl)}`);
          return;
        }
        
        if (response.status === 403) {
          // Task 22.1: Quota exceeded - user-friendly message
          // Task 22.2: Log error
          logSearchError({
            message: errorData.error || 'Search quota exceeded',
            universityId,
            query: formData.courseSubject,
            statusCode: 403,
          });
          setSearchError(errorData.error || 'You have reached your search limit for this month.');
          setIsSearching(false);
          return;
        }
        
        if (response.status === 408) {
          // Task 22.1: Timeout - user-friendly message with fallback suggestion
          // Task 22.2: Log error
          logSearchError({
            message: 'Search timeout',
            universityId,
            query: formData.courseSubject,
            statusCode: 408,
          });
          setSearchError('Search temporarily unavailable. Try again or use manual paste.');
          setIsSearching(false);
          return;
        }
        
        // Task 22.1: Generic error with fallback suggestion
        // Task 22.2: Log error
        logSearchError({
          message: errorData.error || 'Search failed',
          universityId,
          query: formData.courseSubject,
          statusCode: response.status,
        });
        throw new Error(errorData.error || 'Search temporarily unavailable. Try again or use manual paste.');
      }

      // Success - parse response
      const data: CourseSearchSessionResponse = await response.json();
      
      // Update entitlement with new usage data
      if (data.usage) {
        setEntitlement(prev => prev ? {
          ...prev,
          courseSearchesUsed: data.usage.courseSearchesUsed,
          courseSearchLimit: data.usage.courseSearchLimit,
          coursesAdded: data.usage.coursesAdded,
          courseAddLimit: data.usage.courseAddLimit,
          plan: data.usage.plan,
        } : null);
      }
      
      // Store results and session ID
      setSearchResults(data.results);
      setSessionId(data.sessionId);
      
      // Transition to Step 2
      setStep('results');
      
    } catch (error) {
      console.error('Error searching for courses:', error);
      // Task 22.1: User-friendly error message with fallback suggestion
      // Task 22.2: Log error
      logSearchError({
        message: error instanceof Error ? error.message : 'Unknown search error',
        universityId,
        query: formData.courseSubject,
        error: error instanceof Error ? error : undefined,
      });
      setSearchError(
        error instanceof Error 
          ? error.message 
          : 'Search temporarily unavailable. Try again or use manual paste.'
      );
    } finally {
      setIsSearching(false);
    }
  };
  
  // Handle "Search again" button - show quota warning first
  const handleSearchAgain = () => {
    if (!showQuotaWarning) {
      setShowQuotaWarning(true);
    } else {
      // User confirmed - reset to step 1
      setShowQuotaWarning(false);
      setStep('confirm');
      setSearchError(null);
    }
  };
  
  // Cancel quota warning
  const handleCancelSearchAgain = () => {
    setShowQuotaWarning(false);
  };
  
  // Toggle result selection
  const toggleResultSelection = (resultId: string) => {
    setSelectedResultIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resultId)) {
        newSet.delete(resultId);
      } else {
        newSet.add(resultId);
      }
      return newSet;
    });
  };
  
  // Calculate remaining course slots based on entitlement
  const getRemainingSlots = (): number => {
    if (!entitlement) return 0;
    return entitlement.courseAddLimit - entitlement.coursesAdded;
  };
  
  // Check if selection exceeds limit
  const isSelectionOverLimit = (): boolean => {
    const selectedCount = selectedResultIds.size;
    const remainingSlots = getRemainingSlots();
    return selectedCount > remainingSlots;
  };
  
  // Get limit validation message
  const getLimitValidationMessage = (): string | null => {
    if (!entitlement) return null;
    
    const selectedCount = selectedResultIds.size;
    const remainingSlots = getRemainingSlots();
    
    if (selectedCount === 0) return null;
    if (selectedCount > remainingSlots) {
      return `You've selected ${selectedCount} courses, but you can only add ${remainingSlots} more. Upgrade or deselect some courses.`;
    }
    
    return null;
  };
  
  // Handle adding courses to Apply shortlist
  const handleAddCourses = async () => {
    if (selectedResultIds.size === 0) return;
    if (isSelectionOverLimit()) return;
    if (!sessionId) return;
    
    setIsAddingCourses(true);
    setAddCoursesError(null);
    
    try {
      // Task 17.2 - Check authentication status before proceeding
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // User is logged out - store selection in sessionStorage and redirect to login
        const selectedUrls = Array.from(selectedResultIds);
        const selectedResults = searchResults.filter((_, idx) => 
          selectedUrls.includes(`${searchResults[idx].courseUrl}-${idx}`)
        );
        
        const pendingCourseAddition = {
          universityId,
          universityName,
          sessionId,
          selectedResultIds: selectedResults.map(result => result.id),
          courseUrls: selectedResults.map(result => result.courseUrl),
          timestamp: new Date().toISOString(),
        };
        
        // Store in sessionStorage
        sessionStorage.setItem('pendingCourseAddition', JSON.stringify(pendingCourseAddition));
        
        // Redirect to login with return URL
        const returnUrl = `/apply?action=add-courses`;
        router.push(`/auth/login?returnTo=${encodeURIComponent(returnUrl)}`);
        return;
      }
      
      // User is authenticated - proceed with adding courses
      // Convert Set to Array and extract UUIDs from the result IDs
      // Result IDs are in format "{courseUrl}-{index}", we need the actual result UUIDs from the search results
      const selectedUrls = Array.from(selectedResultIds);
      const selectedResults = searchResults.filter((_, idx) => 
        selectedUrls.includes(`${searchResults[idx].courseUrl}-${idx}`)
      );
      
      // Get the actual result IDs (UUIDs) from the results
      const resultIds = selectedResults.map(result => result.id);
      
      // Call POST /api/apply-shortlist/add-courses
      const response = await fetch('/api/apply-shortlist/add-courses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          selectedResultIds: resultIds,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        // Handle specific error codes
        if (response.status === 401) {
          // Session expired - redirect to auth
          const errorMsg = errorData.error || 'User not authenticated';
          console.error('Add courses error (401):', errorMsg);
          
          // Log to analytics
          track('course_add_error', { 
            error_type: '401_unauthorized',
            session_id: sessionId,
            selected_count: selectedResultIds.size,
            university_id: universityId,
            error_message: errorMsg,
          });
          
          const redirectUrl = `/apply?universityId=${universityId}&openCourseSearch=true`;
          router.push(`/auth?redirect=${encodeURIComponent(redirectUrl)}`);
          return;
        }
        
        if (response.status === 403) {
          // Quota exceeded - show upgrade modal
          const errorMsg = errorData.error || 'You have reached your course limit.';
          console.error('Add courses error (403):', errorMsg);
          
          // Log to analytics
          track('course_add_error', { 
            error_type: '403_limit_exceeded',
            session_id: sessionId,
            selected_count: selectedResultIds.size,
            plan: entitlement?.plan || 'unknown',
            courses_added: entitlement?.coursesAdded || 0,
            course_limit: entitlement?.courseAddLimit || 0,
            university_id: universityId,
            error_message: errorMsg,
          });
          
          setShowUpgradeModal(true);
          setIsAddingCourses(false);
          return;
        }
        
        if (response.status === 500) {
          // Server error - show retry option
          const errorMsg = errorData.error || 'A server error occurred. Please try again.';
          console.error('Add courses error (500):', errorMsg, errorData);
          
          // Log to analytics
          track('course_add_error', { 
            error_type: '500_server_error',
            session_id: sessionId,
            selected_count: selectedResultIds.size,
            error_message: errorMsg,
            response_status: response.status,
            university_id: universityId,
          });
          
          setAddCoursesError(errorMsg);
          setIsAddingCourses(false);
          return;
        }
        
        // Generic error for any other status codes
        const genericErrorMsg = errorData.error || `An error occurred (${response.status}). Please try again.`;
        console.error(`Add courses error (${response.status}):`, genericErrorMsg, errorData);
        
        // Log to analytics
        track('course_add_error', {
          error_type: `${response.status}_error`,
          session_id: sessionId,
          selected_count: selectedResultIds.size,
          error_message: genericErrorMsg,
          response_status: response.status,
          university_id: universityId,
        });
        
        throw new Error(genericErrorMsg);
      }
      
      // Success - parse response
      const data = await response.json();
      
      // Track success
      track('courses_added_success', {
        session_id: sessionId,
        selected_count: selectedResultIds.size,
        created_count: data.applicationsCreated?.length || 0,
        skipped_count: data.skippedDuplicates?.length || 0,
        failed_count: data.failedValidation?.length || 0,
      });
      
      // Store the response data for Step 3
      setAddCoursesResponse(data);
      
      // Update entitlement with new usage data
      if (data.usage) {
        setEntitlement(prev => prev ? {
          ...prev,
          coursesAdded: data.usage.coursesAdded,
          courseAddLimit: data.usage.courseAddLimit,
          plan: data.usage.plan,
        } : null);
      }
      
      // Transition to Step 3 (added confirmation)
      setStep('added');
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'An unexpected error occurred. Please try again.';
      console.error('Add courses error (unexpected):', error);
      
      // Log to analytics
      track('course_add_error', { 
        error_type: 'unexpected_error',
        session_id: sessionId,
        selected_count: selectedResultIds.size,
        error_message: errorMsg,
        university_id: universityId,
        error_details: error instanceof Error ? error.stack : String(error),
      });
      
      setAddCoursesError(errorMsg);
    } finally {
      setIsAddingCourses(false);
    }
  };

  // Format usage display
  const formatUsageDisplay = (): string => {
    if (!entitlement) return 'Loading...';
    
    const remaining = entitlement.courseSearchLimit - entitlement.courseSearchesUsed;
    
    if (entitlement.courseSearchLimit >= 999999) {
      return 'Unlimited searches';
    }
    
    return `${entitlement.courseSearchesUsed} of ${entitlement.courseSearchLimit} free university course searches used`;
  };

  // Check if button should be disabled
  const isButtonDisabled = (): boolean => {
    if (!formData.courseSubject.trim()) return true;
    if (entitlement && !entitlement.canCreateSession) return true;
    return false;
  };

  if (!isOpen) return null;

  return (
    <>
      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            key="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 backdrop-blur-sm sm:items-center sm:p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-search-modal-title"
          >
          <motion.div
            key="modal-content"
            initial={{ 
              y: '100%',
              scale: 1,
            }}
            animate={{ 
              y: 0,
              scale: 1,
            }}
            exit={{ 
              y: '100%',
              scale: 1,
            }}
            transition={{ 
              duration: 0.3,
              ease: [0.22, 1, 0.36, 1],
            }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-[100dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:h-auto sm:max-h-[90vh] sm:max-w-[800px] sm:rounded-[2rem] sm:border sm:border-slate-200 will-change-transform"
            style={{
              // Task 24.1: Ensure smooth 60fps animation with GPU acceleration
              transform: 'translateZ(0)',
            }}
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
              <div className="flex-1">
                <h2 
                  id="course-search-modal-title" 
                  className="text-lg font-semibold tracking-tight text-slate-900 sm:text-xl"
                >
                  Find a course at {universityName}
                </h2>
                <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">
                  Search and select a course to start your application
                </p>
              </div>
              
              {/* Close button */}
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close modal"
              >
                <svg 
                  width="20" 
                  height="20" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2" 
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Modal body - scrollable content area */}
            <div 
              className="flex-1 overflow-y-auto px-5 py-6 sm:px-6 overscroll-contain"
              style={{
                // Task 24.1: Prevent iOS Safari from shifting modal offscreen when keyboard opens
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <AnimatePresence mode="wait">
                {step === 'confirm' && (
                  <motion.div
                    key="step-confirm"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.25 }}
                  >
                    {isLoadingData ? (
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="mb-4 h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-pink-500" />
                        <p className="text-sm text-slate-500">Loading your details...</p>
                      </div>
                    ) : (
                      <div className="space-y-6">
                        {/* Profile Summary */}
                        {profile && (
                          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                            <h3 className="mb-3 text-sm font-semibold text-slate-700">Your Profile</h3>
                            <div className="space-y-2 text-xs text-slate-600">
                              {profile.nationality && (
                                <div className="flex items-start gap-2">
                                  <span className="font-medium text-slate-500">Country:</span>
                                  <span>{profile.nationality}</span>
                                </div>
                              )}
                              {profile.budget_range && (
                                <div className="flex items-start gap-2">
                                  <span className="font-medium text-slate-500">Budget:</span>
                                  <span>{profile.budget_range}</span>
                                </div>
                              )}
                              {profile.grades_summary && (
                                <div className="flex items-start gap-2">
                                  <span className="font-medium text-slate-500">Academic Level:</span>
                                  <span>Profile completed</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Course Subject Input */}
                        <div>
                          <label htmlFor="course-subject" className="mb-2 block text-sm font-semibold text-slate-700">
                            What course or subject are you interested in?
                            <span className="ml-1 text-pink-500">*</span>
                          </label>
                          <input
                            id="course-subject"
                            type="text"
                            required
                            className="block w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 placeholder-slate-400 transition focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
                            placeholder="e.g., Computer Science, Business Analytics, Engineering"
                            value={formData.courseSubject}
                            onChange={(e) => setFormData(prev => ({ ...prev, courseSubject: e.target.value }))}
                          />
                          {validationError && (
                            <p className="mt-1.5 text-xs text-red-500">{validationError}</p>
                          )}
                        </div>

                        {/* Study Level Dropdown */}
                        <div>
                          <label htmlFor="study-level" className="mb-2 block text-sm font-semibold text-slate-700">
                            Study level
                          </label>
                          <select
                            id="study-level"
                            className="block w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 transition focus:border-pink-400 focus:outline-none focus:ring-2 focus:ring-pink-100"
                            value={formData.studyLevel}
                            onChange={(e) => setFormData(prev => ({ ...prev, studyLevel: e.target.value }))}
                          >
                            <option value="">Select level...</option>
                            {STUDY_LEVELS.map((level) => (
                              <option key={level} value={level}>
                                {level}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* Usage Display */}
                        {entitlement && (
                          <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
                            <div className="flex items-center gap-2">
                              <svg 
                                width="16" 
                                height="16" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                className="text-blue-500"
                              >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="16" x2="12" y2="12" />
                                <line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                              <p className="text-xs font-medium text-blue-700">
                                {formatUsageDisplay()}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Upgrade Prompt (if at limit) */}
                        {entitlement && !entitlement.canCreateSession && entitlement.upgradeRequired && (
                          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                            <div className="flex items-start gap-3">
                              <svg 
                                width="20" 
                                height="20" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                className="mt-0.5 shrink-0 text-amber-600"
                              >
                                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                                <line x1="12" y1="9" x2="12" y2="13" />
                                <line x1="12" y1="17" x2="12.01" y2="17" />
                              </svg>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-amber-900">Upgrade Required</p>
                                <p className="mt-1 text-xs text-amber-700">
                                  {entitlement.limitReason}
                                </p>
                                <a
                                  href="/plus"
                                  className="mt-2 inline-block rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-amber-700"
                                >
                                  Upgrade to GlowBal Plus
                                </a>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* CTA Button */}
                        <button
                          type="button"
                          onClick={handleFindCourses}
                          disabled={isButtonDisabled() || isSearching}
                          className="w-full rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-3.5 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-90"
                        >
                          {isSearching ? (
                            <span className="flex items-center justify-center gap-2">
                              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                              </svg>
                              Searching for courses...
                            </span>
                          ) : (
                            'Find course options'
                          )}
                        </button>
                        
                        {/* Task 22.3: Error Display with recovery options */}
                        {searchError && (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                            <div className="flex items-start gap-3">
                              <svg 
                                width="20" 
                                height="20" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                className="mt-0.5 shrink-0 text-red-600"
                              >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-red-900">Search Error</p>
                                <p className="mt-1 text-xs text-red-700">{searchError}</p>
                                <div className="mt-2 flex flex-wrap items-center gap-3">
                                  {/* Task 22.3: Try again button */}
                                  <button
                                    type="button"
                                    onClick={handleFindCourses}
                                    className="text-xs font-semibold text-red-600 hover:text-red-700"
                                  >
                                    Try again
                                  </button>
                                  {/* Task 22.3: Manual paste fallback */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onClose();
                                      // Scroll to manual paste section
                                      window.scrollTo({ top: 0, behavior: 'smooth' });
                                    }}
                                    className="text-xs font-semibold text-slate-600 hover:text-slate-700"
                                  >
                                    Use manual paste
                                  </button>
                                  {/* Task 22.3: Contact support link */}
                                  <a
                                    href="mailto:support@glowbal.com?subject=Course Search Issue"
                                    className="text-xs font-semibold text-slate-600 hover:text-slate-700"
                                  >
                                    Contact support
                                  </a>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}

                {step === 'results' && (
                  <motion.div
                    key="step-results"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.25 }}
                  >
                    {showQuotaWarning ? (
                      /* Quota Warning Dialog */
                      <div className="flex flex-col items-center justify-center py-8">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600">
                          <svg 
                            width="32" 
                            height="32" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="white" 
                            strokeWidth="2" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          >
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900">Start a new search?</h3>
                        <p className="mt-2 max-w-md text-center text-sm text-slate-600">
                          This will use <strong>1 of your {entitlement?.courseSearchLimit || 3} free university course searches</strong>.
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          Each new search creates a new session and counts toward your quota.
                        </p>
                        
                        {entitlement && (
                          <div className="mt-4 rounded-lg border border-blue-100 bg-blue-50/50 px-4 py-2">
                            <p className="text-xs text-blue-700">
                              {formatUsageDisplay()}
                            </p>
                          </div>
                        )}
                        
                        <div className="mt-6 flex gap-3">
                          <button
                            type="button"
                            onClick={handleCancelSearchAgain}
                            className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSearchAgain}
                            className="rounded-lg bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                          >
                            Continue with new search
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Results Display with CourseResultCard list */
                      <div className="space-y-6">
                        {/* Session Query Summary */}
                        <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
                          <p className="text-sm text-blue-900">
                            <strong>Showing {searchResults.length} course options</strong> for{' '}
                            <strong>{formData.courseSubject}</strong> at{' '}
                            <strong>{universityName}</strong>
                            {formData.studyLevel && ` (${formData.studyLevel})`}
                          </p>
                        </div>

                        {/* Course Result Cards */}
                        <div className="space-y-3">
                          {searchResults.map((result, index) => (
                            <CourseResultCard
                              key={`${result.courseUrl}-${index}`}
                              result={result}
                              selectable={true}
                              selected={selectedResultIds.has(`${result.courseUrl}-${index}`)}
                              onSelect={() => toggleResultSelection(`${result.courseUrl}-${index}`)}
                            />
                          ))}
                        </div>

                        {/* Selection Summary and Limit Validation */}
                        <div className="space-y-3">
                          {/* Selected Count */}
                          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3">
                            <div className="flex items-center gap-2">
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                className="text-slate-600"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              <span className="text-sm font-semibold text-slate-900">
                                {selectedResultIds.size} {selectedResultIds.size === 1 ? 'course' : 'courses'} selected
                              </span>
                            </div>
                            {entitlement && (
                              <span className="text-xs text-slate-600">
                                {entitlement.courseAddLimit >= 999999
                                  ? 'Unlimited courses available'
                                  : `You can add ${getRemainingSlots()} more ${
                                      getRemainingSlots() === 1 ? 'course' : 'courses'
                                    } on your ${entitlement.plan} plan`}
                              </span>
                            )}
                          </div>

                          {/* Limit Validation Warning */}
                          {getLimitValidationMessage() && (
                            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                              <div className="flex items-start gap-3">
                                <svg
                                  width="20"
                                  height="20"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="mt-0.5 shrink-0 text-red-600"
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" y1="8" x2="12" y2="12" />
                                  <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-red-900">Too many courses selected</p>
                                  <p className="mt-1 text-xs text-red-700">{getLimitValidationMessage()}</p>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Action Buttons */}
                        <div className="flex flex-col gap-3 sm:flex-row">
                          <button
                            type="button"
                            onClick={handleSearchAgain}
                            className="flex-1 rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                          >
                            Search again
                          </button>
                          <button
                            type="button"
                            onClick={handleAddCourses}
                            disabled={selectedResultIds.size === 0 || isSelectionOverLimit() || isAddingCourses}
                            className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-50 hover:opacity-90"
                          >
                            {isAddingCourses ? (
                              <span className="flex items-center justify-center gap-2">
                                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Adding courses to your shortlist...
                              </span>
                            ) : (
                              `Add ${selectedResultIds.size > 0 ? selectedResultIds.size : ''} ${selectedResultIds.size === 1 ? 'course' : 'courses'} to Apply`
                            )}
                          </button>
                        </div>
                        
                        {/* Add Courses Error Display */}
                        {addCoursesError && (
                          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                            <div className="flex items-start gap-3">
                              <svg 
                                width="20" 
                                height="20" 
                                viewBox="0 0 24 24" 
                                fill="none" 
                                stroke="currentColor" 
                                strokeWidth="2" 
                                strokeLinecap="round" 
                                strokeLinejoin="round"
                                className="mt-0.5 shrink-0 text-red-600"
                              >
                                <circle cx="12" cy="12" r="10" />
                                <line x1="12" y1="8" x2="12" y2="12" />
                                <line x1="12" y1="16" x2="12.01" y2="16" />
                              </svg>
                              <div className="flex-1">
                                <p className="text-sm font-semibold text-red-900">Failed to Add Courses</p>
                                <p className="mt-1 text-xs text-red-700">{addCoursesError}</p>
                                <button
                                  type="button"
                                  onClick={handleAddCourses}
                                  disabled={isAddingCourses}
                                  className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700 disabled:opacity-50"
                                >
                                  Try again
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* View Official Course Directory Fallback Link */}
                        <div className="pt-2 text-center">
                          <a
                            href={
                              universityDomain
                                ? `https://${universityDomain}`
                                : `https://www.google.com/search?q=${encodeURIComponent(
                                    `${universityName} ${formData.courseSubject} courses`.trim()
                                  )}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-slate-500 transition-colors hover:text-slate-700"
                          >
                            View official course directory
                            <svg
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {step === 'added' && (
                  <motion.div
                    key="step-added"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="space-y-6">
                      {/* Success Icon and Message */}
                      <div className="flex flex-col items-center text-center">
                        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg">
                          <svg 
                            width="32" 
                            height="32" 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="white" 
                            strokeWidth="2.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        </div>
                        <h3 className="text-xl font-semibold text-slate-900">
                          {addCoursesResponse?.applicationsCreated.length || 0} {addCoursesResponse?.applicationsCreated.length === 1 ? 'course' : 'courses'} added to your Apply shortlist
                        </h3>
                        <p className="mt-2 text-sm text-slate-600">
                          GlowBal is building your application checklists in the background
                        </p>
                      </div>

                      {/* Added Courses List */}
                      {addCoursesResponse && addCoursesResponse.applicationsCreated.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-slate-700">Successfully added:</h4>
                          <div className="space-y-2">
                            {addCoursesResponse.applicationsCreated.map((app) => (
                              <div
                                key={app.id}
                                className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50/50 px-4 py-3"
                              >
                                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500">
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="white"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                  >
                                    <polyline points="20 6 9 17 4 12" />
                                  </svg>
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-slate-900">{app.courseName}</p>
                                  <a 
                                    href={app.courseUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="mt-0.5 inline-flex items-center gap-1 text-xs text-slate-600 hover:text-slate-800"
                                  >
                                    View course page
                                    <svg
                                      width="10"
                                      height="10"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                      <polyline points="15 3 21 3 21 9" />
                                      <line x1="10" y1="14" x2="21" y2="3" />
                                    </svg>
                                  </a>
                                </div>
                                <div className="shrink-0">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                                    <svg
                                      width="12"
                                      height="12"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                    >
                                      <circle cx="12" cy="12" r="10" />
                                      <polyline points="12 6 12 12 16 14" />
                                    </svg>
                                    {app.parseStatus === 'processing' ? 'Processing' : app.parseStatus}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Skipped Duplicates */}
                      {addCoursesResponse && addCoursesResponse.skippedDuplicates.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-slate-700">Already in your shortlist:</h4>
                          <div className="space-y-2">
                            {addCoursesResponse.skippedDuplicates.map((course, idx) => (
                              <div
                                key={`${course.courseUrl}-${idx}`}
                                className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/50 px-4 py-3"
                              >
                                <svg
                                  width="20"
                                  height="20"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="shrink-0 text-amber-600"
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="12" y1="8" x2="12" y2="12" />
                                  <line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-slate-900">{course.courseName}</p>
                                  <p className="mt-0.5 text-xs text-slate-600">This course was already added to your Apply shortlist</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Failed Validations */}
                      {addCoursesResponse && addCoursesResponse.failedValidation.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-slate-700">Could not add:</h4>
                          <div className="space-y-2">
                            {addCoursesResponse.failedValidation.map((course, idx) => (
                              <div
                                key={`${course.courseUrl}-${idx}`}
                                className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50/50 px-4 py-3"
                              >
                                <svg
                                  width="20"
                                  height="20"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  className="shrink-0 text-red-600"
                                >
                                  <circle cx="12" cy="12" r="10" />
                                  <line x1="15" y1="9" x2="9" y2="15" />
                                  <line x1="9" y1="9" x2="15" y2="15" />
                                </svg>
                                <div className="flex-1">
                                  <p className="text-sm font-semibold text-slate-900">{course.courseName}</p>
                                  <p className="mt-0.5 text-xs text-red-700">{course.reason}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Updated Usage Display */}
                      {addCoursesResponse && addCoursesResponse.usage && (
                        <div className="rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <svg 
                              width="16" 
                              height="16" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              stroke="currentColor" 
                              strokeWidth="2" 
                              strokeLinecap="round" 
                              strokeLinejoin="round"
                              className="text-blue-500"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <line x1="12" y1="16" x2="12" y2="12" />
                              <line x1="12" y1="8" x2="12.01" y2="8" />
                            </svg>
                            <p className="text-xs font-medium text-blue-700">
                              {addCoursesResponse.usage.courseAddLimit >= 999999
                                ? `${addCoursesResponse.usage.coursesAdded} courses in your shortlist`
                                : `${addCoursesResponse.usage.coursesAdded} of ${addCoursesResponse.usage.courseAddLimit} free shortlist courses used on your ${addCoursesResponse.usage.plan} plan`}
                            </p>
                          </div>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-3 pt-2 sm:flex-row">
                        <button
                          type="button"
                          onClick={() => {
                            // Navigate to /apply
                            router.push('/apply');
                            onClose();
                          }}
                          className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                        >
                          View Apply shortlist
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            // Return to Step 1 for a new search
                            setStep('confirm');
                            setSelectedResultIds(new Set()); // Clear selection
                            setSearchError(null);
                            setAddCoursesResponse(null); // Clear response data
                          }}
                          className="flex-1 rounded-xl border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                        >
                          Continue searching
                        </button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer - Step indicator (optional for future enhancement) */}
            <div className="border-t border-slate-100 px-5 py-3 sm:px-6">
              <div className="flex items-center justify-center gap-2">
                <div 
                  className={`h-2 w-2 rounded-full transition-colors ${
                    step === 'confirm' ? 'bg-pink-500' : 'bg-slate-300'
                  }`}
                  aria-label="Step 1: Confirm"
                />
                <div 
                  className={`h-2 w-2 rounded-full transition-colors ${
                    step === 'results' ? 'bg-pink-500' : 'bg-slate-300'
                  }`}
                  aria-label="Step 2: Results"
                />
                <div 
                  className={`h-2 w-2 rounded-full transition-colors ${
                    step === 'added' ? 'bg-pink-500' : 'bg-slate-300'
                  }`}
                  aria-label="Step 3: Added"
                />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    
    {/* Task 20.2: Integrate upgrade prompts - Upgrade Modal for 403 errors */}
    <UpgradePromptModal
      isOpen={showUpgradeModal}
      onClose={() => setShowUpgradeModal(false)}
      limitType="courses"
      currentUsage={entitlement?.coursesAdded || 0}
      currentLimit={entitlement?.courseAddLimit || 5}
    />
  </>
  );
}
