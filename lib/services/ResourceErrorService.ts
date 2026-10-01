import { AppServerError } from './AppServerService';
import { AdminApiError } from './AdminApiService';
import { ServiceResultError, type ServiceErrorCode } from '@/lib/types/serviceResults';

export class ResourceErrorService {
  private static instance: ResourceErrorService;
  private constructor() {}

  public static getInstance(): ResourceErrorService {
    if (!ResourceErrorService.instance) ResourceErrorService.instance = new ResourceErrorService();
    return ResourceErrorService.instance;
  }

  public normalize(error: unknown, fallback: string): ServiceResultError {
    if (error instanceof ServiceResultError) return error;
    if (error instanceof AdminApiError) {
      const code: ServiceErrorCode = error.status === 401 ? 'authentication' : error.status === 403 ? 'authorization' : error.status === 404 ? 'not-found' : error.status === 400 ? 'validation' : error.status === 0 || error.status >= 500 ? 'network' : 'unknown';
      return new ServiceResultError(code, error.message, error);
    }
    if (error instanceof AppServerError) {
      const code: ServiceErrorCode = error.code === 'unauthenticated' ? 'authentication' : error.code === 'permission-denied' ? 'authorization' : error.code === 'not-found' ? 'not-found'
        : error.code === 'invalid-argument' || error.code === 'failed-precondition' ? 'validation' : error.code === 'unavailable' || error.code === 'deadline-exceeded' ? 'network' : 'unknown';
      return new ServiceResultError(code, error.message, error);
    }
    if (error instanceof TypeError) return new ServiceResultError('network', error.message || fallback, error);
    return new ServiceResultError('unknown', error instanceof Error ? error.message : fallback, error);
  }
}

export const resourceErrorService = ResourceErrorService.getInstance();
