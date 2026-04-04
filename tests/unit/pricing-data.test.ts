import { describe, it, expect, beforeEach } from 'vitest';
import { loadBrowserScript } from './helpers';

describe('Pricing Data', () => {
  beforeEach(() => {
    loadBrowserScript('js/pricing-data.js');
  });

  it('PRICING is defined with plans', () => {
    expect((window as any).PRICING).toBeDefined();
    expect((window as any).PRICING.plans).toBeDefined();
  });

  it('starter: 149€/mo, 129€/yr, 340 min', () => {
    const s = (window as any).PRICING.plans.starter;
    expect(s.monthly).toBe(149);
    expect(s.yearly).toBe(129);
    expect(s.minutes).toBe(340);
  });

  it('professional: 299€/mo, 249€/yr, 560 min', () => {
    const p = (window as any).PRICING.plans.professional;
    expect(p.monthly).toBe(299);
    expect(p.yearly).toBe(249);
    expect(p.minutes).toBe(560);
  });

  it('yearly is always cheaper than monthly', () => {
    const { plans } = (window as any).PRICING;
    expect(plans.starter.yearly).toBeLessThan(plans.starter.monthly);
    expect(plans.professional.yearly).toBeLessThan(plans.professional.monthly);
  });

  it('overage is 0.39€/min', () => {
    expect((window as any).PRICING.plans.starter.overage).toBe(0.39);
  });
});
