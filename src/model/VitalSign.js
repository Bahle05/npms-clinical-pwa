export const PHYSIOLOGICAL_BOUNDS = {
  HeartRate: { min: 20, max: 250, label: 'Heart rate', unit: 'bpm' },
  BloodPressureSystolic: { min: 50, max: 260, label: 'Systolic BP', unit: 'mmHg' },
  BloodPressureDiastolic: { min: 30, max: 160, label: 'Diastolic BP', unit: 'mmHg' },
  OxygenSaturation: { min: 50, max: 100, label: 'Oxygen saturation (SpO2)', unit: '%' },
  BodyTemperature: { min: 30.0, max: 43.0, label: 'Body temperature', unit: '°C' },
  RespiratoryRate: { min: 4, max: 60, label: 'Respiratory rate', unit: 'breaths/min' }
};

export class VitalSign {
  constructor({
    VitalID = '',
    PatientID = '',
    RecordedByStaffID = '',
    HeartRate,
    BloodPressureSystolic,
    BloodPressureDiastolic,
    OxygenSaturation = 98,
    BodyTemperature = 36.8,
    RespiratoryRate = 16,
    AVPU = 'A',
    RecordedTimestamp = ''
  }) {
    this.VitalID = VitalID;
    this.PatientID = PatientID;
    this.RecordedByStaffID = RecordedByStaffID;
    this.HeartRate = Number(HeartRate);
    this.BloodPressureSystolic = Number(BloodPressureSystolic);
    this.BloodPressureDiastolic = Number(BloodPressureDiastolic);
    this.OxygenSaturation = Number(OxygenSaturation);
    this.BodyTemperature = Number(BodyTemperature);
    this.RespiratoryRate = Number(RespiratoryRate ?? 16);
    this.AVPU = String(AVPU || 'A').toUpperCase();
    this.RecordedTimestamp = RecordedTimestamp || new Date().toISOString().slice(0, 16).replace('T', ' ');
  }

  isTachycardic() {
    return Number.isFinite(this.HeartRate) && this.HeartRate > 100;
  }

  isHypoxic() {
    return Number.isFinite(this.OxygenSaturation) && this.OxygenSaturation < 92;
  }

  validatePhysiologicalBounds() {
    const errors = {};

    const checkInt = (val, boundsKey) => {
      const b = PHYSIOLOGICAL_BOUNDS[boundsKey];
      if (val === '' || val === null || val === undefined || Number.isNaN(Number(val))) {
        errors[boundsKey] = `${b.label} is required.`;
        return;
      }
      const n = Number(val);
      if (!Number.isInteger(n)) {
        errors[boundsKey] = `${b.label} must be a whole number.`;
        return;
      }
      if (n < b.min || n > b.max) {
        errors[boundsKey] = `${b.label} must be between ${b.min} and ${b.max} ${b.unit}.`;
      }
    };

    checkInt(this.HeartRate, 'HeartRate');
    checkInt(this.BloodPressureSystolic, 'BloodPressureSystolic');
    checkInt(this.BloodPressureDiastolic, 'BloodPressureDiastolic');
    checkInt(this.OxygenSaturation, 'OxygenSaturation');
    checkInt(this.RespiratoryRate, 'RespiratoryRate');

    const tempBounds = PHYSIOLOGICAL_BOUNDS.BodyTemperature;
    if (this.BodyTemperature === '' || Number.isNaN(this.BodyTemperature)) {
      errors.BodyTemperature = `${tempBounds.label} is required.`;
    } else if (this.BodyTemperature < tempBounds.min || this.BodyTemperature > tempBounds.max) {
      errors.BodyTemperature = `${tempBounds.label} must be between ${tempBounds.min} and ${tempBounds.max} ${tempBounds.unit}.`;
    }

    if (
      !errors.BloodPressureSystolic &&
      !errors.BloodPressureDiastolic &&
      this.BloodPressureDiastolic >= this.BloodPressureSystolic
    ) {
      errors.BloodPressureDiastolic = 'Diastolic BP must be lower than Systolic BP.';
    }

    if (!['A', 'V', 'P', 'U'].includes(this.AVPU)) {
      errors.AVPU = 'AVPU score must be A (Alert), V (Voice), P (Pain), or U (Unresponsive).';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors
    };
  }

  toJSON() {
    return {
      VitalID: this.VitalID,
      PatientID: this.PatientID,
      RecordedByStaffID: this.RecordedByStaffID,
      HeartRate: this.HeartRate,
      BloodPressureSystolic: this.BloodPressureSystolic,
      BloodPressureDiastolic: this.BloodPressureDiastolic,
      OxygenSaturation: this.OxygenSaturation,
      BodyTemperature: this.BodyTemperature,
      RespiratoryRate: this.RespiratoryRate,
      AVPU: this.AVPU,
      IsTachycardic: this.isTachycardic(),
      IsHypoxic: this.isHypoxic(),
      RecordedTimestamp: this.RecordedTimestamp
    };
  }
}