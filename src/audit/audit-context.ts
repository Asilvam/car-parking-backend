import { Request } from 'express';

type AuthenticatedActor = {
  id?: string;
  username?: string;
};

type RequestWithContext = Request & {
  requestId?: string;
  user?: AuthenticatedActor;
};

export type AuditContext = {
  actor: string;
  ip?: string;
  userAgent?: string;
  requestId?: string;
};

export function createAuditContext(request: Request): AuditContext {
  const contextualRequest = request as RequestWithContext;

  return {
    actor:
      contextualRequest.user?.username ??
      contextualRequest.user?.id ??
      'anonymous',
    ip: request.ip || request.socket.remoteAddress,
    userAgent: request.get('user-agent'),
    requestId: contextualRequest.requestId,
  };
}
