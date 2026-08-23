import type { ComponentType } from 'react';
import type { ContentBlock, ContentBlockType, ContentBlockValue } from '@/lib/match-insights';
import { ChecklistInput } from './checklist-input';
import { FallbackBlock } from './fallback-block';
import { LongTextInput } from './long-text-input';
import { SingleSelectInput } from './single-select-input';
import { StructuredTableInput } from './structured-table-input';

/**
 * Block-input registry (§6.4). `content-block.tsx` used to be one component
 * with four if-chains; the inputs now live here, one file per block shape,
 * and the dispatcher resolves a block by its `type` through
 * `BLOCK_INPUT_REGISTRY` instead.
 *
 * `BlockInputProps` is defined ONCE, here, and each input narrows it to its
 * own variant: for a block of type `T`, `schema` is exactly that variant of
 * `ContentBlock`, `value` is the matching variant of `ContentBlockValue` (or
 * `null` before anything was saved), and `onSave` is the resolved save
 * callback — always present; the dispatcher has already applied the PATCH
 * fallback when the caller passed none.
 */
export type BlockInputProps<T extends ContentBlockType = ContentBlockType> = {
  schema: Extract<ContentBlock, { type: T }>;
  value: Extract<ContentBlockValue, { type: T }> | null;
  onSave: (contentValue: ContentBlockValue) => Promise<boolean>;
};

/**
 * The dispatcher-facing shape once membership in the registry has been
 * verified. Each concrete input is assignable to it only through the keyed
 * lookup below — the registry key is what guarantees a component receives
 * its own variant, so the variance-erasing assertion lives here and nowhere
 * else.
 */
export type AnyBlockInput = ComponentType<BlockInputProps>;

/**
 * Exhaustive over `ContentBlockType`: adding a variant to `ContentBlock`
 * without adding an entry here is a compile error (`Record` over the union),
 * which is the point — an unhandled shape must fail the build, not the page.
 */
export const BLOCK_INPUT_REGISTRY: Record<ContentBlockType, AnyBlockInput> = {
  structured_table: StructuredTableInput as AnyBlockInput,
  long_text: LongTextInput as AnyBlockInput,
  checklist: ChecklistInput as AnyBlockInput,
  single_select: SingleSelectInput as AnyBlockInput,
};

export { FallbackBlock };
