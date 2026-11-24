import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { ApiError } from '@/lib/api';
import { useUi } from '@/components/ui';

/** Everything is small — after any change just refetch all active queries. */
export function useRefresh() {
  const qc = useQueryClient();
  return useCallback(() => qc.invalidateQueries(), [qc]);
}

/** Run an async action with consistent toasts + refresh. */
export function useAction() {
  const { toast } = useUi();
  const refresh = useRefresh();
  return useCallback(
    async <T,>(fn: () => Promise<T>, okMsg?: string): Promise<T | undefined> => {
      try {
        const r = await fn();
        if (okMsg) toast(okMsg);
        await refresh();
        return r;
      } catch (e) {
        toast(e instanceof ApiError || e instanceof Error ? e.message : 'Something went wrong', 'err');
        return undefined;
      }
    },
    [toast, refresh],
  );
}

export const num = (v: string): number | null => (v === '' ? null : Number(v));
