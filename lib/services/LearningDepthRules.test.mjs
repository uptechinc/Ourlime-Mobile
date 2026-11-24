import { describe, expect, test } from 'bun:test';

const {
  CERTIFICATE_LABEL, certificateWebLink, decodeCertificate, decodeEligibility, decodeLearningPath, decodePrerequisiteStatus, decodePublicCertificate,
  decodeSuggestion, learnerCourseStateLabel, missingReasonLabel, prerequisiteBlockMessage, readPrerequisiteLinks,
} = await import('./LearningDepthRules.ts');

const timestamp = (iso) => ({ toDate: () => new Date(iso) });

describe('prerequisites', () => {
  test('links and status decode leniently; the block message matches the server', () => {
    expect(readPrerequisiteLinks([{ courseId: 'a', title: 'Basics', required: true }, { nope: 1 }, 'x'])).toEqual([{ courseId: 'a', title: 'Basics', required: true }]);
    const status = decodePrerequisiteStatus({ links: [{ courseId: 'a', title: 'Basics', required: true, completed: false }], missingRequired: [{ courseId: 'a', title: 'Basics', required: true }] }, 'c');
    expect(status.missingRequired).toHaveLength(1);
    expect(status.missingRecommended).toEqual([]);
    expect(prerequisiteBlockMessage(status.missingRequired)).toBe('Complete "Basics" before you enroll in this course.');
    expect(prerequisiteBlockMessage([{ courseId: 'a', title: 'A', required: true }, { courseId: 'b', title: 'B', required: true }])).toBe('Complete "A" and "B" before you enroll in this course.');
    expect(prerequisiteBlockMessage([])).toBe('');
  });
});

describe('paths and suggestions', () => {
  test('a path keeps its order, known states and the reason for the next course', () => {
    const path = decodeLearningPath({
      id: 'p', title: 'Web', courses: [{ courseId: 'a', title: 'A', available: true }, { courseId: 'b', title: 'B', available: false }],
      progress: { steps: [{ courseId: 'a', state: 'completed', progress: 100 }, { courseId: 'b', state: 'weird' }], percent: 140, nextCourseId: '', nextReason: 'Done' },
    });
    expect(path.courses.map((course) => course.courseId)).toEqual(['a', 'b']);
    expect(path.progress.steps).toHaveLength(1);
    expect(path.progress.percent).toBe(100);
    expect(path.progress.nextCourseId).toBeNull();
    expect(decodeLearningPath({ title: 'No id' })).toBeNull();
    expect(learnerCourseStateLabel('unavailable')).toBe('No longer available');
  });

  test('a suggestion is never shown without its reason', () => {
    expect(decodeSuggestion({ courseId: 'c', title: 'C', reasons: [{ kind: 'same_category', text: 'Same topic (Art) as "A", which you completed.' }] }).reasons).toHaveLength(1);
    expect(decodeSuggestion({ courseId: 'c', title: 'C', reasons: [] })).toBeNull();
  });
});

describe('certificates', () => {
  test('the public record has only safe fields; dates from Timestamps or ISO strings', () => {
    const decoded = decodePublicCertificate('OLC-ABCD-EFGH-JKMN', { courseTitle: 'Basics', status: 'revoked', userId: 'nope', completedAt: timestamp('2026-11-01T00:00:00.000Z'), issuedAt: '2026-11-02T00:00:00.000Z' });
    expect(decoded.status).toBe('revoked');
    expect(decoded.completedAt).toBe('2026-11-01T00:00:00.000Z');
    expect(decoded.issuedAt).toBe('2026-11-02T00:00:00.000Z');
    expect('userId' in decoded).toBe(false);
    expect(CERTIFICATE_LABEL).toBe('Ourlime course completion — not an accredited qualification');
    expect(certificateWebLink('OLC-ABCD-EFGH-JKMN')).toBe('https://ourlime.com/eLearning/certificates/OLC-ABCD-EFGH-JKMN');
  });

  test('a minor never shows a full name; an invalid code is refused', () => {
    const minor = decodeCertificate('id', { verificationCode: 'OLC-ABCD-EFGH-JKMN', isMinor: true, nameDisplay: 'name', showOnProfile: true });
    expect(minor.nameDisplay).toBe('short');
    expect(minor.showOnProfile).toBe(true);
    expect(decodeCertificate('id', { code: 'OLC-0000-0000-0000' })).toBeNull();
    expect(decodeCertificate('id', { code: 'OLC-ABCD-EFGH-JKMN', id: 'server-id' }).id).toBe('server-id');
  });

  test('eligibility keeps known reasons only', () => {
    const eligibility = decodeEligibility({ eligible: false, requiredCount: 3, completedCount: 1, missing: [{ lessonId: 'q', title: 'Quiz', reason: 'quiz_not_attempted' }, { lessonId: 'x', reason: 'odd' }] });
    expect(eligibility.missing).toEqual([{ lessonId: 'q', title: 'Quiz', reason: 'quiz_not_attempted' }]);
    expect(missingReasonLabel('assignment_not_submitted')).toBe('Hand it in');
  });
});
