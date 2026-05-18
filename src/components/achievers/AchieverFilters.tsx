'use client';

import { useState } from 'react';
import type { AchieverWithUniversity, AchieverFilters as Filters } from '@/types/achievers';

type Props = {
  achievers: AchieverWithUniversity[];
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
};

export function AchieverFilters({ achievers, filters, onFiltersChange }: Props) {
  const [subjectSearch, setSubjectSearch] = useState(filters.subject ?? '');

  // Derive unique universities from the data
  const universities = Array.from(
    new Map(
      achievers
        .filter((a) => a.university)
        .map((a) => [a.university!.id, a.university!]),
    ).values(),
  ).sort((a, b) => a.name.localeCompare(b.name));

  // Derive unique languages
  const allLanguages = Array.from(
    new Set(achievers.flatMap((a) => a.languages)),
  ).sort();

  return (
    <div className="glow-card-tight space-y-4">
      <h3 className="text-sm font-semibold text-slate-900">Filters</h3>

      {/* University filter */}
      <div>
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">University</label>
        <select
          className="field mt-1 text-sm"
          value={filters.university_id ?? ''}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              university_id: e.target.value ? Number(e.target.value) : undefined,
            })
          }
        >
          <option value="">All universities</option>
          {universities.map((uni) => (
            <option key={uni.id} value={uni.id}>
              {uni.name}
            </option>
          ))}
        </select>
      </div>

      {/* Subject search */}
      <div>
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Subject</label>
        <input
          type="text"
          className="field mt-1 text-sm"
          placeholder="Search subjects..."
          value={subjectSearch}
          onChange={(e) => {
            setSubjectSearch(e.target.value);
            onFiltersChange({ ...filters, subject: e.target.value || undefined });
          }}
        />
      </div>

      {/* Language filter */}
      <div>
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Language</label>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {allLanguages.map((lang) => {
            const selected = filters.languages?.includes(lang);
            return (
              <button
                key={lang}
                type="button"
                onClick={() => {
                  const current = filters.languages ?? [];
                  const next = selected
                    ? current.filter((l) => l !== lang)
                    : [...current, lang];
                  onFiltersChange({ ...filters, languages: next.length > 0 ? next : undefined });
                }}
                className={`glow-chip text-xs px-2.5 py-1 ${selected ? 'glow-chip-selected' : ''}`}
              >
                {lang}
              </button>
            );
          })}
        </div>
      </div>

      {/* Enrolled toggle */}
      <div>
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Status</label>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() =>
              onFiltersChange({
                ...filters,
                currently_enrolled: filters.currently_enrolled === true ? undefined : true,
              })
            }
            className={`glow-chip text-xs px-2.5 py-1 ${filters.currently_enrolled === true ? 'glow-chip-selected' : ''}`}
          >
            Currently enrolled
          </button>
          <button
            type="button"
            onClick={() =>
              onFiltersChange({
                ...filters,
                currently_enrolled: filters.currently_enrolled === false ? undefined : false,
              })
            }
            className={`glow-chip text-xs px-2.5 py-1 ${filters.currently_enrolled === false ? 'glow-chip-selected' : ''}`}
          >
            Alumni
          </button>
        </div>
      </div>

      {/* Sort */}
      <div>
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">Sort by</label>
        <select
          className="field mt-1 text-sm"
          value={filters.sort ?? 'rating'}
          onChange={(e) =>
            onFiltersChange({
              ...filters,
              sort: e.target.value as Filters['sort'],
            })
          }
        >
          <option value="rating">Top rated</option>
          <option value="newest">Newest</option>
          <option value="price_asc">Price: low → high</option>
          <option value="price_desc">Price: high → low</option>
        </select>
      </div>

      {/* Clear all */}
      <button
        type="button"
        onClick={() => onFiltersChange({})}
        className="glow-button-secondary text-xs w-full"
      >
        Clear all filters
      </button>
    </div>
  );
}
