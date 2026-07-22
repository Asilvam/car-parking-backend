import { Controller, Get } from '@nestjs/common';
import { LocationService } from './location.service';

@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Get('current')
  async getCurrentLocation() {
    const location = await this.locationService.getCurrentLocation();

    return {
      id: String(location._id),
      code: location.code,
      name: location.name,
      address: location.address,
      timezone: location.timezone,
      currency: location.currency,
      ratePerMinute: location.ratePerMinute,
    };
  }
}
