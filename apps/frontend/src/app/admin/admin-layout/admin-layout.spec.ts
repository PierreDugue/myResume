import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AdminLayout } from './admin-layout';

@Component({ template: '<p>section</p>' })
class Section {}

describe('AdminLayout', () => {
  it('shows tabs for every content section, marking the current one', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'admin', component: AdminLayout, children: [{ path: '**', component: Section }] },
        ]),
      ],
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/admin/skills');
    harness.detectChanges();
    const el = harness.fixture.nativeElement as HTMLElement;

    const tabs = [...el.querySelectorAll<HTMLAnchorElement>('nav[aria-label="Admin sections"] a')];
    expect(tabs.map((a) => [a.textContent?.trim(), a.getAttribute('href')])).toEqual([
      ['Overview', '/admin'],
      ['Profile', '/admin/profile'],
      ['Skills', '/admin/skills'],
      ['Experience', '/admin/experiences'],
      ['Education', '/admin/education'],
      ['Projects', '/admin/projects'],
    ]);
    expect(tabs.find((a) => a.getAttribute('aria-current') === 'page')?.textContent?.trim()).toBe(
      'Skills',
    );
    expect(el.textContent).toContain('section');
  });
});
