import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetchSchoolProfiles } from '../api/core';
import { useAuth } from '../auth/AuthContext';
import type { SchoolProfile } from '../types';

interface SchoolProfileContextValue {
  // Up to 4 rows — one per division (board x junior/senior group). There's
  // no single "the" school profile anymore now that each division keeps
  // its own affiliation details, so this is the full list rather than one
  // profile; a consumer that needs one division's row should filter by its
  // own board/group (see SchoolProfilePage).
  profiles: SchoolProfile[];
  isLoading: boolean;
  refresh: () => void;
}

const SchoolProfileContext = createContext<SchoolProfileContextValue | undefined>(undefined);

export function SchoolProfileProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [profiles, setProfiles] = useState<SchoolProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(() => {
    if (!isAuthenticated) {
      setProfiles([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    fetchSchoolProfiles()
      .then(setProfiles)
      .catch(() => setProfiles([]))
      .finally(() => setIsLoading(false));
  }, [isAuthenticated]);

  useEffect(refresh, [refresh]);

  return (
    <SchoolProfileContext.Provider value={{ profiles, isLoading, refresh }}>
      {children}
    </SchoolProfileContext.Provider>
  );
}

export function useSchoolProfile(): SchoolProfileContextValue {
  const ctx = useContext(SchoolProfileContext);
  if (!ctx) throw new Error('useSchoolProfile must be used within a SchoolProfileProvider');
  return ctx;
}
