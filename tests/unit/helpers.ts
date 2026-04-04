import fs from 'fs';
import path from 'path';

// Load a browser JS file by wrapping declarations to assign to window
export function loadBrowserScript(relativePath: string): void {
  const code = fs.readFileSync(path.resolve(__dirname, '../../', relativePath), 'utf-8');
  // Replace top-level var/const/let declarations with window assignments
  const patched = code.replace(/^(var|const|let)\s+(\w+)\s*=/gm, 'window.$2 =');
  // Execute with window globals available
  const fn = new Function('window', 'document', 'localStorage', 'sessionStorage', 'navigator', patched);
  fn(window, document, window.localStorage, window.sessionStorage, window.navigator);
}
