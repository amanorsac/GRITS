import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

type LoaderState<T> = {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  refreshing: boolean;
  /** Pull-to-refresh: shows the spinner. */
  refresh: () => Promise<void>;
  /** Quiet reload without a spinner. */
  reload: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T | undefined>>;
};

/**
 * Loads data for a screen with loading / error / refresh states.
 * `loader` must be memoised (useCallback). With `refetchOnFocus`, data reloads quietly
 * whenever the screen regains focus (e.g. after finishing a lesson).
 */
export function useLoader<T>(loader: () => Promise<T>, { refetchOnFocus = false } = {}): LoaderState<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  const firstFocus = useRef(true);

  const run = useCallback(
    async (mode: 'refresh' | 'quiet') => {
      if (mode === 'refresh') setRefreshing(true);
      try {
        const next = await loader();
        if (!mounted.current) return;
        setData(next);
        setError(null);
      } catch (e) {
        if (!mounted.current) return;
        setError(e instanceof Error ? e.message : 'Something went wrong.');
      } finally {
        if (mounted.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [loader],
  );

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    loader().then(
      (next) => {
        if (cancelled) return;
        setData(next);
        setError(null);
        setLoading(false);
      },
      (e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Something went wrong.');
        setLoading(false);
      },
    );
    return () => {
      cancelled = true;
      mounted.current = false;
    };
  }, [loader]);

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      if (refetchOnFocus) run('quiet');
    }, [refetchOnFocus, run]),
  );

  const refresh = useCallback(() => run('refresh'), [run]);
  const reload = useCallback(() => run('quiet'), [run]);

  return { data, error, loading, refreshing, refresh, reload, setData };
}
