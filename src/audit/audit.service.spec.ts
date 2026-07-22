import { Logger } from '@nestjs/common';
import { Model } from 'mongoose';
import { AuditService } from './audit.service';
import { AuditLog } from './entities/audit-log.entity';

describe('AuditService', () => {
  it('guarda el evento con éxito por defecto', async () => {
    const model = { create: jest.fn().mockResolvedValue({}) };
    const service = new AuditService(model as unknown as Model<AuditLog>);

    await service.record({
      actor: 'operator-1',
      action: 'parking.entry',
      entityType: 'Parking',
      entityId: 'parking-id',
      requestId: 'request-id',
    });

    expect(model.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'parking.entry',
        success: true,
      }),
    );
  });

  it('no interrumpe la operación principal si falla la auditoría', async () => {
    const model = {
      create: jest.fn().mockRejectedValue(new Error('Mongo unavailable')),
    };
    const logger = jest.spyOn(Logger.prototype, 'error').mockImplementation();
    const service = new AuditService(model as unknown as Model<AuditLog>);

    await expect(
      service.record({
        actor: 'operator-1',
        action: 'parking.exit',
        entityType: 'Parking',
      }),
    ).resolves.toBeUndefined();

    expect(logger).toHaveBeenCalledWith(
      expect.stringContaining('"event":"audit.write-failed"'),
    );
    logger.mockRestore();
  });
});
