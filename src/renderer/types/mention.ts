export interface MentionSuggestion {
  /** Unique key (name or draft.id) */
  id: string;
  /** Name to insert: @name */
  name: string;
  /** Role displayed in suggestion list */
  subtitle?: string;
  /** Color name from TeamColorSet palette */
  color?: string;
  /** Suggestion type — 'member' (default), 'team', or 'file' */
  type?: 'member' | 'team' | 'file';
  /** Whether the team is currently online (team suggestions only) */
  isOnline?: boolean;
  /** Absolute file path (file suggestions only) */
  filePath?: string;
  /** Relative display path (file suggestions only) */
  relativePath?: string;
}
