/** @jest-environment jsdom */

import { performUpload } from '@/app/hooks/useFileUpload';

// XHR mock setup
let xhrInstance: any;
const MockXHR = jest.fn().mockImplementation(() => {
  xhrInstance = {
    open: jest.fn(),
    send: jest.fn(),
    setRequestHeader: jest.fn(),
    upload: { addEventListener: jest.fn() },
    addEventListener: jest.fn(),
    status: 200,
  };
  return xhrInstance;
});
global.XMLHttpRequest = MockXHR as any;

// Helper to find a registered event listener on xhrInstance
function getXhrListener(event: string): (...args: any[]) => void {
  const calls = xhrInstance.addEventListener.mock.calls;
  const found = calls.find((call: any[]) => call[0] === event);
  if (!found) throw new Error(`No listener registered for xhr event: ${event}`);
  return found[1];
}

function getXhrUploadListener(event: string): (...args: any[]) => void {
  const calls = xhrInstance.upload.addEventListener.mock.calls;
  const found = calls.find((call: any[]) => call[0] === event);
  if (!found) throw new Error(`No listener registered for xhr.upload event: ${event}`);
  return found[1];
}

// Flush microtask queue (so fetch promise resolves and XHR is set up)
const flushMicrotasks = () => new Promise(resolve => setTimeout(resolve, 0));

const mockFile = {
  name: 'test-video.mp4',
  type: 'video/mp4',
  size: 1024 * 1024,
} as File;

beforeEach(() => {
  jest.clearAllMocks();
  (global.fetch as jest.Mock) = jest.fn();
});

describe('performUpload', () => {
  it('calls /api/upload/presign with filename and contentType', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ uploadUrl: 'https://r2.example.com/upload', fileKey: 'submissions/2026-03/abc-test.mp4' }),
    });

    const uploadPromise = performUpload(mockFile, {
      onProgress: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    });

    // Wait for fetch to resolve and XHR listeners to be registered
    await flushMicrotasks();

    // Simulate XHR load success
    xhrInstance.status = 200;
    getXhrListener('load')();

    await uploadPromise;

    expect(global.fetch).toHaveBeenCalledWith('/api/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: 'test-video.mp4', contentType: 'video/mp4' }),
    });
  });

  it('returns fileKey on successful upload', async () => {
    const fileKey = 'submissions/2026-03/abc-test.mp4';
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ uploadUrl: 'https://r2.example.com/upload', fileKey }),
    });

    const onComplete = jest.fn();
    const uploadPromise = performUpload(mockFile, {
      onProgress: jest.fn(),
      onComplete,
      onError: jest.fn(),
    });

    await flushMicrotasks();

    xhrInstance.status = 200;
    getXhrListener('load')();

    const result = await uploadPromise;
    expect(result).toBe(fileKey);
    expect(onComplete).toHaveBeenCalledWith(fileKey);
  });

  it('sets Content-Type header on XHR to file.type', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ uploadUrl: 'https://r2.example.com/upload', fileKey: 'submissions/2026-03/abc.mp4' }),
    });

    const uploadPromise = performUpload(mockFile, {
      onProgress: jest.fn(),
      onComplete: jest.fn(),
      onError: jest.fn(),
    });

    await flushMicrotasks();

    xhrInstance.status = 200;
    getXhrListener('load')();

    await uploadPromise;

    expect(xhrInstance.setRequestHeader).toHaveBeenCalledWith('Content-Type', 'video/mp4');
  });

  it('sets error state on presign failure (non-ok response)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Presign failed' }),
    });

    const onError = jest.fn();
    const result = await performUpload(mockFile, {
      onProgress: jest.fn(),
      onComplete: jest.fn(),
      onError,
    });

    expect(result).toBeNull();
    expect(onError).toHaveBeenCalledWith('Upload failed. Check your connection and try again.');
  });

  it('sets error state on presign fetch exception', async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

    const onError = jest.fn();
    const result = await performUpload(mockFile, {
      onProgress: jest.fn(),
      onComplete: jest.fn(),
      onError,
    });

    expect(result).toBeNull();
    expect(onError).toHaveBeenCalledWith('Upload failed. Check your connection and try again.');
  });

  it('sets error state on XHR non-2xx status (403)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ uploadUrl: 'https://r2.example.com/upload', fileKey: 'submissions/2026-03/abc.mp4' }),
    });

    const onError = jest.fn();
    const uploadPromise = performUpload(mockFile, {
      onProgress: jest.fn(),
      onComplete: jest.fn(),
      onError,
    });

    await flushMicrotasks();

    // Simulate 403 response in onload
    xhrInstance.status = 403;
    getXhrListener('load')();

    const result = await uploadPromise;
    expect(result).toBeNull();
    expect(onError).toHaveBeenCalledWith('Upload failed. Check your connection and try again.');
  });

  it('sets error state on XHR network failure (onerror)', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ uploadUrl: 'https://r2.example.com/upload', fileKey: 'submissions/2026-03/abc.mp4' }),
    });

    const onError = jest.fn();
    const uploadPromise = performUpload(mockFile, {
      onProgress: jest.fn(),
      onComplete: jest.fn(),
      onError,
    });

    await flushMicrotasks();

    // Simulate network-level error
    getXhrListener('error')();

    const result = await uploadPromise;
    expect(result).toBeNull();
    expect(onError).toHaveBeenCalledWith(
      "Connection lost. Your file wasn't uploaded — try again when you're back online."
    );
  });

  it('calls onProgress with 0-100 values during upload', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ uploadUrl: 'https://r2.example.com/upload', fileKey: 'submissions/2026-03/abc.mp4' }),
    });

    const onProgress = jest.fn();
    const uploadPromise = performUpload(mockFile, {
      onProgress,
      onComplete: jest.fn(),
      onError: jest.fn(),
    });

    await flushMicrotasks();

    // Simulate progress event at 50%
    const progressHandler = getXhrUploadListener('progress');
    progressHandler({ lengthComputable: true, loaded: 512 * 1024, total: 1024 * 1024 });

    // Simulate progress event at 100%
    progressHandler({ lengthComputable: true, loaded: 1024 * 1024, total: 1024 * 1024 });

    xhrInstance.status = 200;
    getXhrListener('load')();

    await uploadPromise;

    expect(onProgress).toHaveBeenCalledWith(50);
    expect(onProgress).toHaveBeenCalledWith(100);
  });
});
