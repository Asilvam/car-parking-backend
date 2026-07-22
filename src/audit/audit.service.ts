import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AuditLog } from './entities/audit-log.entity';
import { AuditContext } from './audit-context';

export type AuditEntry = AuditContext & {
  action: string;
  entityType: string;
  entityId?: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  success?: boolean;
};

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLog>,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.auditLogModel.create({
        ...entry,
        success: entry.success ?? true,
      });
    } catch (error) {
      this.logger.error(
        JSON.stringify({
          event: 'audit.write-failed',
          action: entry.action,
          entityType: entry.entityType,
          entityId: entry.entityId,
          requestId: entry.requestId,
          error: (error as Error).message,
        }),
      );
    }
  }
}
