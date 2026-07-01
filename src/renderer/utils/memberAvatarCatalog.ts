// Abstract icon set — KanbanCode brand palette (cyan, purple, blue)
// Replaces the 13 participant-avatar PNGs with inline SVG data URLs.
// The exported API surface is unchanged.

type SvgStop = readonly [string, string]; // [offset, color]

function svgDataUrl(svgBody: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${svgBody}</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function circleIcon(stops: SvgStop[], accent: string, shape?: string): string {
  const stopTags = stops
    .map(([offset, color]) => `<stop offset="${offset}" stop-color="${color}"/>`)
    .join('');
  return svgDataUrl(
    `<defs><radialGradient id="bg" cx="38%" cy="32%">${stopTags}</radialGradient></defs>` +
      `<circle cx="32" cy="32" r="32" fill="url(#bg)"/>` +
      `<circle cx="21" cy="22" r="7" fill="${accent}" opacity=".45"/>` +
      (shape ?? `<rect x="26" y="40" width="24" height="4" rx="2" fill="${accent}" opacity=".35"/>`)
  );
}

// 13 unique abstract icons cycling through the KanbanCode brand palette
export const PARTICIPANT_AVATAR_URLS: readonly string[] = [
  // 1 — cyan primary (lead)
  circleIcon(
    [['0%', '#67e8f9'], ['100%', '#0891b2']],
    '#cffafe',
    `<path d="M20 42 Q32 28 44 42" fill="none" stroke="#cffafe" stroke-width="3" stroke-linecap="round" opacity=".5"/>`
  ),
  // 2 — violet + cyan
  circleIcon(
    [['0%', '#c4b5fd'], ['100%', '#7c3aed']],
    '#ede9fe',
    `<rect x="20" y="38" width="8" height="8" rx="2" fill="#ede9fe" opacity=".4"/>` +
    `<rect x="32" y="34" width="8" height="12" rx="2" fill="#ede9fe" opacity=".4"/>` +
    `<rect x="44" y="30" width="0" height="0"/>` // placeholder
  ),
  // 3 — teal + blue
  circleIcon(
    [['0%', '#5eead4'], ['100%', '#0d9488']],
    '#ccfbf1'
  ),
  // 4 — blue + violet
  circleIcon(
    [['0%', '#93c5fd'], ['100%', '#2563eb']],
    '#dbeafe',
    `<circle cx="22" cy="40" r="5" fill="#dbeafe" opacity=".35"/>` +
    `<circle cx="36" cy="44" r="3" fill="#dbeafe" opacity=".3"/>`
  ),
  // 5 — rose-purple + cyan
  circleIcon(
    [['0%', '#d8b4fe'], ['100%', '#9333ea']],
    '#f3e8ff'
  ),
  // 6 — sky + teal
  circleIcon(
    [['0%', '#7dd3fc'], ['100%', '#0284c7']],
    '#e0f2fe',
    `<path d="M18 44 L28 36 L38 44 L48 36" fill="none" stroke="#e0f2fe" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity=".5"/>`
  ),
  // 7 — indigo + blue
  circleIcon(
    [['0%', '#a5b4fc'], ['100%', '#4338ca']],
    '#e0e7ff'
  ),
  // 8 — cyan + violet
  circleIcon(
    [['0%', '#22d3ee'], ['100%', '#7c3aed']],
    '#cffafe',
    `<circle cx="32" cy="40" r="8" fill="#cffafe" opacity=".25"/>` +
    `<circle cx="32" cy="40" r="4" fill="#cffafe" opacity=".35"/>`
  ),
  // 9 — emerald-teal + cyan
  circleIcon(
    [['0%', '#6ee7b7'], ['100%', '#0891b2']],
    '#d1fae5'
  ),
  // 10 — violet + indigo
  circleIcon(
    [['0%', '#a78bfa'], ['100%', '#6d28d9']],
    '#ede9fe',
    `<path d="M24 44 Q32 32 40 44" fill="none" stroke="#ede9fe" stroke-width="3" stroke-linecap="round" opacity=".5"/>`
  ),
  // 11 — blue + teal
  circleIcon(
    [['0%', '#60a5fa'], ['100%', '#0d9488']],
    '#dbeafe'
  ),
  // 12 — purple + sky
  circleIcon(
    [['0%', '#c084fc'], ['100%', '#0284c7']],
    '#f3e8ff',
    `<rect x="20" y="40" width="24" height="4" rx="2" fill="#f3e8ff" opacity=".4"/>` +
    `<rect x="24" y="34" width="16" height="4" rx="2" fill="#f3e8ff" opacity=".3"/>`
  ),
  // 13 — cyan + purple (back to brand)
  circleIcon(
    [['0%', '#34d399'], ['100%', '#7c3aed']],
    '#d1fae5'
  ),
] as const;

export const LEAD_PARTICIPANT_AVATAR_URL = PARTICIPANT_AVATAR_URLS[0];

export function getParticipantAvatarUrlByIndex(index: number): string {
  const normalized =
    ((Math.trunc(index) % PARTICIPANT_AVATAR_URLS.length) + PARTICIPANT_AVATAR_URLS.length) %
    PARTICIPANT_AVATAR_URLS.length;
  return PARTICIPANT_AVATAR_URLS[normalized];
}
