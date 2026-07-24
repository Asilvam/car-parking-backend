import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminAuthService } from './admin-auth.service';

describe('AdminAuthService', () => {
  const configService = {
    getOrThrow: jest.fn(() => 'super-clave'),
  } as unknown as ConfigService;

  let service: AdminAuthService;

  beforeEach(() => {
    service = new AdminAuthService(configService);
  });

  it('crea sesión válida con contraseña correcta', () => {
    const session = service.login('super-clave');
    expect(session.token).toHaveLength(64);
    expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(() => service.verify(session.token)).not.toThrow();
  });

  it('rechaza contraseña incorrecta', () => {
    expect(() => service.login('otra-clave')).toThrow(UnauthorizedException);
  });

  it('invalida sesión al cerrar', () => {
    const session = service.login('super-clave');
    service.logout(session.token);
    expect(() => service.verify(session.token)).toThrow(UnauthorizedException);
  });
});
