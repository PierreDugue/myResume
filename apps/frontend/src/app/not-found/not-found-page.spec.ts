import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { fakePageAccess } from '../layout/testing/fake-page-access';
import { NotFoundPage } from './not-found-page';

describe('NotFoundPage', () => {
  async function render(disabled: Parameters<typeof fakePageAccess>[0] = []) {
    TestBed.configureTestingModule({ providers: [provideRouter([]), fakePageAccess(disabled)] });
    const fixture = TestBed.createComponent(NotFoundPage);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('offers a way back to the home page', async () => {
    const el = await render();
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/');
  });

  it('sends the viewer to the first page they can see when the home page is hidden', async () => {
    const el = await render(['overview', 'explore']);
    expect(el.querySelector('a')?.getAttribute('href')).toBe('/traces');
  });
});
