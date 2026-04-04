import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadBrowserScript } from './helpers';

// Mock localStorage globally for this test file
const store: Record<string, string> = {};
const mockStorage = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k in store) delete store[k]; },
  get length() { return Object.keys(store).length; },
  key: (i: number) => Object.keys(store)[i] ?? null,
};

describe('InstallPrompt', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', { value: mockStorage, writable: true, configurable: true });
    mockStorage.clear();
    document.body.innerHTML = '';
    (window as any).showToast = vi.fn();
    loadBrowserScript('js/install-prompt.js');
  });

  it('exposes InstallPrompt on window', () => {
    expect((window as any).InstallPrompt).toBeDefined();
  });

  it('dismiss() sets localStorage flag and removes banner', () => {
    const b = document.createElement('div');
    b.id = 'install-banner';
    document.body.appendChild(b);
    (window as any).InstallPrompt.dismiss();
    expect(document.getElementById('install-banner')).toBeNull();
    expect(store['clana_install_dismissed']).toBe('1');
  });

  it('_showBanner creates element', () => {
    (window as any).InstallPrompt._showBanner();
    expect(document.getElementById('install-banner')).toBeTruthy();
  });

  it('no duplicate banners', () => {
    (window as any).InstallPrompt._showBanner();
    (window as any).InstallPrompt._showBanner();
    expect(document.querySelectorAll('#install-banner').length).toBe(1);
  });
});
