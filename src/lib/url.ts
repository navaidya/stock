const BASE = import.meta.env.BASE_URL ?? '/';

/** Build an internal link that survives the /stock base path on GitHub Pages.
 *  Hardcoded root-relative hrefs work in dev and 404 in production. */
export function withBase(path: string): string {
  const base = BASE.endsWith('/') ? BASE.slice(0, -1) : BASE;
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}` || '/';
}
