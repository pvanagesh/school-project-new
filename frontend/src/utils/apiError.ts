import type { AxiosError } from 'axios';

export function firstApiError(err: unknown, fallback: string): string {
  const axiosErr = err as AxiosError<Record<string, string[] | string>>;
  const data = axiosErr.response?.data;
  const firstError = data ? Object.values(data).flat()[0] : undefined;
  return typeof firstError === 'string' ? firstError : fallback;
}
