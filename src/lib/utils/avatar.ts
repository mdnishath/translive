/**
 * Shared avatar utilities used across chat components.
 * Deterministic gradient and initials derived from user ID / name
 * so the same user always gets the same color on every device.
 */

const GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-cyan-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-pink-500 to-rose-600",
  "from-amber-500 to-orange-600",
  "from-indigo-500 to-blue-700",
] as const;

/** Returns a deterministic Tailwind gradient class based on the user's ID. */
export function avatarGradient(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return GRADIENTS[hash % GRADIENTS.length];
}

/** Returns up to 2 uppercase initials from a display name. */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
