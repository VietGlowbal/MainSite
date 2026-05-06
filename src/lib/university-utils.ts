// Visual utilities for university display

const GRADIENTS: [string, string][] = [
  ['#1a1a2e', '#16213e'],   // deep navy
  ['#0f3460', '#533483'],   // navy to purple
  ['#1b4332', '#2d6a4f'],   // forest green
  ['#370617', '#6a040f'],   // deep red
  ['#03045e', '#0077b6'],   // ocean blue
  ['#2d00f7', '#6a00f4'],   // electric indigo
  ['#3a0ca3', '#4361ee'],   // violet to blue
  ['#134074', '#13315c'],   // steel blue
];

export function getUniversityGradient(universityName: string): string {
  const index = universityName.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % GRADIENTS.length;
  const [from, to] = GRADIENTS[index];
  return `linear-gradient(135deg, ${from} 0%, ${to} 100%)`;
}

export function getAcceptanceColor(acceptRate: string | null | undefined): string {
  if (!acceptRate) return 'text-slate-400';
  const num = parseInt(acceptRate.replace(/[^0-9]/g, ''), 10);
  if (isNaN(num)) return 'text-slate-400';
  if (num < 20) return 'text-emerald-600';
  if (num <= 40) return 'text-amber-600';
  return 'text-red-500';
}
