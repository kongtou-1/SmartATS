import { createContext, useContext } from 'react';

export interface PrimaryAction {
  label: string;
  onClick: () => void;
}

export interface ShellContextValue {
  /** Global top-bar search query, pages may read & filter on it. */
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  /** Register a primary "+" action for the current page (undefined hides it). */
  setPrimaryAction: (a: PrimaryAction | undefined) => void;
  /** Register an export handler for the current page (undefined hides the button). */
  setExportFn: (fn: (() => void) | undefined) => void;
  /** Refresh action (re-mounts the current page). Immersive pages use it in their own header. */
  onRefresh?: () => void;
  /** Toggle the notification center. */
  onToggleNotifications?: () => void;
  /** Unread notification count (for the bell badge). */
  unreadCount?: number;
}

export const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used within <Layout>');
  return ctx;
}
