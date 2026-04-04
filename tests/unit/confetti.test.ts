import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadBrowserScript } from './helpers';

describe('Confetti', () => {
  beforeEach(() => {
    const mockCtx = {
      clearRect: vi.fn(), save: vi.fn(), restore: vi.fn(),
      translate: vi.fn(), rotate: vi.fn(), fillRect: vi.fn(),
      fillStyle: '', globalAlpha: 1,
    };
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockCtx) as any;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
    document.body.innerHTML = '';
    loadBrowserScript('js/confetti.js');
  });

  it('exposes Confetti.fire on window', () => {
    expect((window as any).Confetti).toBeDefined();
    expect(typeof (window as any).Confetti.fire).toBe('function');
  });

  it('fire() creates canvas element', () => {
    (window as any).Confetti.fire(100);
    const canvas = document.querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas?.style.position).toBe('fixed');
  });
});
