import { norm } from './SmartPrescriptionEngine.js';
import { VitalSign } from '../model/VitalSign.js';
import { PatientRecord, toCanonicalTriage, computeAgeFromDOB } from '../model/PatientRecord.js';
import { MedicationOrder } from '../model/MedicationOrder.js';

export function formatClinicalStamp(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    ' ' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  );
}

/**
 * Validates new patient registration inputs and performs duplicate detection
 * by NationalID OR (FullName + DOB).
 */
export function validateAndCheckDuplicatePatient(formInput, existingPatients = []) {
  const errors = {};
  const fullName = String(formInput.FullName || '').trim();
  const dob = String(formInput.DOB || '').trim();
  const nationalId = String(formInput.NationalID || '').trim();
  const gender = String(formInput.Gender || '').trim();
  const complaint = String(formInput.MainComplaint || '').trim();
  const bed = String(formInput.AssignedBed || 'Waiting').trim();

  if (!fullName) errors.FullName = 'Full name is required.';
  if (!dob) {
    errors.DOB = 'Date of birth is required.';
  } else if (new Date(dob) > new Date()) {
    errors.DOB = 'Date of birth cannot be in the future.';
  }
  if (!nationalId) {
    errors.NationalID = 'National ID or Passport number is required.';
  } else if (nationalId.length < 6) {
    errors.NationalID = 'Enter a valid National ID (at least 6 characters).';
  }
  if (!gender) errors.Gender = 'Select a gender.';
  if (!complaint) errors.MainComplaint = 'Main clinical complaint is required.';

  if (Object.keys(errors).length > 0) {
    return { ok: false, code: 'VALIDATION', errors };
  }

  const duplicate = existingPatients.find(
    (p) =>
      (nationalId && p.NationalID && norm(p.NationalID) === norm(nationalId)) ||
      (norm(p.FullName) === norm(fullName) && p.DOB === dob)
  );

  if (duplicate) {
    return {
      ok: false,
      code: 'DUPLICATE',
      duplicate,
      message: `${duplicate.FullName} (${duplicate.PatientID}) already exists in the system.`
    };
  }

  const allergiesList = Array.isArray(formInput.Allergies)
    ? formInput.Allergies
    : String(formInput.Allergies || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

  const nowStamp = formatClinicalStamp();
  const record = new PatientRecord({
    FullName: fullName,
    NationalID: nationalId,
    DOB: dob,
    Age: computeAgeFromDOB(dob),
    Gender: gender,
    AssignedBed: bed || 'Waiting',
    TriageLevel: toCanonicalTriage(formInput.TriageLevel || 'Low'),
    Allergies: allergiesList,
    ActiveMeds: [],
    MainComplaint: complaint,
    AdmissionTimestamp: nowStamp,
    Arrived: nowStamp.slice(11),
    Status: 'Admitted'
  });

  return {
    ok: true,
    patient: record.toJSON()
  };
}

/**
 * Validates physiological bounds, computes MEWS and triage suggestion,
 * and flags whether the nurse accepted or overrode the MEWS triage suggestion.
 */
export function evaluateVitalsSubmission(rawVitals, currentPatient, selectedTriageOverride = null) {
  const vital = new VitalSign({
    ...rawVitals,
    PatientID: currentPatient.PatientID,
    RecordedTimestamp: rawVitals.RecordedTimestamp || formatClinicalStamp()
  });

  const validation = vital.validatePhysiologicalBounds();
  if (!validation.valid) {
    return {
      ok: false,
      code: 'BOUNDS_ERROR',
      errors: validation.errors
    };
  }

  const patientModel = new PatientRecord(currentPatient);
  const updateResult = patientModel.updateVitals(vital, selectedTriageOverride);

  return {
    ok: true,
    vital: {
      ...updateResult.vital,
      MEWSScore: updateResult.mews.score
    },
    mews: updateResult.mews,
    suggestedTriage: updateResult.mews.suggestedTriage,
    finalTriage: updateResult.finalTriage,
    overridden: updateResult.overridden
  };
}

/**
 * Transitions a prescription to Administered or Cancelled and computes updated ActiveMeds.
 */
export function transitionMedicationOrder(orderData, action, actorUser, reason = '', allPatientOrders = []) {
  const order = new MedicationOrder(orderData);
  try {
    if (action === 'ADMINISTER') {
      order.markAdministered(actorUser.StaffID);
    } else if (action === 'CANCEL') {
      order.cancelOrder(reason, actorUser.StaffID);
    } else {
      return { ok: false, message: `Unknown medication action: ${action}` };
    }
  } catch (err) {
    return { ok: false, message: err.message };
  }

  const updatedOrder = order.toJSON();
  const updatedList = allPatientOrders.map((o) =>
    o.PrescriptionID === updatedOrder.PrescriptionID ? updatedOrder : o
  );

  // Recompute ActiveMeds from non-cancelled prescriptions for this patient
  const activeDrugNames = Array.from(
    new Set(
      updatedList
        .filter((o) => o.Status !== 'Cancelled')
        .map((o) => o.DrugName)
        .filter(Boolean)
    )
  );

  return {
    ok: true,
    order: updatedOrder,
    activeMeds: activeDrugNames
  };
}