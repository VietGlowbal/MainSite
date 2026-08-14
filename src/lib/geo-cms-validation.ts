/** Client-safe publish checklist shared by admin UI and server routes. */
export type PublishValidationInput = {
  title?: string | null;
  description?: string | null;
  body?: string | null;
  topic?: string | null;
  hero_image?: string | null;
  meta?: Record<string, unknown> | null;
};

export function validateArticleForPublish(input: PublishValidationInput): string[] {
  const errors: string[] = [];
  if (!input.title?.trim()) errors.push('Title is required');
  if (!input.description?.trim()) errors.push('Description is required');
  if (!input.body?.trim()) errors.push('Body is required');
  if (!input.topic?.trim() || input.topic.trim() === 'All topics') errors.push('Topic is required');
  if (!input.hero_image?.trim()) errors.push('Hero image is required');
  const alt = input.meta && typeof input.meta.heroImageAlt === 'string' ? input.meta.heroImageAlt : '';
  if (!alt.trim()) errors.push('Hero image alt text is required');
  if (/!\[\s*\]\(/.test(input.body ?? '') || /<img\b[^>]*\balt\s*=\s*["']\s*["']/i.test(input.body ?? '')) {
    errors.push('Every inline image needs alt text');
  }
  return errors;
}
