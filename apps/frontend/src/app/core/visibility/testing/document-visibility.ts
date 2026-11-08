/** jsdom's tab is always visible: this fakes the Page Visibility API for a test. */
export function setDocumentVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state });
  document.dispatchEvent(new Event('visibilitychange'));
}

/** Removes the fake, so the other tests see the real "visible" state again. */
export function resetDocumentVisibility(): void {
  delete (document as { visibilityState?: unknown }).visibilityState;
}
