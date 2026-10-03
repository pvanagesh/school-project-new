import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { BoardValue, DivisionGroupValue } from '../types';

// Which division (Board x School/College) Super Admin is currently "looking
// at" across the app. School Profile is the one page that sets this —
// picking a division there (e.g. SSC School) becomes the starting tab on
// Classes & Sections, Subjects, Teachers and Users & Roles too, so Super
// Admin doesn't have to re-pick the same division on every page. Each of
// those pages only reads this once, as its own initial tab — from then on
// it's that page's own independent, still-switchable state, exactly like
// before. A division-scoped account (Principal/Teacher/Class Teacher/
// Accountant) ignores this entirely; their own lock always wins.
interface ActiveDivisionContextValue {
  board: BoardValue;
  group: DivisionGroupValue;
  setActiveDivision: (board: BoardValue, group: DivisionGroupValue) => void;
}

const ActiveDivisionContext = createContext<ActiveDivisionContextValue | undefined>(undefined);

// Persisted so the division you were last on survives a page reload or
// coming back later — without this it silently reset to CBSE School every
// time the app remounted, even right after picking something else on
// School Profile.
const STORAGE_KEY = 'active_division';

function loadStoredDivision(): { board: BoardValue; group: DivisionGroupValue } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if ((parsed.board === 'CBSE' || parsed.board === 'SSC') && (parsed.group === 'JUNIOR' || parsed.group === 'SENIOR')) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function ActiveDivisionProvider({ children }: { children: ReactNode }) {
  const stored = loadStoredDivision();
  const [board, setBoard] = useState<BoardValue>(stored?.board ?? 'CBSE');
  const [group, setGroup] = useState<DivisionGroupValue>(stored?.group ?? 'JUNIOR');

  const setActiveDivision = useCallback((nextBoard: BoardValue, nextGroup: DivisionGroupValue) => {
    setBoard(nextBoard);
    setGroup(nextGroup);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ board: nextBoard, group: nextGroup }));
    } catch {
      // Best-effort — a private/blocked storage just means it won't persist.
    }
  }, []);

  return (
    <ActiveDivisionContext.Provider value={{ board, group, setActiveDivision }}>
      {children}
    </ActiveDivisionContext.Provider>
  );
}

export function useActiveDivision(): ActiveDivisionContextValue {
  const ctx = useContext(ActiveDivisionContext);
  if (!ctx) throw new Error('useActiveDivision must be used within an ActiveDivisionProvider');
  return ctx;
}
