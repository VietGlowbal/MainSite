'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import type { AchieverWithUniversity, AchieverFilters as Filters } from '@/types/achievers';
import { AchieverCard } from './AchieverCard';
import { AchieverFilters } from './AchieverFilters';

type Props = {
  achievers: AchieverWithUniversity[];
  initialUniversityId?: number;
};

export function AchieverBrowseClient({ achievers, initialUniversityId }: Props) {
  const [filters, setFilters] = useState<Filters>({
    university_id: initialUniversityId,
  });

  const filtered = useMemo(() => {
    let results = [...achievers];

    if (filters.university_id) {
      results = results.filter((a) => a.university_id === filters.university_id);
    }
    if (filters.subject) {
      const q = filters.subject.toLowerCase();
      results = results.filter((a) => a.subject.toLowerCase().includes(q));
    }
    if (filters.min_price) {
      results = results.filter((a) => a.session_price_vnd >= filters.min_price!);
    }
    if (filters.max_price) {
      results = results.filter((a) => a.session_price_vnd <= filters.max_price!);
    }
    if (filters.languages && filters.languages.length > 0) {
      results = results.filter((a) =>
        filters.languages!.some((lang) => a.languages.includes(lang)),
      );
    }
    if (filters.currently_enrolled !== undefined) {
      results = results.filter((a) => a.currently_enrolled === filters.currently_enrolled);
    }

    // Sort
    switch (filters.sort) {
      case 'newest':
        results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'price_asc':
        results.sort((a, b) => a.session_price_vnd - b.session_price_vnd);
        break;
      case 'price_desc':
        results.sort((a, b) => b.session_price_vnd - a.session_price_vnd);
        break;
      default:
        results.sort((a, b) => {
          if (Number(b.avg_rating) !== Number(a.avg_rating))
            return Number(b.avg_rating) - Number(a.avg_rating);
          return b.total_sessions - a.total_sessions;
        });
    }

    return results;
  }, [achievers, filters]);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      {/* Sidebar filters */}
      <aside className="hidden lg:block">
        <AchieverFilters
          achievers={achievers}
          filters={filters}
          onFiltersChange={setFilters}
        />
      </aside>

      {/* Main content */}
      <div className="space-y-6">
        {/* Mobile filter toggle — simplified for MVP */}
        <div className="lg:hidden">
          <AchieverFilters
            achievers={achievers}
            filters={filters}
            onFiltersChange={setFilters}
          />
        </div>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {filtered.length} achiever{filtered.length !== 1 ? 's' : ''} found
          </p>
        </div>

        {/* Grid */}
        {filtered.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((achiever) => (
              <AchieverCard key={achiever.id} achiever={achiever} />
            ))}
          </div>
        ) : (
          <div className="glow-card text-center py-12 space-y-4">
            <p className="text-lg font-semibold text-slate-700">No achievers match your filters</p>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Try adjusting your filters, or become an Achiever yourself to help other students.
            </p>
            <Link href="/achievers/apply" className="glow-button-primary text-sm px-5 py-2.5 inline-flex">
              Become an Achiever
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
