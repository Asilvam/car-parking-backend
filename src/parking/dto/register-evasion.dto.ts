import { EvasionReasonCode } from '../parking.constants';

export class RegisterEvasionDto {
  vehicleNumber: string;
  reasonCode: EvasionReasonCode;
  observation?: string;
}
