import { Logger } from '@nestjs/common';
import { EventEmitter } from 'node:events';
import { Request, Response } from 'express';
import { HttpLoggingMiddleware } from './http-logging.middleware';

function createResponse(statusCode: number) {
  const events = new EventEmitter();
  const response = {
    statusCode,
    setHeader: jest.fn(),
    on: events.on.bind(events),
  } as unknown as Response;

  return { response, finish: () => events.emit('finish') };
}

function createRequest(method = 'GET') {
  return {
    method,
    originalUrl: '/parking?status=active',
    get: jest.fn().mockReturnValue(undefined),
  } as unknown as Request;
}

describe('HttpLoggingMiddleware', () => {
  it('omite peticiones exitosas para evitar ruido redundante', () => {
    const logger = jest.spyOn(Logger.prototype, 'log').mockImplementation();
    const middleware = new HttpLoggingMiddleware();
    const { response, finish } = createResponse(200);

    middleware.use(createRequest(), response, jest.fn());
    finish();

    expect(logger).not.toHaveBeenCalled();
    logger.mockRestore();
  });

  it('registra errores HTTP como JSON en una sola línea', () => {
    const logger = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    const middleware = new HttpLoggingMiddleware();
    const { response, finish } = createResponse(404);

    middleware.use(createRequest('POST'), response, jest.fn());
    finish();

    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('"event":"http.request"'),
    );
    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('"statusCode":404'),
    );
    logger.mockRestore();
  });
});
