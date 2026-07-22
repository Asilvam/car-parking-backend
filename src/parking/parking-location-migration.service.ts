import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { LocationService } from '../location/location.service';
import { Parking } from './entities/parking.entity';

@Injectable()
export class ParkingLocationMigrationService implements OnModuleInit {
  private readonly logger = new Logger(ParkingLocationMigrationService.name);

  constructor(
    @InjectModel(Parking.name)
    private readonly parkingModel: Model<Parking>,
    private readonly locationService: LocationService,
  ) {}

  async onModuleInit(): Promise<void> {
    const location = await this.locationService.getCurrentLocation();
    const migration = await this.parkingModel.updateMany(
      { locationId: { $exists: false } },
      {
        $set: {
          locationId: location._id,
          locationCode: location.code,
        },
      },
    );

    const indexes = await this.parkingModel.collection.indexes();
    if (indexes.some((index) => index.name === 'vehicleNumber_1')) {
      await this.parkingModel.collection.dropIndex('vehicleNumber_1');
    }
    await this.parkingModel.createIndexes();

    if (migration.modifiedCount > 0) {
      this.logger.log(
        JSON.stringify({
          event: 'parking.location-migration',
          locationCode: location.code,
          migratedRecords: migration.modifiedCount,
        }),
      );
    }
  }
}
