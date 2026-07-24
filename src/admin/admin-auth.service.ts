import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes, timingSafeEqual } from 'crypto';

type AdminSession = {
  token: string;
  expiresAt: Date;
};

@Injectable()
export class AdminAuthService {
  private readonly sessions = new Map<string, number>();
  private readonly sessionDurationMs = 8 * 60 * 60 * 1000;

  constructor(private readonly configService: ConfigService) {}

  login(password: string): AdminSession {
    const configured = this.configService.getOrThrow<string>(
      'ADMIN_PANEL_PASSWORD',
    );

    if (!this.isSameSecret(password, configured)) {
      throw new UnauthorizedException('Clave de administración inválida');
    }

    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + this.sessionDurationMs);
    this.sessions.set(token, expiresAt.getTime());

    return { token, expiresAt };
  }

  verify(token: string): void {
    const expiry = this.sessions.get(token);

    if (!expiry) {
      throw new UnauthorizedException('Sesión administrativa inválida');
    }

    if (Date.now() > expiry) {
      this.sessions.delete(token);
      throw new UnauthorizedException('Sesión administrativa expirada');
    }
  }

  logout(token: string): void {
    this.sessions.delete(token);
  }

  private isSameSecret(input: string, configured: string): boolean {
    const left = Buffer.from(input || '', 'utf8');
    const right = Buffer.from(configured || '', 'utf8');

    if (left.length !== right.length) {
      return false;
    }

    return timingSafeEqual(left, right);
  }
}
