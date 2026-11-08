import { TestBed } from '@angular/core/testing';
import { PageVisibility } from './page-visibility.service';
import { resetDocumentVisibility, setDocumentVisibility } from './testing/document-visibility';

describe('PageVisibility', () => {
  afterEach(() => resetDocumentVisibility());

  function watch(): { values: boolean[]; stop: () => void } {
    const values: boolean[] = [];
    const subscription = TestBed.inject(PageVisibility).visible$.subscribe((v) => values.push(v));
    return { values, stop: () => subscription.unsubscribe() };
  }

  it('starts with the current state: visible', () => {
    expect(watch().values).toEqual([true]);
  });

  it('starts with the current state: hidden', () => {
    setDocumentVisibility('hidden');
    expect(watch().values).toEqual([false]);
  });

  it('emits when the tab is hidden and shown again', () => {
    const { values } = watch();
    setDocumentVisibility('hidden');
    setDocumentVisibility('visible');
    expect(values).toEqual([true, false, true]);
  });

  it('emits only when the state changes', () => {
    const { values } = watch();
    setDocumentVisibility('visible');
    setDocumentVisibility('hidden');
    setDocumentVisibility('hidden');
    expect(values).toEqual([true, false]);
  });

  it('stops listening once unsubscribed', () => {
    const { values, stop } = watch();
    stop();
    setDocumentVisibility('hidden');
    expect(values).toEqual([true]);
  });

  it('gives each subscriber the current state first', () => {
    const service = TestBed.inject(PageVisibility);
    setDocumentVisibility('hidden');
    const late: boolean[] = [];
    service.visible$.subscribe((v) => late.push(v));
    expect(late).toEqual([false]);
  });
});
