import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ParkingLocation } from './entities/parking-location.entity';

@Injectable()
export class LocationService implements OnModuleInit {
  private currentLocation?: Promise<ParkingLocation>;

  constructor(
    @InjectModel(ParkingLocation.name)
    private readonly locationModel: Model<ParkingLocation>,
    private readonly configService: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.getCurrentLocation();
  }

  getCurrentLocation(): Promise<ParkingLocation> {
    this.currentLocation ??= this.initializeCurrentLocation();
    return this.currentLocation;
  }

  private async initializeCurrentLocation(): Promise<ParkingLocation> {
    const code = this.configService.getOrThrow<string>('PARKING_LOCATION_CODE');
    const name = this.configService.getOrThrow<string>('PARKING_LOCATION_NAME');
    const address = this.configService
      .get<string>('PARKING_LOCATION_ADDRESS')
      ?.trim();
    const ratePerMinute =
      this.configService.getOrThrow<number>('RATE_PER_MINUTE');

    const location = await this.locationModel.findOneAndUpdate(
      { code },
      {
        $set: {
          name,
          address: address || undefined,
          timezone: 'America/Santiago',
          currency: 'CLP',
          ratePerMinute,
          status: 'active',
        },
      },
      { upsert: true, new: true, runValidators: true },
    );

    if (!location) {
      throw new Error(`No se pudo inicializar el lugar ${code}`);
    }

    return location;
  }
}
