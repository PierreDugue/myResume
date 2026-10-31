import { Controller, ExecutionContext, Get, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PageEnabledGuard } from './page-enabled.guard';
import { PreferencesService } from './preferences.service';
import { PublicPage } from './public-page.decorator';

@PublicPage('explore')
@Controller('gated')
class GatedController {
  @Get()
  read() {
    return 'ok';
  }
}

@Controller('free')
class FreeController {
  @Get()
  read() {
    return 'ok';
  }
}

function contextFor(
  controller: new () => object,
  request: { user?: object } = {},
): ExecutionContext {
  return {
    getClass: () => controller,
    getHandler: () => controller.prototype.read,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('PageEnabledGuard', () => {
  const isPageEnabled = vi.fn<(id: string) => Promise<boolean>>();
  const guard = new PageEnabledGuard(new Reflector(), {
    isPageEnabled,
  } as unknown as PreferencesService);

  beforeEach(() => isPageEnabled.mockReset());

  it('lets a route that is not a public page through, without reading the preferences', async () => {
    await expect(guard.canActivate(contextFor(FreeController))).resolves.toBe(true);
    expect(isPageEnabled).not.toHaveBeenCalled();
  });

  it('lets the admin (verified token) preview a disabled page, without reading the preferences', async () => {
    isPageEnabled.mockResolvedValue(false);
    const context = contextFor(GatedController, { user: { sub: 'admin', email: 'a@b.c' } });
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(isPageEnabled).not.toHaveBeenCalled();
  });

  it('lets visitors through while the page is enabled', async () => {
    isPageEnabled.mockResolvedValue(true);
    await expect(guard.canActivate(contextFor(GatedController))).resolves.toBe(true);
    expect(isPageEnabled).toHaveBeenCalledWith('explore');
  });

  it('answers visitors 404 "This page is disabled" while the page is disabled', async () => {
    isPageEnabled.mockResolvedValue(false);
    const result = guard.canActivate(contextFor(GatedController));
    await expect(result).rejects.toBeInstanceOf(NotFoundException);
    await expect(result).rejects.toThrow('This page is disabled');
    expect(isPageEnabled).toHaveBeenCalledWith('explore');
  });
});
