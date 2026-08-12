import { ApiService } from './ApiService';
import type { PageResult } from '@/lib/types/serviceResults';

export type AdminUserRole = 'user' | 'premium' | 'moderator' | 'admin' | 'developer';
export type AdminUserRecord = {
  id: string;
  firstName: string;
  lastName: string;
  userName: string;
  email: string;
  profilePicture: string | null;
  role: AdminUserRole;
  isAdmin: boolean;
  emailVerified: boolean;
  accountStatus: string;
  archived: boolean;
  banned: boolean;
};

type UnknownRecord = Record<string, unknown>;
const isRecord = (value: unknown): value is UnknownRecord => typeof value === 'object' && value !== null && !Array.isArray(value);
const readString = (value: unknown): string => typeof value === 'string' ? value : '';
const readRole = (value: unknown): AdminUserRole => value === 'premium' || value === 'moderator' || value === 'admin' || value === 'developer' ? value : 'user';

export class AdminUserService {
  private static instance: AdminUserService;
  private readonly apiService = ApiService.getInstance();

  private constructor() {}

  public static getInstance(): AdminUserService {
    if (!AdminUserService.instance) AdminUserService.instance = new AdminUserService();
    return AdminUserService.instance;
  }

  public async fetchUsers(cursor?: string | null): Promise<PageResult<AdminUserRecord>> {
    const search = new URLSearchParams({ limit: '50' });
    if (cursor) search.set('cursor', cursor);
    const response = await this.apiService.request<{ success: boolean; data?: unknown[]; error?: string; pagination?: { hasMore?: boolean; nextCursor?: string | null } }>(`/api/admin/users?${search.toString()}`, { authenticated: true });
    if (!response.success) throw new Error(response.error || 'Unable to load users');
    return {
      items: (response.data ?? []).flatMap((value): AdminUserRecord[] => {
        if (!isRecord(value)) return [];
        const id = readString(value.id);
        if (!id) return [];
        return [{
          id,
          firstName: readString(value.firstName),
          lastName: readString(value.lastName),
          userName: readString(value.userName),
          email: readString(value.email),
          profilePicture: readString(value.profilePicture) || null,
          role: readRole(value.role),
          isAdmin: value.isAdmin === true,
          emailVerified: value.emailVerified === true,
          accountStatus: readString(value.accountStatus) || 'active',
          archived: value.deletedAt !== null && value.deletedAt !== undefined,
          banned: value.banned === true,
        }];
      }),
      hasMore: response.pagination?.hasMore === true,
      nextCursor: response.pagination?.nextCursor ?? null,
    };
  }

  public async updateRole(userId: string, role: AdminUserRole): Promise<void> {
    await this.apiService.request(`/api/admin/users/${encodeURIComponent(userId)}/role`, { method: 'PATCH', authenticated: true, body: { role } });
  }

  public async updateLifecycle(userId: string, action: 'archive' | 'unarchive'): Promise<void> {
    await this.apiService.request(`/api/admin/users/${encodeURIComponent(userId)}/lifecycle`, { method: 'POST', authenticated: true, body: { action } });
  }
}

export const adminUserService = AdminUserService.getInstance();
