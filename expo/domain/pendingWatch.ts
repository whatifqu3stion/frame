const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
/** Keep only a canonical video id, never untrusted query metadata or cross-profile session context. */
export function pendingWatchId(path: string): string | null {
  const id = path.match(/^\/watch\/([^/?#]+)(?:[?#].*)?$/)?.[1];
  return id && VIDEO_ID.test(id) ? id : null;
}
