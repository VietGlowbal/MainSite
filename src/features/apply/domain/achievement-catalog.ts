import type { AchievementCategory, ActivityCategory } from './reflection';

/**
 * Presentation metadata for achievement/activity cards — the icon each
 * category renders with, and the level options offered as quick picks.
 *
 * ─── ONE ICON TINT, NOT A CATEGORY RAINBOW ───────────────────────────────────
 *
 * A palette of five or six soft category colours has no home in this design
 * system: `tokens.css` defines exactly three soft fills (brand, info, the
 * safe tier), and CLAUDE.md is explicit that components must not invent
 * variants the kit does not have. Every sibling control in this redesign —
 * `SelectionCard`, `OptionCards`, the question-chrome icons — already answers
 * "how do we tell options apart" with icon shape on one consistent
 * `bg-brand-subtle` tint, not colour. Category icons follow the same rule
 * rather than reopening it.
 */
export const ACHIEVEMENT_CATEGORY_ICON: Record<AchievementCategory, string> = {
  academic_award: 'zapFast',
  competition: 'chartBreakoutSquare',
  research: 'graduationCap',
  certification: 'checkCircle',
  other: 'edit02',
};

export const ACTIVITY_CATEGORY_ICON: Record<ActivityCategory, string> = {
  community_project: 'heart',
  leadership: 'usersTwo',
  innovation: 'zap',
  personal_growth: 'art',
  mentoring: 'messageChatCircle',
  other: 'edit02',
};

/**
 * Suggested levels, offered as quick-pick chips above the free-text `level`
 * field rather than a closed set.
 *
 * `level` stays free text in the schema on purpose — see the column comment
 * in `supabase-reflection.sql`: an award level does not generalise across
 * countries, and a CHECK constraint here would reject a legitimate
 * Vietnamese classification the suggestions below do not happen to list.
 * These are a shortcut, not a boundary.
 */
export const LEVEL_SUGGESTIONS = [
  'School',
  'City / Local',
  'Regional',
  'National',
  'International',
  'University',
  'Community',
  'Organisation',
] as const;
