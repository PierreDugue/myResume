import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { qualityFixture } from '../../public/quality/testing/quality-fixture';
import { QualityApi } from './quality-api.service';

describe('QualityApi', () => {
  let http: HttpTestingController;
  let api: QualityApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    api = TestBed.inject(QualityApi);
  });

  afterEach(() => http.verify());

  it('loads the report with GET /api/quality', async () => {
    const result = firstValueFrom(api.get());
    http.expectOne('/api/quality').flush(qualityFixture());
    expect((await result)?.tests.total.total).toBe(700);
  });

  it('maps a 404 (no report in this build) to null', async () => {
    const result = firstValueFrom(api.get());
    http
      .expectOne('/api/quality')
      .flush(
        { statusCode: 404, message: 'No quality report in this build', error: 'Not Found' },
        { status: 404, statusText: 'Not Found' },
      );
    expect(await result).toBeNull();
  });

  it('lets other errors through', async () => {
    const result = firstValueFrom(api.get());
    http.expectOne('/api/quality').flush('boom', { status: 500, statusText: 'Server Error' });
    await expect(result).rejects.toMatchObject({ status: 500 });
  });
});
