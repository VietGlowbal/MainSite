'use client';

import { useEffect, useRef, useState } from 'react';
import { COACH_SEED_INTENTS } from '../domain';
import { Button, Textarea } from '@/shared/ui';

type Row = { id?: string; role: 'user' | 'assistant'; content: string; createdAt?: string };

/**
 * AI Coach — requirements.md Requirement 12. Non-streaming (design.md, Open
 * decision 3): one request per turn, the composer disabled while waiting.
 *
 * Any AI reply here is plain conversational text, not something that writes
 * back into the student's own documents — Requirement 12.4's Suggestion_State
 * rule is a forward-compatibility note for once Feature 2's `SuggestionCard`
 * exists, not something this read-only chat needs yet (see design.md).
 */
export function AiCoachPanel({
  applicationId,
  recommendationId,
}: {
  applicationId: string;
  recommendationId: string;
}) {
  const [messages, setMessages] = useState<Row[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  const endpoint = `/api/applications/${applicationId}/strategy/recommendations/${recommendationId}/coach`;

  useEffect(() => {
    let cancelled = false;
    fetch(endpoint)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        const rows = ((data.messages ?? []) as Array<Record<string, unknown>>).map((m) => ({
          id: m.id as string,
          role: m.role as 'user' | 'assistant',
          content: m.content as string,
        }));
        setMessages(rows);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || sending) return;

    setMessages((prev) => [...prev, { role: 'user', content: message }]);
    setDraft('');
    setSending(true);
    setError(null);

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Coach could not reply.');
        return;
      }
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message.content }]);
    } catch {
      setError('Coach could not reply. Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex flex-col gap-gb-lg">
      {loaded && messages.length === 0 ? (
        <div className="flex flex-wrap gap-gb-md">
          {COACH_SEED_INTENTS.map((intent) => (
            <Button key={intent} variant="secondary" size="sm" onClick={() => send(intent)}>
              {intent}
            </Button>
          ))}
        </div>
      ) : null}

      {messages.length > 0 ? (
        <div ref={listRef} className="flex max-h-[360px] flex-col gap-gb-md overflow-y-auto">
          {messages.map((m, i) => (
            <div
              key={m.id ?? i}
              className={
                m.role === 'user'
                  ? 'ml-auto max-w-[85%] rounded-gb-lg bg-brand-subtle px-gb-lg py-gb-md text-gb-sm text-fg-brand'
                  : 'mr-auto max-w-[85%] rounded-gb-lg bg-surface-muted px-gb-lg py-gb-md text-gb-sm text-fg'
              }
            >
              {m.content}
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-gb-sm text-fg-error">{error}</p> : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="flex flex-col gap-gb-md"
      >
        <Textarea
          name="coach-message"
          label="Ask your AI Coach"
          placeholder="How do I improve this?"
          rows={2}
          value={draft}
          disabled={sending}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={sending || draft.trim().length === 0}>
          {sending ? 'Sending…' : 'Send'}
        </Button>
      </form>
    </div>
  );
}
