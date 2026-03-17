import { isAcceptedFileType } from '@/app/utils/fileValidation';

describe('isAcceptedFileType', () => {
  it('returns true for video/mp4', () => {
    expect(isAcceptedFileType({ type: 'video/mp4' })).toBe(true);
  });

  it('returns true for video/quicktime', () => {
    expect(isAcceptedFileType({ type: 'video/quicktime' })).toBe(true);
  });

  it('returns true for audio/mpeg', () => {
    expect(isAcceptedFileType({ type: 'audio/mpeg' })).toBe(true);
  });

  it('returns true for audio/wav', () => {
    expect(isAcceptedFileType({ type: 'audio/wav' })).toBe(true);
  });

  it('returns false for application/pdf', () => {
    expect(isAcceptedFileType({ type: 'application/pdf' })).toBe(false);
  });

  it('returns false for image/jpeg', () => {
    expect(isAcceptedFileType({ type: 'image/jpeg' })).toBe(false);
  });

  it('returns false for text/plain', () => {
    expect(isAcceptedFileType({ type: 'text/plain' })).toBe(false);
  });

  it('returns true for empty string type (let server validate)', () => {
    expect(isAcceptedFileType({ type: '' })).toBe(true);
  });
});
