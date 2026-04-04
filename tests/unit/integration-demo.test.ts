import { describe, it, expect, beforeEach } from 'vitest';
import { loadBrowserScript } from './helpers';

describe('IntegrationDemo', () => {
  beforeEach(() => {
    try { window.localStorage.clear(); } catch { /* jsdom quirk */ }
    (window as any).showToast = () => {};
    if (!globalThis.crypto?.randomUUID) {
      Object.defineProperty(globalThis, 'crypto', {
        value: { randomUUID: () => Math.random().toString(36).slice(2) },
        writable: true, configurable: true,
      });
    }
    loadBrowserScript('js/integration-demo.js');
  });

  it('toggle() switches state', () => {
    // Mock localStorage
    const store: Record<string, string> = {};
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: (k: string) => store[k] || null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; }, clear: () => {} },
      writable: true, configurable: true,
    });
    loadBrowserScript('js/integration-demo.js');
    const d = (window as any).IntegrationDemo;
    expect(d.isEnabled()).toBe(false);
    d.toggle();
    expect(d.isEnabled()).toBe(true);
  });

  it('getMockCalls returns correct count', () => {
    const calls = (window as any).IntegrationDemo.getMockCalls(5);
    expect(calls).toHaveLength(5);
    expect(calls[0]).toHaveProperty('outcome');
  });

  it('getMockLeads returns leads with value', () => {
    const leads = (window as any).IntegrationDemo.getMockLeads(4);
    expect(leads).toHaveLength(4);
    expect(leads[0].value).toBeGreaterThan(0);
  });

  it('simulateSync returns success', () => {
    const r = (window as any).IntegrationDemo.simulateSync('hubspot');
    expect(r.success).toBe(true);
    expect(r.provider).toBe('hubspot');
  });
});
