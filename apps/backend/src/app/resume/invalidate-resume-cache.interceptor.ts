import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import type { Request } from 'express';
import { Observable, catchError, concatMap, from, map, throwError } from 'rxjs';
import { ResumeCache } from './resume-cache';

/**
 * Put on every controller that writes resume content (`@UseInterceptors` at class level): any
 * request other than GET or HEAD clears the cached resume once its handler is done, whether it
 * succeeded or failed (a failed write may still have changed something), and before the response
 * is sent, so the admin's next read sees the change even with a remote cache store. Requests
 * refused before the handler (401, 400 from validation) never reach the database, so they don't
 * clear it.
 */
@Injectable()
export class InvalidateResumeCacheInterceptor implements NestInterceptor {
  constructor(private readonly cache: ResumeCache) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const { method } = context.switchToHttp().getRequest<Request>();
    if (method === 'GET' || method === 'HEAD') return next.handle();
    const invalidate = () => from(this.cache.invalidate());
    return next.handle().pipe(
      concatMap((body: unknown) => invalidate().pipe(map(() => body))),
      catchError((error: unknown) => invalidate().pipe(concatMap(() => throwError(() => error)))),
    );
  }
}
