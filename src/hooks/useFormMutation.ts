'use client';

import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { FieldValues, UseFormReturn } from 'react-hook-form';
import { toast } from 'sonner';
import { applyFieldErrors, errorMessage } from '@/lib/farm/client';

/** Submit a form to the API: toast on success, refresh queries, map server field errors onto inputs. */
export function useFormMutation<TValues extends FieldValues, TResult>(
  form: UseFormReturn<TValues>,
  mutationFn: (values: TValues) => Promise<TResult>,
  options: { success: string; invalidate: QueryKey[]; onDone?: (result: TResult) => void }
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (result) => {
      toast.success(options.success);
      await Promise.all(options.invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      options.onDone?.(result);
    },
    onError: (err) => {
      if (!applyFieldErrors(err, form.setError)) {
        form.setError('root', { type: 'server', message: errorMessage(err) });
      }
    },
  });
}

/** Non-form actions (delete, toggles): toast either way and refresh queries. */
export function useActionMutation<TArgs, TResult>(
  mutationFn: (args: TArgs) => Promise<TResult>,
  options: { success: string; invalidate: QueryKey[]; onDone?: (result: TResult) => void }
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: async (result) => {
      toast.success(options.success);
      await Promise.all(options.invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
      options.onDone?.(result);
    },
    onError: (err) => toast.error(errorMessage(err)),
  });
}
