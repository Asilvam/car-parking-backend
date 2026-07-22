import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { Request } from 'express';
import { ParkingService } from './parking.service';
import { CreateParkingDto } from './dto/create-parking.dto';
import { ExitParkingDto } from './dto/exit-parking.dto';
import { createAuditContext } from '../audit/audit-context';
import { RegisterEvasionDto } from './dto/register-evasion.dto';

@Controller('parking')
export class ParkingController {
  constructor(private readonly parkingService: ParkingService) {}

  @Post('entry')
  registerEntry(@Body() input: CreateParkingDto, @Req() request: Request) {
    return this.parkingService.registerEntry(
      input.vehicleNumber,
      createAuditContext(request),
    );
  }

  @Post('exit')
  registerExit(@Body() input: ExitParkingDto, @Req() request: Request) {
    return this.parkingService.registerExit(
      input.vehicleNumber,
      input.paymentMethod,
      createAuditContext(request),
    );
  }

  @Post('evasion')
  registerEvasion(@Body() input: RegisterEvasionDto, @Req() request: Request) {
    return this.parkingService.registerEvasion(
      input.vehicleNumber,
      input.reasonCode,
      input.observation,
      createAuditContext(request),
    );
  }

  @Get('summary/today')
  getTodaySummary() {
    return this.parkingService.getTodaySummary();
  }

  @Get('config')
  getConfig() {
    return this.parkingService.getConfig();
  }

  @Get()
  getParkings(@Query('status') status?: 'active' | 'completed' | 'evaded') {
    return this.parkingService.getParkings(status);
  }
}
