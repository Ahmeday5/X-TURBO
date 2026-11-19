/** Copies `text`; resolves `false` when the browser refuses (no permission / insecure origin). */
export function copyToClipboard(text: string): Promise<boolean> {
  if (!navigator.clipboard?.writeText) return Promise.resolve(false);
  return navigator.clipboard.writeText(text).then(
    () => true,
    () => false,
  );
}
