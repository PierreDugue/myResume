import { TestBed } from '@angular/core/testing';
import type { BundleSize } from '@my-resume/api-models';
import { $ } from '../../../../testing';
import { qualityFixture } from '../../testing/quality-fixture';
import { BundleBudget } from './bundle-budget';

async function render(bundle: BundleSize): Promise<HTMLElement> {
  const fixture = TestBed.createComponent(BundleBudget);
  fixture.componentRef.setInput('bundle', bundle);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
}

const full = (): BundleSize => qualityFixture().bundle as BundleSize;
const text = (el: Element) => el.textContent?.replace(/\s+/g, ' ').trim();

describe('BundleBudget', () => {
  it('states the initial size and both budgets in text', async () => {
    const el = await render(full());
    const pairs = [...el.querySelectorAll('dl div')].map((d) => [
      d.querySelector('dt')?.textContent,
      d.querySelector('dd')?.textContent,
    ]);
    expect(pairs).toEqual([
      ['Initial', '412.3 kB'],
      ['Warning budget', '500.0 kB'],
      ['Error budget', '1.0 MB'],
    ]);
  });

  it('says it is within the budget, with the room left', async () => {
    const el = await render(full());
    const status = $(el, '.status');
    expect(text(status)).toBe('Within budget: 87.7 kB below the warning budget');
    expect(status.classList.contains('ok')).toBe(true);
  });

  it('draws the size and the budget markers on a meter hidden from screen readers', async () => {
    const el = await render(full());
    expect($(el, '.meter').getAttribute('aria-hidden')).toBe('true');
    expect($(el, '.fill').style.width).toBe('41.2%');
    expect($(el, '.marker.warning').style.left).toBe('50%');
    expect($(el, '.marker.error').style.left).toBe('100%');
  });

  it('flags a size over the warning budget', async () => {
    const el = await render({ ...full(), initialBytes: 600000 });
    const status = $(el, '.status');
    expect(text(status)).toBe('Over the warning budget by 100.0 kB');
    expect(status.classList.contains('warn')).toBe(true);
    expect($(el, '.fill').classList.contains('warn')).toBe(true);
  });

  it('flags a size over the error budget, and scales the meter to it', async () => {
    const el = await render({ ...full(), initialBytes: 1_200_000 });
    const status = $(el, '.status');
    expect(text(status)).toBe('Over the error budget by 200.0 kB');
    expect(status.classList.contains('error')).toBe(true);
    expect($(el, '.fill').style.width).toBe('100%');
    expect($(el, '.marker.error').style.left).toBe('83.3%');
  });

  it('has no markers or verdict without budgets', async () => {
    const el = await render({
      ...full(),
      budgetWarningBytes: null,
      budgetErrorBytes: null,
    });
    expect(el.querySelector('.marker')).toBeNull();
    expect(text($(el, '.status'))).toBe('No budget set');
    expect($(el, '.fill').style.width).toBe('100%');
  });

  it('notes the lazy-loaded total', async () => {
    const el = await render(full());
    expect(text($(el, '.lazy'))).toBe('Lazy-loaded chunks: 1.2 MB in total, loaded on demand.');
  });
});
