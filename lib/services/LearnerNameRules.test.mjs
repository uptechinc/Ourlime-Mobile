import { describe, expect, test } from 'bun:test';
import { isStudentAccount, learnerPublicName, shortenName } from './LearnerNameRules.ts';

describe('learner names other learners see', () => {
  test('names shorten to a first name and last initial', () => {
    expect(shortenName('Maya Ramdial')).toBe('Maya R.');
    expect(shortenName('  Ana  de  souza ')).toBe('Ana S.');
    expect(shortenName('Kai')).toBe('Kai');
    expect(shortenName('   ')).toBe('');
  });

  test('student (minor) accounts never show a full name', () => {
    const student = { firstName: 'Maya', lastName: 'Ramdial', displayName: 'Maya Ramdial', accountType: 'student' };
    expect(isStudentAccount(student)).toBe(true);
    expect(learnerPublicName(student, 'Maya Ramdial')).toBe('Maya R.');
    expect(learnerPublicName({ accountType: 'Student' }, 'Jo Bloggs')).toBe('Jo B.');
    expect(learnerPublicName({ accountType: 'student' }, 'kid@example.test')).toBe('Learner');
  });

  test('adult accounts keep their display name, never an email', () => {
    expect(learnerPublicName({ firstName: 'Ravi', lastName: 'Singh', accountType: 'regular' }, 'ravi@example.test')).toBe('Ravi Singh');
    expect(learnerPublicName({ displayName: 'Dr. Ali' }, '')).toBe('Dr. Ali');
    expect(learnerPublicName({ userName: 'someone@example.test' }, '')).toBe('Learner');
  });

  test('an unreadable profile shortens the stored name because age is unknown', () => {
    expect(learnerPublicName(null, 'Maya Ramdial')).toBe('Maya R.');
    expect(learnerPublicName(undefined, 'kid@example.test')).toBe('Learner');
    expect(learnerPublicName(null, '')).toBe('Learner');
  });
});
