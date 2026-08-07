'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';

export type LimitType = 'search' | 'courses';

interface UpgradePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  limitType: LimitType;
  currentUsage: number;
  currentLimit: number;
}

/**
 * UpgradePromptModal — Subscription upgrade prompt
 * 
 * Task 20.1: Create UpgradePromptModal component
 * 
 * Displays when users hit usage limits:
 * - Search limit: 3 AI course searches per month (free tier)
 * - Course limit: 5 active applications (free tier)
 * 
 * Shows benefits of upgrading and provides clear CTA to upgrade.
 */
export function UpgradePromptModal({
  isOpen,
  onClose,
  limitType,
  currentUsage,
  currentLimit,
}: UpgradePromptModalProps) {
  const router = useRouter();

  const handleUpgrade = () => {
    // Navigate to pricing or subscription page
    // TODO: Update this URL when subscription page is ready
    router.push('/pricing');
    onClose();
  };

  const getTitle = () => {
    if (limitType === 'search') {
      return "You've used all your free course searches";
    }
    return "You've reached your course limit";
  };

  const getMessage = () => {
    if (limitType === 'search') {
      return `You've used all ${currentLimit} free university course searches this month. Upgrade to continue searching.`;
    }
    return `You've reached the limit of ${currentLimit} courses on your shortlist. Archive a course or upgrade for unlimited courses.`;
  };

  const benefits = [
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
      text: 'Unlimited AI-powered course searches',
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
      text: 'Unlimited course applications',
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
      text: 'Priority AI parsing and checklist generation',
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
      text: 'Advanced advisor matching',
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ),
      text: 'Premium scholarship alerts',
    },
  ];

  if (!isOpen) return null;

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="upgrade-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-labelledby="upgrade-modal-title"
        >
          <motion.div
            key="upgrade-modal-content"
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-[2rem] bg-white shadow-2xl"
          >
            {/* Header with gradient */}
            <div className="bg-gradient-to-br from-pink-500 to-purple-600 px-6 py-8 text-white">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
              </div>
              
              <h2 id="upgrade-modal-title" className="text-2xl font-bold tracking-tight">
                {getTitle()}
              </h2>
              <p className="mt-2 text-sm text-pink-50">
                {getMessage()}
              </p>
            </div>

            {/* Body */}
            <div className="px-6 py-6">
              <h3 className="mb-4 text-sm font-semibold text-slate-900">
                Unlock GlowBal Plus benefits:
              </h3>
              
              <ul className="space-y-3">
                {benefits.map((benefit, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-600">
                      {benefit.icon}
                    </div>
                    <span className="text-sm text-slate-700">{benefit.text}</span>
                  </li>
                ))}
              </ul>

              {/* Current usage indicator */}
              <div className="mt-6 rounded-xl bg-slate-50 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Current usage:</span>
                  <span className="font-semibold text-slate-900">
                    {currentUsage} / {currentLimit}
                    {limitType === 'search' ? ' searches' : ' courses'}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div 
                    className="h-full bg-gradient-to-r from-pink-500 to-purple-600 transition-all duration-500"
                    style={{ width: `${Math.min((currentUsage / currentLimit) * 100, 100)}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Footer with actions */}
            <div className="flex gap-3 border-t border-slate-100 px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Maybe later
              </button>
              <button
                type="button"
                onClick={handleUpgrade}
                className="flex-1 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:shadow-xl hover:scale-[1.02]"
              >
                Upgrade to Plus
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
