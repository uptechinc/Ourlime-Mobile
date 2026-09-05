import { expect, mock, test } from 'bun:test';

let written = '';
mock.module('expo-file-system/legacy', () => ({
  documentDirectory: 'file:///test-documents/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: async (_path, contents) => { written = contents; },
  createUploadTask: () => ({ uploadAsync: async () => ({ status: 200 }), cancelAsync: async () => {} }),
  FileSystemUploadType: { BINARY_CONTENT: 1 },
}));
const { ErrorLogService } = await import('./ErrorLogService.ts');

test('export retains structured application failures even when the stack contains Firebase', async () => {
  const originalError = console.error;
  const originalWarn = console.warn;
  console.error = () => {};
  console.warn = () => {};
  const service = ErrorLogService.getInstance();
  try {
    service.install();
    console.error('[Ourlime.Mobile][ERROR][PostService][create:error] {"message":"Upload denied","stack":"node_modules/@firebase/storage"}');
    console.warn('[Ourlime.Mobile][WARN][PostMediaService] @firebase/storage failed');
    console.warn('@firebase/firestore WebChannelConnection transport errored');
    await new Promise((resolve) => setTimeout(resolve, 950));
    expect(written).toContain('Upload denied');
    expect(written).toContain('[PostMediaService]');
    expect(written).not.toContain('WebChannelConnection');
  } finally {
    console.error = originalError;
    console.warn = originalWarn;
  }
});
