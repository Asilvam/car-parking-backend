import { Module } from '@nestjs/common';
import { ParkingService } from './parking.service';
import { ParkingController } from './parking.controller';
import { MongooseModule } from '@nestjs/mongoose';
import { Parking, ParkingSchema } from './entities/parking.entity';
import { AuditModule } from '../audit/audit.module';
import { LocationModule } from '../location/location.module';
import { ParkingLocationMigrationService } from './parking-location-migration.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Parking.name, schema: ParkingSchema }]),
    AuditModule,
    LocationModule,
  ],
  controllers: [ParkingController],
  providers: [ParkingService, ParkingLocationMigrationService],
})
export class ParkingModule {}
