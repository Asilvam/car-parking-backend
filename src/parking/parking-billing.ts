const VEHICLE_NUMBER_PATTERN = /^[A-Z0-9]{4,8}$/;

export function normalizeVehicleNumber(vehicleNumber: unknown): string {
  if (typeof vehicleNumber !== 'string') {
    throw new Error('La patente es obligatoria');
  }

  const normalized = vehicleNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');

  if (!VEHICLE_NUMBER_PATTERN.test(normalized)) {
    throw new Error('La patente debe tener entre 4 y 8 letras o números');
  }

  return normalized;
}

export function calculateParkingCharge(
  entryTime: Date,
  exitTime: Date,
  ratePerMinute: number,
) {
  const elapsedMilliseconds = exitTime.getTime() - entryTime.getTime();

  if (elapsedMilliseconds < 0) {
    throw new Error('La hora de salida no puede ser anterior a la entrada');
  }

  const totalMinutes = Math.max(
    1,
    Math.ceil(elapsedMilliseconds / (1000 * 60)),
  );

  return {
    totalMinutes,
    totalCost: totalMinutes * ratePerMinute,
  };
}
