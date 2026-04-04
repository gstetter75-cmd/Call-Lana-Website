import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import fs from 'fs';
import path from 'path';

const code = fs.readFileSync(path.resolve(__dirname, '../../js/offline-cache.js'), 'utf-8');

describe('OfflineCache', () => {
  beforeEach(async () => {
    (window as any).OfflineCache = undefined;
    eval(code);
    await (window as any).OfflineCache.init();
  });

  it('init() opens IndexedDB', async () => {
    expect((window as any).OfflineCache._db).toBeTruthy();
  });

  it('cacheCalls and getCachedCalls round-trip', async () => {
    const cache = (window as any).OfflineCache;
    const calls = [
      { id: '1', phone: '+49123', duration: 60 },
      { id: '2', phone: '+49456', duration: 120 },
    ];
    await cache.cacheCalls(calls);
    const result = await cache.getCachedCalls();
    expect(result).toHaveLength(2);
    expect(result[0].id).toBe('1');
  });

  it('cacheAppointments and getCachedAppointments round-trip', async () => {
    const cache = (window as any).OfflineCache;
    const appts = [{ id: 'a1', title: 'Meeting', date: '2026-04-01' }];
    await cache.cacheAppointments(appts);
    const result = await cache.getCachedAppointments();
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Meeting');
  });

  it('cacheProfile and getCachedProfile round-trip', async () => {
    const cache = (window as any).OfflineCache;
    await cache.cacheProfile({ id: 'u1', name: 'Gero', email: 'test@test.de' });
    const profile = await cache.getCachedProfile();
    expect(profile).toBeTruthy();
    expect(profile.name).toBe('Gero');
  });

  it('cacheCalls limits to 50 entries', async () => {
    const cache = (window as any).OfflineCache;
    const calls = Array.from({ length: 60 }, (_, i) => ({ id: `c${i}`, phone: '+49' }));
    await cache.cacheCalls(calls);
    const result = await cache.getCachedCalls();
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it('isFresh returns false for uncached key', async () => {
    const fresh = await (window as any).OfflineCache.isFresh('nonexistent_key');
    expect(fresh).toBe(false);
  });
});
