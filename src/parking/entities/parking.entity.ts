import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema, Types } from 'mongoose';
import { ParkingLocation } from '../../location/entities/parking-location.entity';

@Schema({ collection: 'parking', timestamps: true })
export class Parking extends Document {
  @Prop({
    required: true,
    type: MongooseSchema.Types.ObjectId,
    ref: ParkingLocation.name,
    index: true,
  })
  locationId: Types.ObjectId;

  @Prop({ required: true, trim: true, uppercase: true })
  locationCode: string;

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

  @Prop({ required: true })
  ratePerMinute: number;

  @Prop({
    required: true,
    enum: ['active', 'completed', 'evaded'],
    default: 'active',
  })
  status: 'active' | 'completed' | 'evaded';

  @Prop({
    required: true,
    enum: ['pending', 'paid', 'evaded'],
    default: 'pending',
  })
  paymentStatus: 'pending' | 'paid' | 'evaded';

  @Prop({ enum: ['paid', 'evasion'] })
  exitType?: 'paid' | 'evasion';

  @Prop({ enum: ['cash', 'debit', 'credit', 'transfer'] })
  paymentMethod?: 'cash' | 'debit' | 'credit' | 'transfer';

  @Prop()
  paidAt?: Date;

  @Prop({ required: true, default: 0 })
  amountPaid: number;

  @Prop({ required: true, default: 0 })
  outstandingAmount: number;

  @Prop({ required: true, default: false })
  purchaseDiscountApplied: boolean;

  @Prop({ required: true, default: 0 })
  discountMinutesApplied: number;

  @Prop()
  minutesCharged?: number;

  @Prop({
    enum: [
      'left-without-payment',
      'payment-refused',
      'operator-record-correction',
      'unknown',
      'other',
    ],
  })
  evasionReasonCode?: string;

  @Prop({ trim: true, maxlength: 500 })
  evasionObservation?: string;

  @Prop({ trim: true })
  evasionRecordedBy?: string;
}

export const ParkingSchema = SchemaFactory.createForClass(Parking);

ParkingSchema.index(
  { locationId: 1, vehicleNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
    name: 'active_vehicle_per_location',
  },
);
