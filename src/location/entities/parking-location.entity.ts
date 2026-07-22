import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'parking_locations', timestamps: true })
export class ParkingLocation extends Document {
  @Prop({ required: true, trim: true, uppercase: true })
  code: string;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  address?: string;

  @Prop({ required: true, default: 'America/Santiago' })
  timezone: string;

  @Prop({ required: true, default: 'CLP' })
  currency: string;

  @Prop({ required: true, min: 1 })
  ratePerMinute: number;

  @Prop({ required: true, enum: ['active', 'inactive'], default: 'active' })
  status: 'active' | 'inactive';
}

export const ParkingLocationSchema =
  SchemaFactory.createForClass(ParkingLocation);

ParkingLocationSchema.index({ code: 1 }, { unique: true });
