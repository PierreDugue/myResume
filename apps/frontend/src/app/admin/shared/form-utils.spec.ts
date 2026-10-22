import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { applyEach, form, type SchemaFn } from '@angular/forms/signals';
import { endOnOrAfterStart, httpUrl, numberOrNull, showError, textOrNull } from './form-utils';

function makeForm<T>(value: T, rules: SchemaFn<T>) {
  const model = signal(value);
  const tree = TestBed.runInInjectionContext(() => form(model, rules));
  return { model, tree };
}

describe('form-utils', () => {
  describe('textOrNull', () => {
    it('trims text and turns empty text into null', () => {
      expect(textOrNull('  Paris ')).toBe('Paris');
      expect(textOrNull('   ')).toBeNull();
      expect(textOrNull(null)).toBeNull();
    });
  });

  describe('numberOrNull', () => {
    it('reads numbers from strings and numbers, and empty as null', () => {
      expect(numberOrNull('4')).toBe(4);
      expect(numberOrNull(12)).toBe(12);
      expect(numberOrNull('')).toBeNull();
      expect(numberOrNull(null)).toBeNull();
      expect(numberOrNull('abc')).toBeNull();
    });
  });

  describe('httpUrl', () => {
    it('accepts an empty value and http(s) URLs', () => {
      const { model, tree } = makeForm({ url: '' }, (p) => httpUrl(p.url));
      expect(tree.url().valid()).toBe(true);
      model.set({ url: 'https://example.com/a' });
      expect(tree.url().valid()).toBe(true);
      model.set({ url: 'http://example.com' });
      expect(tree.url().valid()).toBe(true);
    });

    it.each(['javascript:alert(1)', 'ftp://example.com', 'not a url'])(
      'rejects %s with a readable message',
      (url) => {
        const { tree } = makeForm({ url }, (p) => httpUrl(p.url));
        expect(tree.url().errors()).toEqual([
          expect.objectContaining({
            kind: 'httpUrl',
            message: 'Enter a URL starting with http:// or https://',
          }),
        ]);
      },
    );

    it('works on the items of a list', () => {
      const { tree } = makeForm({ links: [{ url: 'https://ok.dev' }, { url: 'nope' }] }, (p) =>
        applyEach(p.links, (link) => httpUrl(link.url)),
      );
      expect(tree.links[0].url().valid()).toBe(true);
      expect(tree.links[1].url().invalid()).toBe(true);
    });
  });

  describe('endOnOrAfterStart', () => {
    const make = (startDate: string, endDate: string) =>
      makeForm({ startDate, endDate }, (p) => endOnOrAfterStart(p.startDate, p.endDate));

    it('puts an error on the end date when it is before the start date', () => {
      const { tree } = make('2022-09-01', '2020-01-01');
      expect(tree.endDate().errors()).toEqual([
        expect.objectContaining({
          kind: 'endBeforeStart',
          message: 'The end date must be after the start date',
        }),
      ]);
      expect(tree.startDate().valid()).toBe(true);
    });

    it('accepts an empty end date, an empty start date and the same day', () => {
      expect(make('2022-09-01', '').tree.endDate().valid()).toBe(true);
      expect(make('', '2020-01-01').tree.endDate().valid()).toBe(true);
      expect(make('2022-09-01', '2022-09-01').tree.endDate().valid()).toBe(true);
    });

    it('re-checks when the start date changes', () => {
      const { model, tree } = make('2022-09-01', '2022-01-01');
      expect(tree.endDate().invalid()).toBe(true);
      model.update((m) => ({ ...m, startDate: '2021-01-01' }));
      expect(tree.endDate().valid()).toBe(true);
    });
  });

  describe('showError', () => {
    it('shows an error only for a touched, invalid field', () => {
      const { model, tree } = makeForm({ url: 'nope' }, (p) => httpUrl(p.url));
      expect(showError(tree.url())).toBe(false);
      tree.url().markAsTouched();
      expect(showError(tree.url())).toBe(true);
      model.set({ url: '' });
      expect(showError(tree.url())).toBe(false);
    });
  });
});
