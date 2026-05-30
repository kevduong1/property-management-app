import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from 'expo-router';

/**
 * Minimal async-data hook. Loads on mount and whenever `deps` change, and
 * reloads when the screen regains focus (so newly created rows appear).
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    try {
      const result = await fn();
      setData(result);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, deps);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Reload on focus without flashing the spinner.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { data, loading, error, reload: load };
}
