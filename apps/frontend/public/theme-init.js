// Apply the saved theme before Angular starts, to avoid a flash of the wrong theme.
// A separate file (not an inline script) so the Content-Security-Policy can forbid inline scripts.
try {
  if (localStorage.getItem('theme') === 'light') {
    document.documentElement.setAttribute('data-theme', 'light');
  }
} catch {
  // Storage unavailable: keep the default (dark) theme.
}
