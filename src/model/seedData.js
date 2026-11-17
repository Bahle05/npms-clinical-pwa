import { hashPassword } from './StaffUser.js';
import { DEFAULT_FORMULARY } from '../controller/SmartPrescriptionEngine.js';
import { calculateMEWSFromVitals } from './PatientRecord.js';

export function buildSeedData() {
  const users = [
    {
      StaffID: 'N-1001',
      FullName: 'Sr. Thandi Mokoena',
      Role: 'Nurse',
      Email: 'n1001@npms.org.za',
      PasswordHash: hashPassword('nurse123'),
      LastLoginTime: '2026-11-08 07:45',
      IsActive: true
    },
    {
      StaffID: 'N-1002',
      FullName: 'RN Lerato Dlamini',
      Role: 'Nurse',
      Email: 'n1002@npms.org.za',
      PasswordHash: hashPassword('nurse456'),
      LastLoginTime: '2026-11-08 07:50',
      IsActive: true
    },
    {
      StaffID: 'P-2001',
      FullName: 'Dr. Sipho Nkosi',
      Role: 'Physician',
      Email: 'p2001@npms.org.za',
      PasswordHash: hashPassword('doctor123'),
      LastLoginTime: '2026-11-08 08:00',
      IsActive: true
    }
  ];

  // 3NF DRUG_INTERACTION normalized rows derived from formulary
  const drugInteractions = [
    { InteractionID: 'INT-001', DrugID: 'D-001', DrugName: 'Amoxicillin', ConflictingDrugID: 'D-006', ConflictingDrugName: 'Warfarin' },
    { InteractionID: 'INT-002', DrugID: 'D-003', DrugName: 'Ibuprofen', ConflictingDrugID: 'D-006', ConflictingDrugName: 'Warfarin' },
    { InteractionID: 'INT-003', DrugID: 'D-003', DrugName: 'Ibuprofen', ConflictingDrugID: 'D-004', ConflictingDrugName: 'Aspirin' },
    { InteractionID: 'INT-004', DrugID: 'D-004', DrugName: 'Aspirin', ConflictingDrugID: 'D-006', ConflictingDrugName: 'Warfarin' },
    { InteractionID: 'INT-005', DrugID: 'D-004', DrugName: 'Aspirin', ConflictingDrugID: 'D-003', ConflictingDrugName: 'Ibuprofen' },
    { InteractionID: 'INT-006', DrugID: 'D-006', DrugName: 'Warfarin', ConflictingDrugID: 'D-003', ConflictingDrugName: 'Ibuprofen' },
    { InteractionID: 'INT-007', DrugID: 'D-006', DrugName: 'Warfarin', ConflictingDrugID: 'D-004', ConflictingDrugName: 'Aspirin' },
    { InteractionID: 'INT-008', DrugID: 'D-006', DrugName: 'Warfarin', ConflictingDrugID: 'D-001', ConflictingDrugName: 'Amoxicillin' }
  ];

  // VITAL_SIGN records across multiple patients (including trend history)
  const rawVitals = [
    {
      VitalID: 'V-001',
      PatientID: 'P-002',
      RecordedByStaffID: 'N-1001',
      HeartRate: 108,
      BloodPressureSystolic: 162,
      BloodPressureDiastolic: 98,
      OxygenSaturation: 91,
      BodyTemperature: 37.4,
      RespiratoryRate: 22,
      AVPU: 'A',
      RecordedTimestamp: '2026-11-08 08:22'
    },
    {
      VitalID: 'V-002',
      PatientID: 'P-002',
      RecordedByStaffID: 'N-1001',
      HeartRate: 104,
      BloodPressureSystolic: 158,
      BloodPressureDiastolic: 96,
      OxygenSaturation: 93,
      BodyTemperature: 37.2,
      RespiratoryRate: 20,
      AVPU: 'A',
      RecordedTimestamp: '2026-11-08 08:45'
    },
    {
      VitalID: 'V-003',
      PatientID: 'P-003',
      RecordedByStaffID: 'N-1002',
      HeartRate: 76,
      BloodPressureSystolic: 138,
      BloodPressureDiastolic: 84,
      OxygenSaturation: 97,
      BodyTemperature: 36.7,
      RespiratoryRate: 16,
      AVPU: 'A',
      RecordedTimestamp: '2026-11-08 08:40'
    },
    {
      VitalID: 'V-004',
      PatientID: 'P-001',
      RecordedByStaffID: 'N-1001',
      HeartRate: 92,
      BloodPressureSystolic: 118,
      BloodPressureDiastolic: 76,
      OxygenSaturation: 96,
      BodyTemperature: 38.1,
      RespiratoryRate: 19,
      AVPU: 'A',
      RecordedTimestamp: '2026-11-08 09:00'
    },
    {
      VitalID: 'V-005',
      PatientID: 'P-004',
      RecordedByStaffID: 'N-1002',
      HeartRate: 114,
      BloodPressureSystolic: 146,
      BloodPressureDiastolic: 90,
      OxygenSaturation: 94,
      BodyTemperature: 38.6,
      RespiratoryRate: 22,
      AVPU: 'A',
      RecordedTimestamp: '2026-11-08 09:05'
    },
    {
      VitalID: 'V-006',
      PatientID: 'P-005',
      RecordedByStaffID: 'N-1001',
      HeartRate: 72,
      BloodPressureSystolic: 120,
      BloodPressureDiastolic: 78,
      OxygenSaturation: 99,
      BodyTemperature: 36.6,
      RespiratoryRate: 14,
      AVPU: 'A',
      RecordedTimestamp: '2026-11-08 09:20'
    }
  ];

  const vitals = rawVitals.map((v) => {
    const mews = calculateMEWSFromVitals(v);
    return {
      ...v,
      IsTachycardic: v.HeartRate > 100,
      IsHypoxic: v.OxygenSaturation < 92,
      MEWSScore: mews.score
    };
  });

  const lastVitalFor = (pid) => {
    const list = vitals.filter((v) => v.PatientID === pid);
    return list.length ? list[list.length - 1] : null;
  };

  // PATIENT records (P-001 to P-005 matching seed specification + 3NF fields)
  const patients = [
    {
      PatientID: 'P-001',
      NationalID: '0000000000001',
      FullName: 'Naledi Khumalo',
      DOB: '1987-03-14',
      Age: 39,
      Gender: 'Female',
      AssignedBed: 'Bed A-01',
      TriageLevel: 'Med',
      Allergies: ['Penicillin'],
      MainComplaint: 'Persistent cough and fever',
      ActiveMeds: [],
      AdmissionTimestamp: '2026-11-08 08:05',
      Arrived: '08:05',
      Status: 'Admitted',
      LastVitals: lastVitalFor('P-001'),
      MEWSScore: lastVitalFor('P-001')?.MEWSScore ?? 2
    },
    {
      PatientID: 'P-002',
      NationalID: '0000000000002',
      FullName: 'Johan van Wyk',
      DOB: '1954-11-02',
      Age: 72,
      Gender: 'Male',
      AssignedBed: 'Resus-01',
      TriageLevel: 'High',
      Allergies: [],
      MainComplaint: 'Chest tightness and shortness of breath',
      ActiveMeds: ['Warfarin'],
      AdmissionTimestamp: '2026-11-08 08:20',
      Arrived: '08:20',
      Status: 'Admitted',
      LastVitals: lastVitalFor('P-002'),
      MEWSScore: lastVitalFor('P-002')?.MEWSScore ?? 4
    },
    {
      PatientID: 'P-003',
      NationalID: '0000000000003',
      FullName: 'Zanele Mthembu',
      DOB: '1962-07-29',
      Age: 64,
      Gender: 'Female',
      AssignedBed: 'Bed B-03',
      TriageLevel: 'Med',
      Allergies: [],
      MainComplaint: 'Chronic disease review (Hypertension & Type 2 Diabetes)',
      ActiveMeds: ['Metformin', 'Atenolol', 'Warfarin'],
      AdmissionTimestamp: '2026-11-08 08:35',
      Arrived: '08:35',
      Status: 'Admitted',
      LastVitals: lastVitalFor('P-003'),
      MEWSScore: lastVitalFor('P-003')?.MEWSScore ?? 1
    },
    {
      PatientID: 'P-004',
      NationalID: '0000000000004',
      FullName: 'Sibusiso Ndlovu',
      DOB: '1975-01-18',
      Age: 51,
      Gender: 'Male',
      AssignedBed: 'Resus-02',
      TriageLevel: 'High',
      Allergies: ['Penicillin'],
      MainComplaint: 'Post-traumatic lower limb wound infection',
      ActiveMeds: ['Warfarin'],
      AdmissionTimestamp: '2026-11-08 08:50',
      Arrived: '08:50',
      Status: 'Admitted',
      LastVitals: lastVitalFor('P-004'),
      MEWSScore: lastVitalFor('P-004')?.MEWSScore ?? 5
    },
    {
      PatientID: 'P-005',
      NationalID: '0000000000005',
      FullName: 'Amahle Jacobs',
      DOB: '1999-09-09',
      Age: 27,
      Gender: 'Female',
      AssignedBed: 'Bed C-02',
      TriageLevel: 'Low',
      Allergies: [],
      MainComplaint: 'Mild tension headache',
      ActiveMeds: [],
      AdmissionTimestamp: '2026-11-08 09:10',
      Arrived: '09:10',
      Status: 'Admitted',
      LastVitals: lastVitalFor('P-005'),
      MEWSScore: lastVitalFor('P-005')?.MEWSScore ?? 0
    }
  ];

  // 3NF PATIENT_ALLERGY normalized rows
  const patientAllergies = [
    { AllergyID: 'ALG-001', PatientID: 'P-001', Allergen: 'Penicillin', AllergenType: 'Family', RecordedTimestamp: '2026-11-08 08:05' },
    { AllergyID: 'ALG-002', PatientID: 'P-004', Allergen: 'Penicillin', AllergenType: 'Family', RecordedTimestamp: '2026-11-08 08:50' }
  ];

  // CONSULTATION_NOTE records
  const consultations = [
    {
      ConsultID: 'C-001',
      PatientID: 'P-002',
      StaffID: 'N-1001',
      VitalID: 'V-002',
      Timestamp: '2026-11-08 08:45',
      Systolic: 158,
      Diastolic: 96,
      HeartRate: 104,
      OxygenSaturation: 93,
      BodyTemperature: 37.2,
      ProgressReport: 'Patient reports chest tightness on exertion. Warfarin adherence confirmed. Placed on continuous pulse oximetry.'
    },
    {
      ConsultID: 'C-002',
      PatientID: 'P-003',
      StaffID: 'N-1002',
      VitalID: 'V-003',
      Timestamp: '2026-11-08 08:40',
      Systolic: 138,
      Diastolic: 84,
      HeartRate: 76,
      OxygenSaturation: 97,
      BodyTemperature: 36.7,
      ProgressReport: 'Routine chronic review. Blood pressure borderline; counselled on low-sodium diet and medication schedule.'
    },
    {
      ConsultID: 'C-003',
      PatientID: 'P-001',
      StaffID: 'N-1001',
      VitalID: 'V-004',
      Timestamp: '2026-11-08 09:00',
      Systolic: 118,
      Diastolic: 76,
      HeartRate: 92,
      OxygenSaturation: 96,
      BodyTemperature: 38.1,
      ProgressReport: 'Productive cough for four days, low-grade pyrexia 38.1°C. Severe Penicillin allergy wristband applied.'
    },
    {
      ConsultID: 'C-004',
      PatientID: 'P-004',
      StaffID: 'N-1002',
      VitalID: 'V-005',
      Timestamp: '2026-11-08 09:05',
      Systolic: 146,
      Diastolic: 90,
      HeartRate: 114,
      OxygenSaturation: 94,
      BodyTemperature: 38.6,
      ProgressReport: 'Infected laceration on right shin with surrounding erythema. Tachycardic (114 bpm) and febrile (38.6°C).'
    }
  ];

  // PRESCRIPTION records
  const prescriptions = [
    {
      PrescriptionID: 'RX-001',
      PatientID: 'P-002',
      PrescribingDoctorID: 'P-2001',
      StaffID: 'P-2001',
      DrugID: 'D-006',
      DrugName: 'Warfarin',
      AuthorizedDosage: '5mg',
      Route: 'PO',
      Frequency: 'Daily',
      Status: 'Administered',
      AuthorizationTimestamp: '2026-11-08 08:30',
      DateAuthorized: '2026-11-08 08:30',
      AdministeredByNurseID: 'N-1001',
      AdministeredTimestamp: '2026-11-08 08:50'
    },
    {
      PrescriptionID: 'RX-002',
      PatientID: 'P-003',
      PrescribingDoctorID: 'P-2001',
      StaffID: 'P-2001',
      DrugID: 'D-007',
      DrugName: 'Metformin',
      AuthorizedDosage: '850mg',
      Route: 'PO',
      Frequency: 'BD',
      Status: 'Administered',
      AuthorizationTimestamp: '2026-11-08 08:42',
      DateAuthorized: '2026-11-08 08:42',
      AdministeredByNurseID: 'N-1002',
      AdministeredTimestamp: '2026-11-08 08:55'
    },
    {
      PrescriptionID: 'RX-003',
      PatientID: 'P-003',
      PrescribingDoctorID: 'P-2001',
      StaffID: 'P-2001',
      DrugID: 'D-008',
      DrugName: 'Atenolol',
      AuthorizedDosage: '50mg',
      Route: 'PO',
      Frequency: 'Daily',
      Status: 'Administered',
      AuthorizationTimestamp: '2026-11-08 08:43',
      DateAuthorized: '2026-11-08 08:43',
      AdministeredByNurseID: 'N-1002',
      AdministeredTimestamp: '2026-11-08 08:56'
    },
    {
      PrescriptionID: 'RX-004',
      PatientID: 'P-003',
      PrescribingDoctorID: 'P-2001',
      StaffID: 'P-2001',
      DrugID: 'D-006',
      DrugName: 'Warfarin',
      AuthorizedDosage: '5mg',
      Route: 'PO',
      Frequency: 'Daily',
      Status: 'Pending',
      AuthorizationTimestamp: '2026-11-08 08:44',
      DateAuthorized: '2026-11-08 08:44',
      AdministeredByNurseID: null,
      AdministeredTimestamp: null
    },
    {
      PrescriptionID: 'RX-005',
      PatientID: 'P-004',
      PrescribingDoctorID: 'P-2001',
      StaffID: 'P-2001',
      DrugID: 'D-006',
      DrugName: 'Warfarin',
      AuthorizedDosage: '5mg',
      Route: 'PO',
      Frequency: 'Daily',
      Status: 'Pending',
      AuthorizationTimestamp: '2026-11-08 09:08',
      DateAuthorized: '2026-11-08 09:08',
      AdministeredByNurseID: null,
      AdministeredTimestamp: null
    }
  ];

  return {
    users,
    patients,
    patientAllergies,
    vitals,
    consultations,
    prescriptions,
    formulary: DEFAULT_FORMULARY,
    drugInteractions,
    audit: []
  };
}