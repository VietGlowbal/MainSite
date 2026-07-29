'use client';

import { useState } from 'react';
import { Input, RangeHistogram, RepeatableFieldset } from '@/shared/ui';

/**
 * Drives the two stateful form primitives from the kitchen sink.
 *
 * Both are only meaningful in motion — a static RepeatableFieldset says nothing
 * about whether removing the middle entry shuffles the others, and a static
 * RangeHistogram says nothing about whether the handles can cross. They are
 * checked here against the app's real CSS before Reflection consumes them.
 */

type Achievement = { id: string; title: string };

/**
 * Placeholder distribution, clearly shaped rather than realistic.
 *
 * The live form must draw this from real budget data — a made-up curve is a
 * claim about other students that we cannot support, and this page is a
 * reference, not a source of numbers.
 */
const DEMO_DISTRIBUTION = [2, 5, 9, 14, 22, 31, 27, 19, 12, 7, 4, 2];

export function FormPrimitivesDemo() {
  const [achievements, setAchievements] = useState<Achievement[]>([
    { id: 'a1', title: 'National Olympiad in Informatics' },
  ]);
  const [nextId, setNextId] = useState(2);
  const [budget, setBudget] = useState({ low: 270, high: 500 });

  return (
    <div className="flex flex-col gap-gb-6xl">
      <RepeatableFieldset
        legend="Academic achievements"
        description="Awards, research, certifications. One entry each."
        entries={achievements}
        keyOf={(entry) => entry.id}
        entryLabel={(index) => `Achievement ${index + 1}`}
        addLabel="Add another achievement"
        max={3}
        emptyState="Nothing added yet. Achievements give the portrait something concrete to work from."
        onAdd={() => {
          setAchievements((prev) => [...prev, { id: `a${nextId}`, title: '' }]);
          setNextId((n) => n + 1);
        }}
        onRemove={(index) => setAchievements((prev) => prev.filter((_, i) => i !== index))}
        renderEntry={(entry, index) => (
          <div className="grid gap-gb-xl sm:grid-cols-2">
            <Input
              name={`achievement-${index}-title`}
              label="Title"
              value={entry.title}
              placeholder="e.g. National Olympiad in Informatics"
              onChange={(event) =>
                setAchievements((prev) =>
                  prev.map((a, i) => (i === index ? { ...a, title: event.target.value } : a)),
                )
              }
            />
            <Input
              name={`achievement-${index}-org`}
              label="Awarded by"
              placeholder="e.g. Ministry of Education"
            />
          </div>
        )}
      />

      <RangeHistogram
        min={0}
        max={1000}
        step={10}
        low={budget.low}
        high={budget.high}
        onChange={setBudget}
        distribution={DEMO_DISTRIBUTION}
        label="Total budget"
        formatValue={(low, high) =>
          `${(low * 1_000_000).toLocaleString('vi-VN')} - ${(high * 1_000_000).toLocaleString('vi-VN')} VND`
        }
      />
    </div>
  );
}
