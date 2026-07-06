import { getTeamColorSet, getThemedBorder } from '@renderer/constants/teamColors';

interface MemberColorAvatarProps {
  /** The member's assigned color name/hex; empty falls back to the default palette color. */
  color?: string;
  /** Pre-resolved theme flag from the caller (avoids a hook in hot lists). */
  isLight: boolean;
  /** Tailwind size class, e.g. "size-7". */
  className?: string;
}

/**
 * A member's identity is a single plain color. This renders that color as a solid
 * round dot — the same color used for the member's message accent border — instead
 * of a generic identicon image, so a member reads as ONE consistent color everywhere.
 */
export function MemberColorAvatar({
  color,
  isLight,
  className = 'size-6',
}: Readonly<MemberColorAvatarProps>): React.JSX.Element {
  const fill = getThemedBorder(getTeamColorSet(color ?? ''), isLight);
  return (
    <span
      className={`inline-block shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: fill }}
      aria-hidden
    />
  );
}
