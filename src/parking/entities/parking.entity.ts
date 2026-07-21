import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'parking', timestamps: true })
export class Parking extends Document {
  @Prop({ required: true })
  vehicleNumber: string;

  @Prop({ required: true })
  entryTime: Date;

  @Prop()
  exitTime?: Date;

  @Prop()
  totalMinutes?: number;

  @Prop()
  totalCost?: number;

  @Prop({ required: true, default: 30 })
  ratePerMinute: number;

  @Prop({ required: true, enum: ['active', 'completed'], default: 'active' })
  status: 'active' | 'completed';

  @Prop({ enum: ['cash', 'debit', 'credit', 'transfer'] })
  paymentMethod?: 'cash' | 'debit' | 'credit' | 'transfer';

  @Prop()
  paidAt?: Date;
}

export const ParkingSchema = SchemaFactory.createForClass(Parking);

ParkingSchema.index(
  { vehicleNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
  },
);
