import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

@Schema({ collection: 'audit_logs', timestamps: true })
export class AuditLog extends Document {
  @Prop({ required: true, trim: true, index: true })
  actor: string;

  @Prop({ required: true, trim: true, index: true })
  action: string;

  @Prop({ required: true, trim: true, index: true })
  entityType: string;

  @Prop({ trim: true })
  entityId?: string;

  @Prop({ trim: true })
  summary?: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  metadata?: Record<string, unknown>;

  @Prop({ trim: true })
  ip?: string;

  @Prop({ trim: true })
  userAgent?: string;

  @Prop({ trim: true, index: true })
  requestId?: string;

  @Prop({ required: true, default: true })
  success: boolean;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ createdAt: -1 });
AuditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
