import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { AuthUser } from '@my-resume/api-models';
import { Observable, of, throwError } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { AdminHomePage } from './admin-home-page';
import { $ } from '../../testing';

describe('AdminHomePage', () => {
  const logout = vi.fn();
  let me: () => Observable<AuthUser>;

  async function render() {
    TestBed.configureTestingModule({
      imports: [AdminHomePage],
      providers: [
        provideRouter([]),
        { provide: AuthService, useValue: { me: () => me(), logout } },
      ],
    });
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(AdminHomePage);
    await fixture.whenStable();
    return { fixture, el: fixture.nativeElement as HTMLElement, navigate };
  }

  beforeEach(() => {
    logout.mockReset();
    me = () => of({ id: 'admin-id', email: 'pierre@example.com' });
  });

  it('shows who is signed in (from the API)', async () => {
    const { el } = await render();
    expect(el.textContent).toContain('pierre@example.com');
  });

  it('lists the content sections coming next', async () => {
    const { el } = await render();
    for (const section of ['Profile', 'Experience', 'Skills', 'Projects', 'Education']) {
      expect(el.textContent).toContain(section);
    }
  });

  it('signs out and returns to the home dashboard', async () => {
    const { el, navigate } = await render();
    $<HTMLButtonElement>(el, 'button.sign-out').click();
    expect(logout).toHaveBeenCalledOnce();
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('still renders when the profile cannot be loaded', async () => {
    me = () => throwError(() => new Error('offline'));
    const { el } = await render();
    expect(el.querySelector('button.sign-out')).not.toBeNull();
  });
});
