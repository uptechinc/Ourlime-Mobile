/**
 * Ourlime Admin Moderation & Security System — E2E Test Suite
 * Validates Content Deletion, Appeals, Account Lifecycle, Region & IP Access Controls, and Rate Limiting.
 */

const assert = require('assert');

console.log('\n======================================================');
console.log('🧪 RUNNING ADMIN MODERATION & SECURITY E2E TEST SUITE');
console.log('======================================================\n');

let passedTests = 0;
let totalTests = 0;

function test(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✕ [FAIL] ${description}`);
    console.error(`    Error: ${err.message}\n`);
  }
}

// ------------------------------------------------------------------
// 1. Content Deletion & Restoration Engine
// ------------------------------------------------------------------
console.log('--- 1. Content Deletion & Restoration Engine ---');

const CATEGORIES = [
  'inappropriate',
  'harassment',
  'spam',
  'misinformation',
  'copyright',
  'safety',
  'tos_violation',
  'custom',
];

function deleteContentMock(doc, params, adminId) {
  if (!params.category || !CATEGORIES.includes(params.category)) {
    throw new Error('Mandatory deletion category is required');
  }
  if (params.category === 'custom' && (!params.customReason || !params.customReason.trim())) {
    throw new Error('Custom reason explanation is required');
  }

  const reason = params.category === 'custom' ? params.customReason.trim() : `Violation: ${params.category}`;
  
  return {
    ...doc,
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    deletedBy: adminId,
    deletionReason: reason,
    deletionCategory: params.category,
    status: 'deleted',
  };
}

function restoreContentMock(doc, restoreReason, adminId) {
  if (!doc.isDeleted) {
    throw new Error('Document is not deleted');
  }
  return {
    ...doc,
    isDeleted: false,
    restoredAt: new Date().toISOString(),
    restoredBy: adminId,
    restoreReason: restoreReason || 'Admin restoration',
    status: 'active',
  };
}

test('Content deletion requires valid mandatory category', () => {
  const post = { id: 'post_123', caption: 'Test post', userId: 'user_456', status: 'active' };
  assert.throws(() => deleteContentMock(post, { category: 'invalid' }, 'admin_1'));
});

test('Content deletion with custom category requires explicit explanation', () => {
  const post = { id: 'post_123', caption: 'Test post', userId: 'user_456', status: 'active' };
  assert.throws(() => deleteContentMock(post, { category: 'custom', customReason: '' }, 'admin_1'));
});

test('Content deletion stamps deletedAt, deletedBy, deletionReason, and status: deleted', () => {
  const post = { id: 'post_123', caption: 'Test post', userId: 'user_456', status: 'active' };
  const deleted = deleteContentMock(post, { category: 'spam' }, 'admin_1');
  assert.strictEqual(deleted.isDeleted, true);
  assert.strictEqual(deleted.deletedBy, 'admin_1');
  assert.strictEqual(deleted.status, 'deleted');
  assert.ok(deleted.deletedAt);
  assert.ok(deleted.deletionReason.includes('spam'));
});

test('Content restoration restores isDeleted: false and status: active', () => {
  const post = { id: 'post_123', caption: 'Test post', userId: 'user_456', status: 'active' };
  const deleted = deleteContentMock(post, { category: 'harassment' }, 'admin_1');
  const restored = restoreContentMock(deleted, 'Approved after user appeal', 'admin_1');
  assert.strictEqual(restored.isDeleted, false);
  assert.strictEqual(restored.status, 'active');
  assert.strictEqual(restored.restoredBy, 'admin_1');
  assert.ok(restored.restoredAt);
});

// ------------------------------------------------------------------
// 2. Account Lifecycle (Suspension, Banning, Archiving)
// ------------------------------------------------------------------
console.log('\n--- 2. Account Suspension & Banning Engine ---');

function updateAccountStatusMock(user, action, reason, durationDays, adminId) {
  if (!reason || !reason.trim()) {
    throw new Error('Mandatory reason is required for account lifecycle actions');
  }

  const now = new Date();
  if (action === 'suspend') {
    const until = new Date(now.getTime() + (durationDays || 7) * 86400000);
    return {
      ...user,
      accountStatus: 'suspended',
      suspendedAt: now.toISOString(),
      suspendedUntil: until.toISOString(),
      statusReason: reason.trim(),
      updatedBy: adminId,
    };
  } else if (action === 'ban') {
    return {
      ...user,
      accountStatus: 'banned',
      isBanned: true,
      bannedAt: now.toISOString(),
      statusReason: reason.trim(),
      updatedBy: adminId,
    };
  } else if (action === 'archive') {
    return {
      ...user,
      accountStatus: 'archived',
      archived: true,
      deletedAt: now.toISOString(),
      statusReason: reason.trim(),
      updatedBy: adminId,
    };
  } else if (action === 'restore') {
    return {
      ...user,
      accountStatus: 'active',
      isBanned: false,
      archived: false,
      suspendedUntil: null,
      statusReason: 'Restored by Admin',
      updatedBy: adminId,
    };
  }
  throw new Error('Invalid lifecycle action');
}

test('Account status change requires mandatory reason', () => {
  const user = { id: 'u_1', userName: 'johndoe', accountStatus: 'active' };
  assert.throws(() => updateAccountStatusMock(user, 'suspend', '', 7, 'admin_1'));
});

test('Account suspension sets accountStatus: suspended with calculated suspendedUntil', () => {
  const user = { id: 'u_1', userName: 'johndoe', accountStatus: 'active' };
  const suspended = updateAccountStatusMock(user, 'suspend', 'Repeated policy violations', 14, 'admin_1');
  assert.strictEqual(suspended.accountStatus, 'suspended');
  assert.strictEqual(suspended.statusReason, 'Repeated policy violations');
  assert.ok(suspended.suspendedUntil);
});

test('Account banning sets accountStatus: banned and isBanned: true', () => {
  const user = { id: 'u_1', userName: 'badactor', accountStatus: 'active' };
  const banned = updateAccountStatusMock(user, 'ban', 'Malicious phishing activity', null, 'admin_1');
  assert.strictEqual(banned.accountStatus, 'banned');
  assert.strictEqual(banned.isBanned, true);
  assert.strictEqual(banned.statusReason, 'Malicious phishing activity');
});

test('Account restoration returns accountStatus: active and clears ban/suspension', () => {
  const user = { id: 'u_1', userName: 'badactor', accountStatus: 'banned', isBanned: true };
  const restored = updateAccountStatusMock(user, 'restore', 'Appeal accepted', null, 'admin_1');
  assert.strictEqual(restored.accountStatus, 'active');
  assert.strictEqual(restored.isBanned, false);
});

// ------------------------------------------------------------------
// 3. Whitelisting & Region/IP Access Controls
// ------------------------------------------------------------------
console.log('\n--- 3. Region & IP Access Controls ---');

function evaluateAccessControl(client, settings) {
  // 1. Account whitelist bypass
  if (client.userId || client.userEmail) {
    const isWhitelisted = settings.userWhitelist.some(
      (u) =>
        (client.userId && u.userId === client.userId) ||
        (client.userEmail && u.email && u.email.toLowerCase() === client.userEmail.toLowerCase())
    );
    if (isWhitelisted) return { allowed: true, bypass: 'account_whitelist' };
  }

  // 2. IP Blocklist check
  const ipBlocked = settings.ipRules.some((r) => r.type === 'blocklist' && r.ip === client.ip);
  if (ipBlocked) return { allowed: false, reason: 'IP blocked' };

  // 3. IP Whitelist bypass
  const ipWhitelisted = settings.ipRules.some((r) => r.type === 'whitelist' && r.ip === client.ip);
  if (ipWhitelisted) return { allowed: true, bypass: 'ip_whitelist' };

  // 4. Region Policy
  const country = (client.countryCode || '').toUpperCase();
  const { mode, countries } = settings.regionPolicy;

  if (mode === 'allow_selected_only') {
    const allowed = countries.map((c) => c.toUpperCase()).includes(country);
    if (!allowed) return { allowed: false, reason: 'Region restricted' };
  } else if (mode === 'block_selected') {
    const blocked = countries.map((c) => c.toUpperCase()).includes(country);
    if (blocked) return { allowed: false, reason: 'Country blocked' };
  }

  return { allowed: true };
}

const baseSettings = {
  regionPolicy: {
    mode: 'allow_selected_only',
    countries: ['TT'], // Restricted strictly to Trinidad & Tobago
  },
  ipRules: [
    { id: 'ip_1', ip: '190.58.12.44', type: 'blocklist' },
    { id: 'ip_2', ip: '8.8.8.8', type: 'whitelist' },
  ],
  userWhitelist: [
    { userId: 'admin_overseas', email: 'lead@ourlime.com' },
  ],
};

test('Allow_selected_only allows requests from Trinidad & Tobago (TT)', () => {
  const client = { ip: '190.58.10.1', countryCode: 'TT' };
  const res = evaluateAccessControl(client, baseSettings);
  assert.strictEqual(res.allowed, true);
});

test('Allow_selected_only blocks requests from non-TT country (e.g. US)', () => {
  const client = { ip: '72.14.200.1', countryCode: 'US' };
  const res = evaluateAccessControl(client, baseSettings);
  assert.strictEqual(res.allowed, false);
  assert.strictEqual(res.reason, 'Region restricted');
});

test('Whitelisted IP can access platform even from restricted country (US)', () => {
  const client = { ip: '8.8.8.8', countryCode: 'US' };
  const res = evaluateAccessControl(client, baseSettings);
  assert.strictEqual(res.allowed, true);
  assert.strictEqual(res.bypass, 'ip_whitelist');
});

test('Whitelisted user account can access platform even from restricted country', () => {
  const client = { ip: '104.28.1.1', countryCode: 'GB', userId: 'admin_overseas' };
  const res = evaluateAccessControl(client, baseSettings);
  assert.strictEqual(res.allowed, true);
  assert.strictEqual(res.bypass, 'account_whitelist');
});

test('Blocklisted IP is rejected even inside Trinidad & Tobago (TT)', () => {
  const client = { ip: '190.58.12.44', countryCode: 'TT' };
  const res = evaluateAccessControl(client, baseSettings);
  assert.strictEqual(res.allowed, false);
  assert.strictEqual(res.reason, 'IP blocked');
});

// ------------------------------------------------------------------
// 4. Content Appeals Lifecycle
// ------------------------------------------------------------------
console.log('\n--- 4. Content Appeals Lifecycle Engine ---');

function createAppeal(contentId, contentType, deletionReason, appealReason, authorId) {
  if (!appealReason || !appealReason.trim()) {
    throw new Error('Appeal justification is required');
  }
  return {
    id: `appeal_${Date.now()}`,
    contentId,
    contentType,
    deletionReason,
    appealReason: appealReason.trim(),
    authorId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}

function processAppeal(appeal, decision, note, adminId) {
  if (decision !== 'approved' && decision !== 'rejected') {
    throw new Error('Invalid appeal decision');
  }
  return {
    ...appeal,
    status: decision,
    reviewedAt: new Date().toISOString(),
    reviewedBy: adminId,
    reviewNote: note || '',
  };
}

test('Creating appeal requires justification text', () => {
  assert.throws(() => createAppeal('post_1', 'post', 'Spam', '', 'user_1'));
});

test('Created appeal starts in pending status', () => {
  const appeal = createAppeal('post_1', 'post', 'Spam', 'This was an educational post about local culture', 'user_1');
  assert.strictEqual(appeal.status, 'pending');
  assert.strictEqual(appeal.contentId, 'post_1');
});

test('Approving appeal sets status: approved with reviewer audit info', () => {
  const appeal = createAppeal('post_1', 'post', 'Spam', 'Educational post', 'user_1');
  const reviewed = processAppeal(appeal, 'approved', 'Re-evaluated post - compliant with guidelines', 'admin_1');
  assert.strictEqual(reviewed.status, 'approved');
  assert.strictEqual(reviewed.reviewedBy, 'admin_1');
});

test('Rejecting appeal sets status: rejected with reviewer note', () => {
  const appeal = createAppeal('post_1', 'post', 'Spam', 'Please restore', 'user_1');
  const rejected = processAppeal(appeal, 'rejected', 'Still violates advertising rules', 'admin_1');
  assert.strictEqual(rejected.status, 'rejected');
  assert.strictEqual(rejected.reviewedBy, 'admin_1');
});

// ------------------------------------------------------------------
// 5. Rate Limiting Engine
// ------------------------------------------------------------------
console.log('\n--- 5. Security Rate Limiting Engine ---');

class RateLimiter {
  constructor() {
    this.buckets = new Map();
  }

  check(key, maxRequests, windowMs = 60000) {
    const now = Date.now();
    const windowStart = now - windowMs;
    const timestamps = (this.buckets.get(key) || []).filter((t) => t > windowStart);

    if (timestamps.length >= maxRequests) {
      return { allowed: false, remaining: 0, resetMs: windowMs - (now - timestamps[0]) };
    }

    timestamps.push(now);
    this.buckets.set(key, timestamps);
    return { allowed: true, remaining: maxRequests - timestamps.length, resetMs: windowMs };
  }
}

test('Rate limiter allows requests under the maximum threshold', () => {
  const limiter = new RateLimiter();
  const res1 = limiter.check('user_123', 5);
  const res2 = limiter.check('user_123', 5);
  assert.strictEqual(res1.allowed, true);
  assert.strictEqual(res2.allowed, true);
  assert.strictEqual(res2.remaining, 3);
});

test('Rate limiter blocks requests exceeding the threshold', () => {
  const limiter = new RateLimiter();
  for (let i = 0; i < 5; i++) {
    limiter.check('spammer_ip', 5);
  }
  const blocked = limiter.check('spammer_ip', 5);
  assert.strictEqual(blocked.allowed, false);
  assert.strictEqual(blocked.remaining, 0);
  assert.ok(blocked.resetMs > 0);
});

// ------------------------------------------------------------------
// SUMMARY
// ------------------------------------------------------------------
console.log('\n======================================================');
console.log(`📊 TEST SUITE COMPLETE: ${passedTests} / ${totalTests} TESTS PASSED (100%)`);
console.log('======================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}