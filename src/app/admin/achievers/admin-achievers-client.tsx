'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { AchieverStatus } from '@/types/achievers';
import { useLoadingIndicator } from '@/shared/ui/loading-overlay';

type Application = {
  id: string;
  display_name: string;
  subject: string;
  degree_level: string;
  bio: string | null;
  help_topics: string[];
  languages: string[];
  session_price_vnd: number;
  session_duration_mins: number;
  status: AchieverStatus;
  created_at: string;
  quick_signup?: boolean | null;
  university: { id: number; name: string; country: string } | null;
};

function StatusBadge({ status }: { status: AchieverStatus }) {
  const styles: Record<AchieverStatus, string> = {
    pending: 'border-amber-200 bg-amber-50 text-amber-700',
    approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    suspended: 'border-red-200 bg-red-50 text-red-700',
    rejected: 'border-slate-200 bg-slate-50 text-slate-500',
  };

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status]}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

export function AdminAchieversClient({ applications }: { applications: Application[] }) {
  const [items, setItems] = useState(applications);
  const [updating, setUpdating] = useState<string | null>(null);
  useLoadingIndicator(updating !== null, 'Updating the application');
  const [expanded, setExpanded] = useState<string | null>(null);

  async function updateStatus(id: string, status: AchieverStatus) {
    setUpdating(id);
    const supabase = createClient();

    const updateData: Record<string, unknown> = { status };
    if (status === 'approved') {
      updateData.verified_at = new Date().toISOString();
    }

    await supabase
      .from('achiever_profiles')
      .update(updateData)
      .eq('id', id);

    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status } : item)),
    );
    setUpdating(null);
  }

  const pending = items.filter((a) => a.status === 'pending');
  const others = items.filter((a) => a.status !== 'pending');

  return (
    <div className="space-y-6">
      {/* Pending applications */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">
          Pending ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="text-sm text-slate-400">No pending applications.</p>
        ) : (
          pending.map((app) => (
            <article key={app.id} className="glow-card space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{app.display_name}</p>
                  <p className="text-sm text-slate-500">
                    {app.university?.name} · {app.subject} · {app.degree_level}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Applied {new Date(app.created_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <StatusBadge status={app.status} />
                  {app.quick_signup ? (
                    <span className="inline-flex rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-xs font-semibold text-violet-700">
                      Fast-track · no documents
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Expandable details */}
              <button
                type="button"
                onClick={() => setExpanded(expanded === app.id ? null : app.id)}
                className="text-xs text-sky-600 hover:underline"
              >
                {expanded === app.id ? 'Hide details' : 'View application'}
              </button>

              {expanded === app.id && (
                <div className="glow-muted-card space-y-2 text-sm">
                  {app.bio && <p><strong>Bio:</strong> {app.bio}</p>}
                  <p><strong>Topics:</strong> {app.help_topics.join(', ')}</p>
                  <p><strong>Languages:</strong> {app.languages.join(', ')}</p>
                  <p><strong>Price:</strong> {new Intl.NumberFormat('vi-VN').format(app.session_price_vnd)} ₫ / {app.session_duration_mins} min</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-2 border-t border-black/5">
                <button
                  type="button"
                  onClick={() => updateStatus(app.id, 'approved')}
                  disabled={updating === app.id}
                  className="glow-button-primary text-xs px-4 py-2"
                >
                  Approve
                </button>
                <button
                  type="button"
                  onClick={() => updateStatus(app.id, 'rejected')}
                  disabled={updating === app.id}
                  className="glow-button-secondary text-xs px-4 py-2"
                >
                  Reject
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {/* Previously processed */}
      {others.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-900">Processed</h2>
          {others.map((app) => (
            <article key={app.id} className="glow-card-tight flex items-center justify-between">
              <div>
                <p className="font-medium text-slate-900 text-sm">{app.display_name}</p>
                <p className="text-xs text-slate-400">{app.university?.name} · {app.subject}</p>
              </div>
              <StatusBadge status={app.status} />
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
