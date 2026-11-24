import { describe, expect, test } from 'bun:test';

const rules = await import('./AdminWorkspaceRules.ts');

describe('AdminWorkspaceRules', () => {
  test('treats the server soft delete as deleted', () => {
    expect(rules.isSoftDeletedRecord({ isDeleted: true, status: 'deleted' })).toBe(true);
    expect(rules.isSoftDeletedRecord({ isDeleted: true })).toBe(true);
    expect(rules.isSoftDeletedRecord({ status: 'deleted' })).toBe(true);
    expect(rules.isSoftDeletedRecord({ status: 'DELETED' })).toBe(true);
    expect(rules.isSoftDeletedRecord({ isDeleted: false, status: 'approved' })).toBe(false);
    expect(rules.isSoftDeletedRecord({})).toBe(false);
  });

  test('keeps known statuses and derives the rest from the active flags', () => {
    expect(rules.resolveWorkspaceStatus({ status: 'Pending' })).toBe('pending');
    expect(rules.resolveWorkspaceStatus({ status: 'rejected', isActive: true })).toBe('rejected');
    expect(rules.resolveWorkspaceStatus({})).toBe('active');
    expect(rules.resolveWorkspaceStatus({ enabled: false })).toBe('disabled');
    expect(rules.resolveWorkspaceStatus({ status: 'something-else', isPublished: false })).toBe('disabled');
    expect(rules.resolveWorkspaceStatus({ status: 42 })).toBe('active');
  });

  test('reads community privacy from isPrivate when there is no privacy string', () => {
    expect(rules.resolveCommunityPrivacy(undefined, true)).toBe('private');
    expect(rules.resolveCommunityPrivacy(undefined, false)).toBe('public');
    expect(rules.resolveCommunityPrivacy('', undefined)).toBe('public');
    expect(rules.resolveCommunityPrivacy('Private', false)).toBe('private');
  });

  test('pages drop deleted records but the cursor still moves past them', () => {
    const documents = [
      { id: 'a', data: { status: 'approved' } },
      { id: 'b', data: { isDeleted: true, status: 'deleted' } },
      { id: 'c', data: { status: 'pending' } },
      { id: 'd', data: { status: 'pending' } },
    ];
    const firstPage = rules.buildWorkspacePage(documents, 3);
    expect(firstPage.visible.map((document) => document.id)).toEqual(['a', 'c']);
    expect(firstPage.nextCursor).toBe('c');

    const lastPage = rules.buildWorkspacePage(documents.slice(3), 3);
    expect(lastPage.visible.map((document) => document.id)).toEqual(['d']);
    expect(lastPage.nextCursor).toBeNull();
  });

  test('a page whose records were all deleted still offers the next page', () => {
    const page = rules.buildWorkspacePage([
      { id: 'a', data: { status: 'deleted' } },
      { id: 'b', data: { isDeleted: true } },
      { id: 'c', data: {} },
    ], 2);
    expect(page.visible).toEqual([]);
    expect(page.nextCursor).toBe('b');
  });
});
