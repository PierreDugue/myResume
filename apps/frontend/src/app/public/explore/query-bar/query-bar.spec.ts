import { TestBed } from '@angular/core/testing';
import { $ } from '../../../testing';
import { LABELS_FIXTURE } from '../testing/logs-fixture';
import { QueryBar } from './query-bar';

describe('QueryBar', () => {
  async function render(value = '') {
    const fixture = TestBed.createComponent(QueryBar);
    fixture.componentRef.setInput('value', value);
    fixture.componentRef.setInput('labels', LABELS_FIXTURE);
    const run = vi.fn();
    fixture.componentInstance.run.subscribe(run);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const input = $<HTMLInputElement>(el, 'input[role="combobox"]');
    const stable = () => fixture.whenStable();
    /** Types `text` with the cursor at the end (or at `cursor`). */
    const typeText = async (text: string, cursor = text.length) => {
      input.value = text;
      input.setSelectionRange(cursor, cursor);
      input.dispatchEvent(new Event('input'));
      await stable();
    };
    const key = async (name: string) => {
      input.dispatchEvent(new KeyboardEvent('keydown', { key: name, cancelable: true }));
      await stable();
    };
    const options = () =>
      [...el.querySelectorAll('[role="option"]')].map((o) => o.textContent?.trim());
    return { fixture, el, input, run, typeText, key, options, stable };
  }

  it('shows the current query, labelled for screen readers', async () => {
    const { el, input } = await render('{type="education"}');
    expect(input.value).toBe('{type="education"}');
    expect(el.querySelector(`label[for="${input.id}"]`)?.textContent).toContain('Query');
  });

  it('runs the query on Enter and with the Run query button', async () => {
    const { el, run, typeText, key } = await render();
    await typeText('|= "angular"');
    await key('Enter');
    expect(run).toHaveBeenLastCalledWith('|= "angular"');

    $<HTMLButtonElement>(el, 'button[type="submit"]').click();
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('checks the query before running it, and points at the problem', async () => {
    const { el, run, typeText, key, input } = await render();
    await typeText('{company "KX"}');
    await key('Enter');
    expect(run).not.toHaveBeenCalled();
    expect($(el, '[role="alert"]').textContent).toContain(
      'Expected "=", "!=", "=~" or "!~" after "company" (column 10)',
    );
    expect(input.getAttribute('aria-invalid')).toBe('true');

    await typeText('{company="KX"}');
    expect(el.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows an error from the server', async () => {
    const { fixture, el } = await render();
    fixture.componentRef.setInput('error', 'Regular expression not allowed (column 4)');
    await fixture.whenStable();
    expect($(el, '[role="alert"]').textContent).toContain('Regular expression not allowed');
  });

  describe('autocomplete', () => {
    it('suggests label names, then their values', async () => {
      const { input, typeText, key, options } = await render();
      await typeText('{co');
      expect(input.getAttribute('aria-expanded')).toBe('true');
      expect(options()).toEqual(['company']);

      await key('ArrowDown');
      await key('Enter');
      expect(input.value).toBe('{company="');
      expect(options()).toEqual(['KX', 'Whoz']);

      await key('ArrowDown');
      await key('ArrowDown');
      expect(input.getAttribute('aria-activedescendant')).toBe('query-option-1');
      await key('Enter');
      expect(input.value).toBe('{company="Whoz"');
      expect(input.selectionStart).toBe(15);
    });

    it('accepts a suggestion with a click or Tab', async () => {
      const { el, input, typeText, key } = await render();
      await typeText('{tech="n');
      $(el, '[role="option"]').dispatchEvent(new MouseEvent('mousedown', { cancelable: true }));
      await key('noop');
      expect(input.value).toBe('{tech="NX"');

      await typeText('{le');
      await key('Tab');
      expect(input.value).toBe('{level="');
    });

    it('closes with Escape, and Enter then runs the query', async () => {
      const { input, run, typeText, key, options } = await render();
      await typeText('{type="e');
      expect(options()).toEqual(['education', 'experience']);
      await key('Escape');
      expect(input.getAttribute('aria-expanded')).toBe('false');
      expect(options()).toEqual([]);
      await key('Enter');
      expect(run).not.toHaveBeenCalled(); // still invalid: the string isn't closed
    });

    it('suggests nothing outside the label selector', async () => {
      const { input, typeText, options } = await render();
      await typeText('angular');
      expect(options()).toEqual([]);
      expect(input.getAttribute('aria-expanded')).toBe('false');
    });
  });

  it('follows a new value from outside (e.g. the URL)', async () => {
    const { fixture, input } = await render('a');
    fixture.componentRef.setInput('value', '{company="KX"}');
    await fixture.whenStable();
    expect(input.value).toBe('{company="KX"}');
  });
});
