import { BadRequestException } from '@nestjs/common';
import { AdminReportingService } from './admin-reporting.service';

describe('AdminReportingService validation', () => {
  const mockModel = {
    find: jest.fn(() => ({ sort: jest.fn().mockResolvedValue([]) })),
  };

  let service: AdminReportingService;

  beforeEach(() => {
    service = new AdminReportingService(mockModel as never);
  });

  it('rechaza preset inválido', async () => {
    await expect(
      service.getParkingSummary({ preset: 'bad' as never }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rechaza range sin from/to', async () => {
    await expect(
      service.getParkingSummary({ preset: 'range' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('acepta semana y consulta movimientos', async () => {
    const output = await service.getParkingSummary({
      preset: 'week',
      date: '2026-07-24',
    });

    expect(output.filters.preset).toBe('week');
    expect(mockModel.find).toHaveBeenCalled();
  });
});
