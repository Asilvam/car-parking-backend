import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AdminAuthService } from './admin-auth.service';
import { AdminGuard } from './admin.guard';
import { AdminReportingService } from './admin-reporting.service';
import { AdminReportQuery } from './admin.types';

type LoginInput = {
  password?: string;
};

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminAuthService: AdminAuthService,
    private readonly adminReportingService: AdminReportingService,
  ) {}

  @Post('auth/login')
  login(@Body() body: LoginInput) {
    const password = body.password?.trim() ?? '';
    const session = this.adminAuthService.login(password);

    return {
      token: session.token,
      expiresAt: session.expiresAt,
    };
  }

  @Post('auth/logout')
  @UseGuards(AdminGuard)
  logout(@Req() request: Request) {
    const token = request.header('x-admin-session')?.trim() ?? '';
    this.adminAuthService.logout(token);
    return { ok: true };
  }

  @Get('reports/parking.xlsx')
  @UseGuards(AdminGuard)
  async exportParkingReport(
    @Query() query: AdminReportQuery,
    @Res() response: Response,
  ): Promise<void> {
    const file = await this.adminReportingService.exportParkingReport(query);
    const stamp = new Date().toISOString().replace(/[:]/g, '-').slice(0, 16);

    response.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    response.setHeader(
      'Content-Disposition',
      `attachment; filename=parking-report-${stamp}.xlsx`,
    );
    response.send(file);
  }

  @Get('reports/parking-summary')
  @UseGuards(AdminGuard)
  getParkingSummary(@Query() query: AdminReportQuery) {
    return this.adminReportingService.getParkingSummary(query);
  }
}
