import { TestBed } from '@angular/core/testing';
import type { CareerStatus } from '@my-resume/api-models';
import { $ } from '../../../../testing';
import { dashboardFixture } from '../../testing/dashboard-fixture';
import { ProfilePanel } from './profile-panel';

describe('ProfilePanel', () => {
  async function render(
    status: CareerStatus = dashboardFixture().status,
    avatarUrl: string | null = null,
  ) {
    const fixture = TestBed.createComponent(ProfilePanel);
    const profile = dashboardFixture().profile;
    fixture.componentRef.setInput('profile', profile ? { ...profile, avatarUrl } : null);
    fixture.componentRef.setInput('status', status);
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows name, headline, location, summary and links', async () => {
    const el = await render();
    expect($(el, 'h3').textContent?.trim()).toBe('Pierre Dugue');
    expect(el.textContent).toContain('Senior Front-End Engineer');
    expect(el.textContent).toContain('Nice, France');
    expect(el.textContent).toContain('Summary text.');
    expect($(el, 'a[href="https://www.linkedin.com/in/example"]').textContent).toContain(
      'LinkedIn',
    );
  });

  it('shows the current status in words', async () => {
    expect($(await render(), '.status').textContent).toContain('Employed at Whoz');
    TestBed.resetTestingModule();
    const open = await render({ state: 'open-to-work', company: null, openToRelocation: true });
    expect($(open, '.status').textContent).toContain('Open to work');
    expect(open.textContent).toContain('open to relocation');
  });

  it('shows the photo with a text alternative when there is one', async () => {
    const el = await render(undefined, 'https://example.com/me.jpg');
    expect($(el, 'img').getAttribute('alt')).toBe('Pierre Dugue');
  });
});
