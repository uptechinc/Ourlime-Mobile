import type { ServiceResultError } from './serviceResults';

export type ResourceStatus = 'idle' | 'hydrating' | 'ready' | 'refreshing' | 'error';
export type ResourceSource = 'memory' | 'disk' | 'network';
/** Whether a load was started by the screen the user is looking at or by background preloading. */
export type ResourcePriority = 'foreground' | 'background';

export type ResourceState<TData> = {
  data: TData | null;
  status: ResourceStatus;
  source: ResourceSource;
  updatedAt: number | null;
  isStale: boolean;
  error: ServiceResultError | null;
};

export function createIdleResource<TData>(): ResourceState<TData> {
  return { data: null, status: 'idle', source: 'memory', updatedAt: null, isStale: true, error: null };
}
