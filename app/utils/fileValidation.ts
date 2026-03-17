export function isAcceptedFileType(file: Pick<File, 'type'>): boolean {
  if (file.type === '') return true; // empty = unknown MIME, let server decide
  return file.type.startsWith('video/') || file.type.startsWith('audio/');
}
