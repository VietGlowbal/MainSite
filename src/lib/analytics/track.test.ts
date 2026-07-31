import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  sanitiseMetadata,
  trackApplicationEvent,
  type StrategyEventType,
} from './track';

const APP = '22222222-2222-4222-8222-222222222222';
const USER = '11111111-1111-4111-8111-111111111111';

function clientDouble(result: { error: { message: string } | null } = { error: null }) {
  const insert = vi.fn().mockResolvedValue(result);
  return {
    client: { from: () => ({ insert }) } as unknown as SupabaseClient,
    insert,
  };
}

describe('sanitiseMetadata', () => {
  it('keeps counts and labels', () => {
    expect(sanitiseMetadata({ sectionCount: 5, layout: 'technical', outdated: false })).toEqual({
      sectionCount: 5,
      layout: 'technical',
      outdated: false,
    });
  });

  it('drops keys that name document content', () => {
    // Defence in depth: the type already blocks objects, this catches the case
    // where someone stringifies first.
    expect(
      sanitiseMetadata({
        cvText: 'Led a team of four engineers...',
        quote: 'I have always been fascinated by',
        sectionCount: 3,
      }),
    ).toEqual({ sectionCount: 3 });
  });

  it('drops long strings even under an innocent key', () => {
    const long = 'x'.repeat(121);
    expect(sanitiseMetadata({ note: long, ok: 'short' })).toEqual({ ok: 'short' });
  });

  it('keeps a string right at the limit', () => {
    const atLimit = 'x'.repeat(120);
    expect(sanitiseMetadata({ note: atLimit })).toEqual({ note: atLimit });
  });

  it('returns an empty object for no metadata', () => {
    expect(sanitiseMetadata(undefined)).toEqual({});
  });

  it('preserves an explicit null', () => {
    expect(sanitiseMetadata({ layout: null })).toEqual({ layout: null });
  });
});

describe('trackApplicationEvent', () => {
  it('writes the event with the sanitised payload', async () => {
    const { client, insert } = clientDouble();

    await trackApplicationEvent({
      supabase: client,
      applicationId: APP,
      userId: USER,
      eventType: 'cv_review_completed',
      eventLabel: 'Technical',
      metadata: { missingSignalCount: 2, cvText: 'should not survive' },
    });

    expect(insert).toHaveBeenCalledWith({
      application_id: APP,
      user_id: USER,
      event_type: 'cv_review_completed',
      event_label: 'Technical',
      metadata: { missingSignalCount: 2 },
    });
  });

  it('sends a null label rather than omitting the column', async () => {
    const { client, insert } = clientDouble();

    await trackApplicationEvent({
      supabase: client,
      applicationId: APP,
      userId: USER,
      eventType: 'strategy_opened',
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ event_label: null, metadata: {} }),
    );
  });

  it('swallows an insert error so the caller\u2019s work still succeeds', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { client } = clientDouble({ error: { message: 'relation does not exist' } });

    await expect(
      trackApplicationEvent({
        supabase: client,
        applicationId: APP,
        userId: USER,
        eventType: 'cv_export_completed',
      }),
    ).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('swallows a thrown client error too', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const client = {
      from: () => ({
        insert: () => {
          throw new Error('network down');
        },
      }),
    } as unknown as SupabaseClient;

    await expect(
      trackApplicationEvent({
        supabase: client,
        applicationId: APP,
        userId: USER,
        eventType: 'cv_export_failed',
      }),
    ).resolves.toBeUndefined();

    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe('the event name union', () => {
  it('covers all twenty specified events', () => {
    // Listed literally so a rename shows up here rather than as a silently
    // orphaned series in the events table.
    const all: StrategyEventType[] = [
      'strategy_opened',
      'cv_target_profile_generated',
      'cv_target_profile_edited',
      'cv_import_started',
      'cv_import_completed',
      'cv_import_failed',
      'cv_review_started',
      'cv_review_completed',
      'cv_review_failed',
      'cv_layout_selected',
      'cv_export_started',
      'cv_export_completed',
      'cv_export_failed',
      'statement_brief_generated',
      'statement_analysis_started',
      'statement_analysis_completed',
      'statement_analysis_failed',
      'statement_feedback_accepted',
      'statement_feedback_dismissed',
      'strategy_ready_for_audit',
    ];
    expect(new Set(all).size).toBe(20);
  });
});
