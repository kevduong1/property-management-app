/**
 * Selected child-series context. Drives the "which series am I viewing?"
 * affordance that's present everywhere in the app. `null` selection means
 * "All series" (parent LLC view).
 */
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { repo } from '@/services/repo';
import type { ChildSeries } from '@/types';

interface SeriesState {
  seriesList: ChildSeries[];
  selectedId: string | null; // null => all series
  selected: ChildSeries | null;
  setSelectedId: (id: string | null) => void;
  refresh: () => Promise<void>;
}

const SeriesContext = createContext<SeriesState | undefined>(undefined);

export function SeriesProvider({ children }: { children: React.ReactNode }) {
  const [seriesList, setSeriesList] = useState<ChildSeries[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const refresh = async () => {
    const list = await repo.listSeries();
    setSeriesList(list);
  };

  useEffect(() => {
    refresh();
  }, []);

  const selected = useMemo(
    () => seriesList.find((s) => s.id === selectedId) ?? null,
    [seriesList, selectedId],
  );

  const value = useMemo<SeriesState>(
    () => ({ seriesList, selectedId, selected, setSelectedId, refresh }),
    [seriesList, selectedId, selected],
  );

  return <SeriesContext.Provider value={value}>{children}</SeriesContext.Provider>;
}

export function useSeries(): SeriesState {
  const ctx = useContext(SeriesContext);
  if (!ctx) throw new Error('useSeries must be used within SeriesProvider');
  return ctx;
}
