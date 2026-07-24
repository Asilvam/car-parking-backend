import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Parking, ParkingSchema } from '../parking/entities/parking.entity';
import { AdminAuthService } from './admin-auth.service';
import { AdminController } from './admin.controller';
import { AdminReportingService } from './admin-reporting.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Parking.name, schema: ParkingSchema }]),
  ],
  controllers: [AdminController],
  providers: [AdminAuthService, AdminReportingService],
  exports: [AdminAuthService],
})
export class AdminModule {}
