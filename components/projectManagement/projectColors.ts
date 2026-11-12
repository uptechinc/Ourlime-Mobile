/**
 * Project and milestone colours are stored as Tailwind classes (the website renders `project.color` directly).
 * Same options as Ourlime-Web components/projectManagement/ProjectColorPicker.tsx.
 */
export const PROJECT_COLOR_OPTIONS = [
  { value: 'bg-emerald-500', label: 'Emerald', hex: '#10b981' },
  { value: 'bg-sky-500', label: 'Sky', hex: '#0ea5e9' },
  { value: 'bg-violet-500', label: 'Violet', hex: '#8b5cf6' },
  { value: 'bg-amber-500', label: 'Amber', hex: '#f59e0b' },
  { value: 'bg-rose-500', label: 'Rose', hex: '#f43f5e' },
  { value: 'bg-teal-500', label: 'Teal', hex: '#14b8a6' },
  { value: 'bg-indigo-500', label: 'Indigo', hex: '#6366f1' },
  { value: 'bg-orange-500', label: 'Orange', hex: '#f97316' },
] as const;

export const DEFAULT_PROJECT_COLOR = PROJECT_COLOR_OPTIONS[0].value;

const EXTRA_COLORS: { [className: string]: string } = {
  'bg-blue-500': '#3b82f6',
  'bg-purple-500': '#a855f7',
  'bg-green-500': '#22c55e',
  'bg-red-500': '#ef4444',
  'bg-yellow-500': '#eab308',
  'bg-pink-500': '#ec4899',
  'bg-gray-500': '#6b7280',
};

/** Hex for a stored Tailwind colour class (falls back to emerald). */
export function projectColorHex(className: string | undefined): string {
  if (!className) return '#10b981';
  if (className.startsWith('#')) return className;
  return PROJECT_COLOR_OPTIONS.find((option) => option.value === className)?.hex ?? EXTRA_COLORS[className] ?? '#10b981';
}
