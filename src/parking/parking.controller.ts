import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { ParkingService } from './parking.service';
import { CreateParkingDto } from './dto/create-parking.dto';
import { ExitParkingDto } from './dto/exit-parking.dto';

@Controller('parking')
export class ParkingController {
  constructor(private readonly parkingService: ParkingService) {}

  @Post('entry')
  registerEntry(@Body() input: CreateParkingDto) {
    return this.parkingService.registerEntry(input.vehicleNumber);
  }

  @Post('exit')
  registerExit(@Body() input: ExitParkingDto) {
    return this.parkingService.registerExit(
      input.vehicleNumber,
      input.paymentMethod,
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
  getParkings(@Query('status') status?: 'active' | 'completed') {
    return this.parkingService.getParkings(status);
  }
}
