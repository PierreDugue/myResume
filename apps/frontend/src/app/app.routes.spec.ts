import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Title } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { appRoutes } from './app.routes';
import { APP_NAME } from './core/app-name';
import { providePageTitleStrategy } from './core/title/page-title.strategy';

describe('appRoutes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(appRoutes),
        provideHttpClient(),
        provideHttpClientTesting(),
        providePageTitleStrategy(),
      ],
    });
  });

  async function visit(url: string) {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(url);
    harness.detectChanges();
    return harness.fixture.nativeElement as HTMLElement;
  }

  it.each([
    ['/', 'Career Overview', 'app-overview-page'],
    ['/resume', 'Plain view', 'app-plain-resume-page'],
    ['/this/does/not/exist', 'Page not found', 'app-not-found-page'],
  ])('%s renders "%s" inside the app shell', async (url, title, pageSelector) => {
    const root = await visit(url);
    expect(root.querySelector('app-shell')).not.toBeNull();
    expect(root.querySelector(`app-shell main ${pageSelector}`)).not.toBeNull();
    expect(root.querySelector('nav[aria-label="Breadcrumb"] h1')?.textContent).toContain(title);
    expect(TestBed.inject(Title).getTitle()).toBe(`${title} · ${APP_NAME}`);
  });

  it('offers a link back to the home dashboard on the not-found page', async () => {
    const root = await visit('/nope');
    expect(root.querySelector('app-not-found-page a')?.getAttribute('href')).toBe('/');
  });
});
