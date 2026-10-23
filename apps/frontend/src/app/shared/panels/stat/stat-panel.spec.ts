import { TestBed } from '@angular/core/testing';
import { $ } from '../../../testing';
import { StatPanel } from './stat-panel';

describe('StatPanel', () => {
  it('shows the big value with its label and hint', async () => {
    const fixture = TestBed.createComponent(StatPanel);
    fixture.componentRef.setInput('label', 'Uptime');
    fixture.componentRef.setInput('display', 'since 2011');
    fixture.componentRef.setInput('hint', '15 years');
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect($(el, '.value').textContent?.trim()).toBe('since 2011');
    expect($(el, '.label').textContent?.trim()).toBe('Uptime');
    expect($(el, '.hint').textContent?.trim()).toBe('15 years');
  });

  it('has no hint element without a hint', async () => {
    const fixture = TestBed.createComponent(StatPanel);
    fixture.componentRef.setInput('label', 'Jobs');
    fixture.componentRef.setInput('display', '8');
    await fixture.whenStable();
    expect((fixture.nativeElement as HTMLElement).querySelector('.hint')).toBeNull();
  });
});
