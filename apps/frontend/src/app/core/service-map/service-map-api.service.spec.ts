import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { serviceMapFixture } from '../../public/service-map/testing/service-map-fixture';
import { ServiceMapApi } from './service-map-api.service';

describe('ServiceMapApi', () => {
  it('loads the graph with GET /api/service-map', async () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const http = TestBed.inject(HttpTestingController);
    const result = firstValueFrom(TestBed.inject(ServiceMapApi).get());
    http.expectOne('/api/service-map').flush(serviceMapFixture());
    expect((await result).nodes).toHaveLength(6);
    http.verify();
  });
});
