import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

type RequestWithId = Request & { requestId?: string };

const SAFE_REQUEST_ID = /^[A-Za-z0-9._-]{1,64}$/;

@Injectable()
export class HttpLoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(request: RequestWithId, response: Response, next: NextFunction): void {
    const incomingRequestId = request.get('x-request-id');
    const requestId =
      incomingRequestId && SAFE_REQUEST_ID.test(incomingRequestId)
        ? incomingRequestId
        : randomUUID();
    const startedAt = process.hrtime.bigint();
    const path = request.originalUrl.split('?')[0];

    request.requestId = requestId;
    response.setHeader('x-request-id', requestId);

    response.on('finish', () => {
      if (response.statusCode < 400) {
        return;
      }

      const durationMs =
        Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const entry = {
        event: 'http.request',
        requestId,
        method: request.method,
        path,
        statusCode: response.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
      };
      const message = JSON.stringify(entry);

      if (response.statusCode >= 500) {
        this.logger.error(message);
      } else {
        this.logger.warn(message);
      }
    });

    next();
  }
}
