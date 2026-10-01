const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function harness() {
  const user = (uid) => ({ uid, emailVerified: true, getIdToken: async () => `session_${uid}` });
  const auth = { currentUser: user('one'), app: { options: { projectId: 'demo-test' } } };
  const nativeAuth = { currentUser: null }; const requests = []; const signIns = []; let callback;
  const dependencies = {
    'firebase/auth': { onIdTokenChanged: (_auth, listener) => { callback = listener; listener(auth.currentUser); } },
    'react-native': { Platform: { OS: 'android' } }, '@/lib/firebaseConfig': { auth },
    './NativeFirebaseEmulatorService': { nativeFirebaseEmulatorService: { connect: async () => {}, nativeSessionUrl: (projectId) => `https://example.test/${projectId}/nativeSession` } },
    '@react-native-firebase/auth': { getAuth: () => nativeAuth, signOut: async () => { nativeAuth.currentUser = null; }, signInWithCustomToken: async (_auth, token) => { signIns.push(token); nativeAuth.currentUser = { uid: token.split(':')[0] }; } },
  };
  const module = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/services/NativeSessionService.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(source, { module, exports: module.exports, require: (name) => { if (!(name in dependencies)) throw new Error(name); return dependencies[name]; }, AbortController, setTimeout, clearTimeout,
    fetch: async (_url, options) => new Promise((resolve) => requests.push({ options, resolve: (token, ok = true) => resolve({ ok, json: async () => ({ token }) }) })),
  });
  const settle = () => new Promise((resolve) => setImmediate(resolve));
  return { service: module.exports.nativeSessionService, auth, nativeAuth, requests, signIns, settle, switchAccount: (uid) => { auth.currentUser = uid ? user(uid) : null; callback(auth.currentUser); } };
}

test('native session waits for current preview authorization when UID stays the same', async () => {
  const state = harness(); let finished = false;
  const pending = state.service.ensure('one').then(() => { finished = true; });
  await state.settle(); assert.equal(state.requests.length, 1);
  state.service.setPreview('/market');
  assert.equal(state.requests[0].options.signal.aborted, true);
  state.requests[0].resolve('one:old'); await state.settle();
  assert.equal(state.requests.length, 2); assert.equal(finished, false);
  assert.equal(state.requests[1].options.headers['X-Ourlime-Preview'], '/market');
  state.requests[1].resolve('one:preview'); await pending;
  assert.deepEqual(state.signIns, ['one:preview']);
});

test('logout during hydration cannot install an old native session', async () => {
  const state = harness(); const pending = state.service.ensure('one');
  const rejected = assert.rejects(pending, /account changed|sign-in is unavailable/);
  await state.settle(); state.switchAccount(null); state.requests[0].resolve('one:old');
  await rejected; await state.settle();
  assert.equal(state.nativeAuth.currentUser, null); assert.deepEqual(state.signIns, []);
});

test('account switch cancels old work and authenticates only the new UID', async () => {
  const state = harness(); const first = state.service.ensure('one'); const rejected = assert.rejects(first, /account changed|sign-in is unavailable/);
  await state.settle(); state.switchAccount('two');
  const second = state.service.ensure('two'); state.requests[0].resolve('one:old');
  await state.settle(); state.requests[1].resolve('two:current');
  await Promise.all([rejected, second]); assert.deepEqual(state.signIns, ['two:current']);
});

test('a rejected hosted session clears native authentication and propagates failure', async () => {
  const state = harness(); state.nativeAuth.currentUser = { uid: 'one' };
  const pending = state.service.ensure('one'); const rejected = assert.rejects(pending, /could not be verified/);
  await state.settle(); state.requests[0].resolve('', false); await rejected;
  assert.equal(state.nativeAuth.currentUser, null);
});
