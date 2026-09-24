/**
 * Determines appropriate MIME content-type based on file extension or key name.
 */
export function getMimeType(key: string): string {
  const lower = key.toLowerCase();
  if (lower.endsWith('.svg')) {
    return 'image/svg+xml';
  }
  if (lower.endsWith('.png')) {
    return 'image/png';
  }
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (lower.endsWith('.webp')) {
    return 'image/webp';
  }
  if (lower.endsWith('.html')) {
    return 'text/html; charset=utf-8';
  }
  return 'application/octet-stream';
}
