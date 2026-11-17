import { VitalSign } from './VitalSign.js';

export const TRIAGE_MAP = {
  High: { canonical: 'High', color: 'Red', label: 'Urgent', rank: 0 },
  Red: { canonical: 'High', color: 'Red', label: 'Urgent', rank: 0 },
  Med: { canonical: 'Med', color: 'Yellow', label: 'Priority', rank: 1 },
  Yellow: { canonical: 'Med', color: 'Yellow', label: 'Priority', rank: 1 },
  Low: { canonical: 'Low', color: 'Green', label: 'Routine', rank: 2 },
  Green: { canonical: 'Low', color: 'Green', label: 'Routine', rank: 2 }
};

export function toCanonicalTriage(level) {
  return (TRIAGE_MAP[level] || TRIAGE_MAP.Low).canonical;
}

export function toColorTriage(level) {
  return (TRIAGE_MAP[level] || TRIAGE_MAP.Low).color;
}

export function computeAgeFromDOB(dob) {
  if (!dob) return 0;
  const d = new Date(dob);
  if (Number.isNaN(d.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

/**
 * Standard South African / Modified Early Warning Score (MEWS) calculation
 * evaluates Systolic BP, Heart Rate, Respiratory Rate, Temperature, SpO2, and AVPU.
 */
export function calculateMEWSFromVitals(vitalInput) {
  const v = vitalInput instanceof VitalSign ? vitalInput : new VitalSign(vitalInput);
  let score = 0;
  const breakdown = [];

  // 1. Systolic BP
  const sbp = v.BloodPressureSystolic;
  if (sbp <= 70) { score += 3; breakdown.push('SBP ≤70 (+3)'); }
  else if (sbp <= 80) { score += 2; breakdown.push('SBP 71-80 (+2)'); }
  else if (sbp <= 100) { score += 1; breakdown.push('SBP 81-100 (+1)'); }
  else if (sbp >= 200) { score += 2; breakdown.push('SBP ≥200 (+2)'); }

  // 2. Heart Rate
  const hr = v.HeartRate;
  if (hr <= 40) { score += 2; breakdown.push('HR ≤40 (+2)'); }
  else if (hr <= 50) { score += 1; breakdown.push('HR 41-50 (+1)'); }
  else if (hr >= 130) { score += 3; breakdown.push('HR ≥130 (+3)'); }
  else if (hr >= 111) { score += 2; breakdown.push('HR 111-129 (+2)'); }
  else if (hr >= 101) { score += 1; breakdown.push('HR 101-110 (+1)'); }

  // 3. Respiratory Rate
  const rr = v.RespiratoryRate || 16;
  if (rr < 9) { score += 2; breakdown.push('RR <9 (+2)'); }
  else if (rr >= 30) { score += 3; breakdown.push('RR ≥30 (+3)'); }
  else if (rr >= 21) { score += 2; breakdown.push('RR 21-29 (+2)'); }
  else if (rr >= 15) { score += 1; breakdown.push('RR 15-20 (+1)'); }

  // 4. Temperature
  const temp = v.BodyTemperature;
  if (temp < 35.0) { score += 2; breakdown.push('Temp <35.0°C (+2)'); }
  else if (temp >= 38.5) { score += 2; breakdown.push('Temp ≥38.5°C (+2)'); }
  else if (temp >= 38.0) { score += 1; breakdown.push('Temp 38.0-38.4°C (+1)'); }

  // 5. SpO2 hypoxia check
  const spo2 = v.OxygenSaturation;
  if (spo2 < 90) { score += 3; breakdown.push('SpO2 <90% (+3)'); }
  else if (spo2 < 94) { score += 2; breakdown.push('SpO2 90-93% (+2)'); }

  // 6. AVPU
  if (v.AVPU === 'V') { score += 1; breakdown.push('AVPU Voice (+1)'); }
  else if (v.AVPU === 'P') { score += 2; breakdown.push('AVPU Pain (+2)'); }
  else if (v.AVPU === 'U') { score += 3; breakdown.push('AVPU Unresponsive (+3)'); }

  let suggestedTriage = 'Low';
  let suggestedColor = 'Green';
  if (score >= 5 || v.isHypoxic()) {
    suggestedTriage = 'High';
    suggestedColor = 'Red';
  } else if (score >= 3 || v.isTachycardic()) {
    suggestedTriage = 'Med';
    suggestedColor = 'Yellow';
  }

  return {
    score,
    suggestedTriage,
    suggestedColor,
    isTachycardic: v.isTachycardic(),
    isHypoxic: v.isHypoxic(),
    breakdown
  };
}

export class PatientRecord {
  constructor(data = {}) {
    this.PatientID = data.PatientID || '';
    this.NationalID = data.NationalID || '';
    this.FullName = data.FullName || '';
    this.DOB = data.DOB || '';
    this.Age = data.Age ?? computeAgeFromDOB(data.DOB);
    this.Gender = data.Gender || '';
    this.AssignedBed = data.AssignedBed || 'Waiting';
    this.TriageLevel = toCanonicalTriage(data.TriageLevel || 'Low');
    this.Allergies = Array.isArray(data.Allergies) ? [...data.Allergies] : [];
    this.ActiveMeds = Array.isArray(data.ActiveMeds) ? [...data.ActiveMeds] : [];
    this.MainComplaint = data.MainComplaint || '';
    this.AdmissionTimestamp = data.AdmissionTimestamp || data.Arrived || new Date().toISOString().slice(0, 16).replace('T', ' ');
    this.Arrived = data.Arrived || this.AdmissionTimestamp.slice(-5);
    this.Status = data.Status || 'Admitted';
    this.LastVitals = data.LastVitals || null;
    this.MEWSScore = data.MEWSScore ?? null;
  }

  calculateMEWS(vitalSign) {
    const target = vitalSign || this.LastVitals;
    if (!target) {
      return { score: 0, suggestedTriage: this.TriageLevel, suggestedColor: toColorTriage(this.TriageLevel), breakdown: [] };
    }
    return calculateMEWSFromVitals(target);
  }

  updateVitals(vitalSign, chosenTriage = null) {
    const v = vitalSign instanceof VitalSign ? vitalSign : new VitalSign(vitalSign);
    const bounds = v.validatePhysiologicalBounds();
    if (!bounds.valid) {
      return { ok: false, errors: bounds.errors };
    }
    const mews = this.calculateMEWS(v);
    this.LastVitals = v.toJSON();
    this.MEWSScore = mews.score;
    const finalTriage = chosenTriage ? toCanonicalTriage(chosenTriage) : mews.suggestedTriage;
    const overridden = finalTriage !== mews.suggestedTriage;
    this.TriageLevel = finalTriage;
    return {
      ok: true,
      vital: this.LastVitals,
      mews,
      finalTriage,
      overridden
    };
  }

  attachPrescription(order) {
    const drugName = order.DrugName || order.drugName;
    if (drugName && !this.ActiveMeds.includes(drugName)) {
      this.ActiveMeds = [...this.ActiveMeds, drugName];
    }
    return this;
  }

  dischargePatient(prescriptionsForPatient = []) {
    const pending = prescriptionsForPatient.filter(
      (rx) => rx.PatientID === this.PatientID && rx.Status === 'Pending'
    );
    if (pending.length > 0) {
      return {
        ok: false,
        code: 'PENDING_MEDS',
        title: 'Discharge Blocked: Pending Medication',
        message: `Cannot discharge ${this.FullName}: ${pending.length} pending prescription(s) (${pending.map((p) => p.DrugName || p.DrugID).join(', ')}) must be administered or cancelled first.`
      };
    }
    this.Status = 'Discharged';
    this.DischargedTimestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    return {
      ok: true,
      code: 'DISCHARGED',
      title: 'Patient Discharged',
      message: `${this.FullName} (${this.PatientID}) has been safely discharged.`
    };
  }

  toJSON() {
    return {
      PatientID: this.PatientID,
      NationalID: this.NationalID,
      FullName: this.FullName,
      DOB: this.DOB,
      Age: computeAgeFromDOB(this.DOB) || this.Age,
      Gender: this.Gender,
      AssignedBed: this.AssignedBed,
      TriageLevel: toCanonicalTriage(this.TriageLevel),
      Allergies: [...this.Allergies],
      ActiveMeds: [...this.ActiveMeds],
      MainComplaint: this.MainComplaint,
      AdmissionTimestamp: this.AdmissionTimestamp,
      Arrived: this.Arrived,
      Status: this.Status,
      LastVitals: this.LastVitals,
      MEWSScore: this.MEWSScore
    };
  }
}