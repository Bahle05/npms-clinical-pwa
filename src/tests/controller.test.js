import { describe, it, expect, beforeEach } from 'vitest';
import { prescribeMedication, DEFAULT_FORMULARY } from '../controller/SmartPrescriptionEngine.js';
import { VitalSign } from '../model/VitalSign.js';
import { PatientRecord, calculateMEWSFromVitals } from '../model/PatientRecord.js';
import { MedicationOrder } from '../model/MedicationOrder.js';
import { AuditTrail } from '../model/AuditTrail.js';
import { InMemoryRepository } from '../firebase/repositories.js';

describe('NPMS SmartPrescriptionEngine — Mandatory Test Matrix (TC-01 to TC-11)', () => {
  const nurse = { StaffID: 'N-1001', FullName: 'Thandi Mokoena', Role: 'Nurse' };
  const physician = { StaffID: 'P-2001', FullName: 'Dr. Sipho Nkosi', Role: 'Physician' };
  let repo;

  beforeEach(() => {
    repo = new InMemoryRepository();
  });

  it('TC-01: Nurse prescribes Paracetamol for a clean patient -> blocked "Unauthorized Action", ActiveMeds unchanged, no success audit', async () => {
    const cleanPatient = repo.state.patients.find((p) => p.PatientID === 'P-005');
    const beforeMeds = [...cleanPatient.ActiveMeds];

    const res = await repo.prescribe({
      user: nurse,
      patientId: 'P-005',
      drugName: 'Paracetamol',
      isOffline: false
    });

    expect(res.ok).toBe(false);
    expect(res.code).toBe('UNAUTHORIZED');
    expect(res.title).toBe('Unauthorized Action');
    expect(res.message).toContain('Unauthorized Action');

    const afterPatient = repo.state.patients.find((p) => p.PatientID === 'P-005');
    expect(afterPatient.ActiveMeds).toEqual(beforeMeds);
    const successAudits = repo.state.audit.filter(
      (a) => a.PatientID === 'P-005' && a.Outcome === 'SUCCESS'
    );
    expect(successAudits.length).toBe(0);
  });

  it('TC-02: Nurse prescribes Amoxicillin for a Penicillin-allergic patient -> blocked at RBAC; allergy check is not reached', async () => {
    const allergicPatient = repo.state.patients.find((p) => p.PatientID === 'P-001');
    const beforeMeds = [...allergicPatient.ActiveMeds];

    const res = await repo.prescribe({
      user: nurse,
      patientId: 'P-001',
      drugName: 'Amoxicillin',
      isOffline: false
    });

    expect(res.ok).toBe(false);
    expect(res.code).toBe('UNAUTHORIZED');
    expect(res.title).toBe('Unauthorized Action');

    const afterPatient = repo.state.patients.find((p) => p.PatientID === 'P-001');
    expect(afterPatient.ActiveMeds).toEqual(beforeMeds);
    expect(
      repo.state.audit.some((a) => a.PatientID === 'P-001' && a.Outcome === 'SUCCESS')
    ).toBe(false);
  });

  it('TC-03: Physician, clean patient, Paracetamol -> success; ActiveMeds gains Paracetamol', async () => {
    const res = await repo.prescribe({
      user: physician,
      patientId: 'P-005',
      drugName: 'Paracetamol',
      isOffline: false
    });

    expect(res.ok).toBe(true);
    expect(res.code).toBe('SUCCESS');

    const afterPatient = repo.state.patients.find((p) => p.PatientID === 'P-005');
    expect(afterPatient.ActiveMeds).toContain('Paracetamol');
    expect(
      repo.state.audit.some(
        (a) => a.PatientID === 'P-005' && a.Outcome === 'SUCCESS' && a.Detail.includes('Paracetamol')
      )
    ).toBe(true);
  });

  it('TC-04: Allergy equals the drug name (Penicillin V) -> blocked "Severe Allergy Risk"', () => {
    const patient = { PatientID: 'P-001', Allergies: ['Penicillin V'], ActiveMeds: [] };
    const snapshot = JSON.stringify(patient);

    const res = prescribeMedication(physician, patient, 'Penicillin V', DEFAULT_FORMULARY);

    expect(res.ok).toBe(false);
    expect(res.code).toBe('ALLERGY');
    expect(res.title).toBe('Severe Allergy Risk');
    expect(JSON.stringify(patient)).toBe(snapshot);
  });

  it('TC-05: Allergy matched by drug family (Amoxicillin, family Penicillin) -> blocked', async () => {
    const beforeMeds = [...repo.state.patients.find((p) => p.PatientID === 'P-001').ActiveMeds];
    const res = await repo.prescribe({
      user: physician,
      patientId: 'P-001',
      drugName: 'Amoxicillin',
      isOffline: false
    });

    expect(res.ok).toBe(false);
    expect(res.code).toBe('ALLERGY');
    expect(res.title).toBe('Severe Allergy Risk');
    expect(repo.state.patients.find((p) => p.PatientID === 'P-001').ActiveMeds).toEqual(beforeMeds);
    expect(
      repo.state.audit.some((a) => a.PatientID === 'P-001' && a.Outcome === 'SUCCESS')
    ).toBe(false);
  });

  it('TC-06: Allergy stored in lower case ("penicillin") -> still blocked', () => {
    const patient = { PatientID: 'P-LOWER', Allergies: ['penicillin'], ActiveMeds: [] };
    const res = prescribeMedication(physician, patient, 'Amoxicillin', DEFAULT_FORMULARY);

    expect(res.ok).toBe(false);
    expect(res.code).toBe('ALLERGY');
    expect(patient.ActiveMeds).toEqual([]);
  });

  it('TC-07: Ibuprofen with Warfarin active -> blocked "Adverse Interaction Detected with Warfarin"', async () => {
    const beforeMeds = [...repo.state.patients.find((p) => p.PatientID === 'P-002').ActiveMeds];
    const res = await repo.prescribe({
      user: physician,
      patientId: 'P-002',
      drugName: 'Ibuprofen',
      isOffline: false
    });

    expect(res.ok).toBe(false);
    expect(res.code).toBe('INTERACTION');
    expect(res.message).toBe('Adverse Interaction Detected with Warfarin');
    expect(repo.state.patients.find((p) => p.PatientID === 'P-002').ActiveMeds).toEqual(beforeMeds);
    expect(
      repo.state.audit.some((a) => a.PatientID === 'P-002' && a.Outcome === 'SUCCESS')
    ).toBe(false);
  });

  it('TC-08: Contraindicated drug is the LAST element of ActiveMeds -> blocked on the final loop iteration', async () => {
    // P-003 has ActiveMeds: ['Metformin', 'Atenolol', 'Warfarin']
    const p3 = repo.state.patients.find((p) => p.PatientID === 'P-003');
    expect(p3.ActiveMeds[p3.ActiveMeds.length - 1]).toBe('Warfarin');

    const res = await repo.prescribe({
      user: physician,
      patientId: 'P-003',
      drugName: 'Ibuprofen',
      isOffline: false
    });

    expect(res.ok).toBe(false);
    expect(res.code).toBe('INTERACTION');
    expect(res.message).toBe('Adverse Interaction Detected with Warfarin');
    expect(repo.state.patients.find((p) => p.PatientID === 'P-003').ActiveMeds).toEqual([
      'Metformin',
      'Atenolol',
      'Warfarin'
    ]);
  });

  it('TC-09: Allergy AND interaction both true -> the allergy alert takes precedence', async () => {
    // P-004 is allergic to Penicillin AND taking Warfarin; Amoxicillin triggers both
    const res = await repo.prescribe({
      user: physician,
      patientId: 'P-004',
      drugName: 'Amoxicillin',
      isOffline: false
    });

    expect(res.ok).toBe(false);
    expect(res.code).toBe('ALLERGY');
    expect(res.title).toBe('Severe Allergy Risk');
    expect(repo.state.patients.find((p) => p.PatientID === 'P-004').ActiveMeds).toEqual(['Warfarin']);
  });

  it('TC-10: Several active meds, none contraindicated -> success (no false positive)', () => {
    const patient = {
      PatientID: 'P-MULTI',
      Allergies: [],
      ActiveMeds: ['Metformin', 'Atenolol', 'Warfarin']
    };
    const res = prescribeMedication(physician, patient, 'Paracetamol', DEFAULT_FORMULARY);

    expect(res.ok).toBe(true);
    expect(res.code).toBe('SUCCESS');
    expect(res.drug.DrugName).toBe('Paracetamol');
  });

  it('TC-11: Drug not in the formulary -> rejected, no state change, no exception', async () => {
    const beforeMeds = [...repo.state.patients.find((p) => p.PatientID === 'P-005').ActiveMeds];
    const res = await repo.prescribe({
      user: physician,
      patientId: 'P-005',
      drugName: 'Unobtainium-500',
      isOffline: false
    });

    expect(res.ok).toBe(false);
    expect(res.code).toBe('UNKNOWN_DRUG');
    expect(repo.state.patients.find((p) => p.PatientID === 'P-005').ActiveMeds).toEqual(beforeMeds);
    expect(
      repo.state.audit.some((a) => a.PatientID === 'P-005' && a.Outcome === 'SUCCESS')
    ).toBe(false);
  });
});

describe('NPMS VitalSign Bounds, MEWS Early-Warning Score, Discharge & SHA-256 Audit Chain', () => {
  it('TC-12: VitalSign validates physiological bounds and flags tachycardia and hypoxia', () => {
    const abnormal = new VitalSign({
      HeartRate: 124,
      BloodPressureSystolic: 150,
      BloodPressureDiastolic: 92,
      OxygenSaturation: 89,
      BodyTemperature: 38.7,
      RespiratoryRate: 24,
      AVPU: 'A'
    });
    expect(abnormal.validatePhysiologicalBounds().valid).toBe(true);
    expect(abnormal.isTachycardic()).toBe(true);
    expect(abnormal.isHypoxic()).toBe(true);

    const outOfBounds = new VitalSign({
      HeartRate: 400,
      BloodPressureSystolic: 90,
      BloodPressureDiastolic: 110, // diastolic >= systolic
      OxygenSaturation: 40,
      BodyTemperature: 45.0
    });
    const check = outOfBounds.validatePhysiologicalBounds();
    expect(check.valid).toBe(false);
    expect(check.errors.HeartRate).toBeDefined();
    expect(check.errors.BloodPressureDiastolic).toContain('lower than Systolic');
    expect(check.errors.OxygenSaturation).toBeDefined();
    expect(check.errors.BodyTemperature).toBeDefined();
  });

  it('TC-13: MEWS calculation suggests High (Red) triage for critically ill vitals and supports audited override', () => {
    const mews = calculateMEWSFromVitals({
      HeartRate: 135,
      BloodPressureSystolic: 75,
      BloodPressureDiastolic: 50,
      OxygenSaturation: 88,
      BodyTemperature: 39.1,
      RespiratoryRate: 32,
      AVPU: 'V'
    });
    expect(mews.score).toBeGreaterThanOrEqual(5);
    expect(mews.suggestedTriage).toBe('High');

    const record = new PatientRecord({ PatientID: 'P-001', FullName: 'Naledi Khumalo', TriageLevel: 'Low' });
    const updateRes = record.updateVitals(
      {
        HeartRate: 135,
        BloodPressureSystolic: 75,
        BloodPressureDiastolic: 50,
        OxygenSaturation: 88,
        BodyTemperature: 39.1,
        RespiratoryRate: 32,
        AVPU: 'V'
      },
      'Med' // Nurse overrides High -> Med
    );
    expect(updateRes.ok).toBe(true);
    expect(updateRes.overridden).toBe(true);
    expect(updateRes.finalTriage).toBe('Med');
  });

  it('TC-14: MedicationOrder lifecycle (markAdministered, cancelOrder requires reason) & discharge safety block', () => {
    const order = new MedicationOrder({
      PrescriptionID: 'RX-100',
      PatientID: 'P-003',
      DrugID: 'D-006',
      DrugName: 'Warfarin',
      Status: 'Pending'
    });

    expect(() => order.cancelOrder('')).toThrow(/mandatory clinical reason/i);

    const pModel = new PatientRecord({ PatientID: 'P-003', FullName: 'Zanele Mthembu' });
    const blockedDischarge = pModel.dischargePatient([order.toJSON()]);
    expect(blockedDischarge.ok).toBe(false);
    expect(blockedDischarge.code).toBe('PENDING_MEDS');

    order.markAdministered('N-1001');
    expect(order.Status).toBe('Administered');

    const allowedDischarge = pModel.dischargePatient([order.toJSON()]);
    expect(allowedDischarge.ok).toBe(true);
  });

  it('TC-15: AuditTrail SHA-256 hash chain verifies intact logs and detects tampering', async () => {
    const e1 = await AuditTrail.createChainedEntry(
      { LogID: 'A-1', ActorStaffID: 'N-1001', ActionType: 'Login', Outcome: 'SUCCESS', Detail: 'Init', Ts: 1000 },
      null
    );
    const e2 = await AuditTrail.createChainedEntry(
      { LogID: 'A-2', ActorStaffID: 'P-2001', ActionType: 'Prescribe', Outcome: 'BLOCKED', Detail: 'Allergy', Ts: 2000 },
      e1
    );

    const verifyPass = await AuditTrail.verifyIntegrityHash([e1, e2]);
    expect(verifyPass.valid).toBe(true);
    expect(verifyPass.checkedCount).toBe(2);

    // Tamper with entry #1 detail
    const tampered = [{ ...e1, TransactionDetails: 'Forged detail', Detail: 'Forged detail' }, e2];
    const verifyFail = await AuditTrail.verifyIntegrityHash(tampered);
    expect(verifyFail.valid).toBe(false);
    expect(verifyFail.brokenLogID).toBe('A-1');
  });
});