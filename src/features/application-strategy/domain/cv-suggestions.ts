/**
 * The five per-line AI actions the CV editor offers.
 *
 * In the domain rather than beside the model call, because both sides need it and
 * only one of them can safely import the other: the editor is a client component,
 * and reaching into `lib/ai/strategy` would pull the OpenAI SDK into the browser
 * bundle. The route validates against this same list, so the buttons and the
 * endpoint cannot drift apart.
 */
export const CV_SUGGESTION_ACTIONS = [
  { key: 'clearer', label: 'Make clearer' },
  { key: 'concise', label: 'Make concise' },
  { key: 'impact', label: 'Highlight impact' },
  { key: 'evidence', label: 'Add confirmed evidence' },
  { key: 'tailor', label: 'Tailor to this course' },
] as const;

export type CvSuggestionAction = (typeof CV_SUGGESTION_ACTIONS)[number]['key'];

export const CV_SUGGESTION_ACTION_KEYS = CV_SUGGESTION_ACTIONS.map((a) => a.key) as [
  CvSuggestionAction,
  ...CvSuggestionAction[],
];
