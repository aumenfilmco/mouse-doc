import { useState } from 'react';

export type UploadStatus = 'idle' | 'uploading' | 'complete' | 'error';

export interface UseFileUploadResult {
  upload: (file: File) => Promise<string | null>;
  progress: number;
  status: UploadStatus;
  error: string | null;
  reset: () => void;
}

interface UploadCallbacks {
  onProgress: (percent: number) => void;
  onComplete: (fileKey: string) => void;
  onError: (message: string) => void;
}

/**
 * Core upload logic extracted as a standalone async function for testability.
 * useFileUpload wraps this with React state.
 */
export async function performUpload(
  file: File,
  callbacks: UploadCallbacks
): Promise<string | null> {
  const { onProgress, onComplete, onError } = callbacks;

  // Step 1: Get presigned URL from server
  let uploadUrl: string;
  let fileKey: string;

  try {
    const res = await fetch('/api/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, contentType: file.type }),
    });

    if (!res.ok) throw new Error('Presign failed');
    ({ uploadUrl, fileKey } = await res.json());
  } catch {
    onError('Upload failed. Check your connection and try again.');
    return null;
  }

  // Step 2: PUT to R2 via XHR (not fetch — needed for upload.onprogress)
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener('progress', (e: ProgressEvent) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      // IMPORTANT: onerror does NOT fire for HTTP errors — check status here
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        onComplete(fileKey);
        resolve(fileKey);
      } else {
        onError('Upload failed. Check your connection and try again.');
        resolve(null);
      }
    });

    xhr.addEventListener('error', () => {
      onError("Connection lost. Your file wasn't uploaded — try again when you're back online.");
      resolve(null);
    });

    xhr.open('PUT', uploadUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}

export function useFileUpload(): UseFileUploadResult {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<UploadStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setProgress(0);
    setStatus('idle');
    setError(null);
  };

  const upload = async (file: File): Promise<string | null> => {
    setStatus('uploading');
    setProgress(0);
    setError(null);

    return performUpload(file, {
      onProgress: (percent) => setProgress(percent),
      onComplete: (_fileKey) => {
        setProgress(100);
        setStatus('complete');
      },
      onError: (message) => {
        setStatus('error');
        setError(message);
      },
    });
  };

  return { upload, progress, status, error, reset };
}
