export function isProjectEditorPath(pathname: string): boolean {
  return /^\/cloud\/projects\/[^/]+$/.test(pathname);
}
