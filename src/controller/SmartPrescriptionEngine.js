import { normalizeRole } from '../model/StaffUser.js';

export function norm(s) {
  return String(s == null ? '' : s).trim().toLowerCase();
}

export const DEFAULT_FORMULARY = [
  {
    DrugID: 'D-001',
    DrugName: 'Amoxicillin',
    DrugFamily: 'Penicillin',
    PharmaceuticalFamily: 'Penicillin',
    StandardDosage: '500mg',
    Route: 'PO',
    Contraindications: ['Warfarin']
  },
  {
    DrugID: 'D-002',
    DrugName: 'Penicillin V',
    DrugFamily: 'Penicillin',
    PharmaceuticalFamily: 'Penicillin',
    StandardDosage: '500mg',
    Route: 'PO',
    Contraindications: []
  },
  {
    DrugID: 'D-003',
    DrugName: 'Ibuprofen',
    DrugFamily: 'NSAID',
    PharmaceuticalFamily: 'NSAID',
    StandardDosage: '400mg',
    Route: 'PO',
    Contraindications: ['Warfarin', 'Aspirin']
  },
  {
    DrugID: 'D-004',
    DrugName: 'Aspirin',
    DrugFamily: 'NSAID',
    PharmaceuticalFamily: 'NSAID',
    StandardDosage: '300mg',
    Route: 'PO',
    Contraindications: ['Warfarin', 'Ibuprofen']
  },
  {
    DrugID: 'D-005',
    DrugName: 'Paracetamol',
    DrugFamily: 'Analgesic',
    PharmaceuticalFamily: 'Analgesic',
    StandardDosage: '1000mg',
    Route: 'PO',
    Contraindications: []
  },
  {
    DrugID: 'D-006',
    DrugName: 'Warfarin',
    DrugFamily: 'Anticoagulant',
    PharmaceuticalFamily: 'Anticoagulant',
    StandardDosage: '5mg',
    Route: 'PO',
    Contraindications: ['Ibuprofen', 'Aspirin', 'Amoxicillin']
  },
  {
    DrugID: 'D-007',
    DrugName: 'Metformin',
    DrugFamily: 'Biguanide',
    PharmaceuticalFamily: 'Biguanide',
    StandardDosage: '850mg',
    Route: 'PO',
    Contraindications: []
  },
  {
    DrugID: 'D-008',
    DrugName: 'Atenolol',
    DrugFamily: 'Beta blocker',
    PharmaceuticalFamily: 'Beta blocker',
    StandardDosage: '50mg',
    Route: 'PO',
    Contraindications: []
  }
];

/**
 * Pure defensive prescription pipeline (Design Model Section 1.4).
 * Exact order:
 *   1. RBAC: Only Physician may prescribe -> UNAUTHORIZED
 *   2. Drug lookup in formulary -> VALIDATION / UNKNOWN_DRUG
 *   3. Allergy check (drug name OR drug family, case-insensitive) -> ALLERGY
 *   4. Active contraindications loop over ActiveMeds -> INTERACTION
 *   5. Success -> returns drugInfo without mutating input arguments.
 */
export function prescribeMedication(currentUser, targetPatient, selectedDrug, drugs = DEFAULT_FORMULARY) {
  // Step 1: Role-Based Access Control
  const role = currentUser ? normalizeRole(currentUser.Role) : '';
  if (!currentUser || role !== 'Physician') {
    return {
      ok: false,
      code: 'UNAUTHORIZED',
      title: 'Unauthorized Action',
      message: 'Unauthorized Action: Only physicians may prescribe.'
    };
  }

  // Step 2: Formulary lookup & input validation
  const name = String(selectedDrug == null ? '' : selectedDrug).trim();
  if (!name) {
    return {
      ok: false,
      code: 'VALIDATION',
      title: 'Drug required',
      message: 'Select or type a drug name from the formulary.'
    };
  }

  const catalog = Array.isArray(drugs) && drugs.length > 0 ? drugs : DEFAULT_FORMULARY;
  const drugInfo = catalog.find((d) => norm(d.DrugName) === norm(name));
  if (!drugInfo) {
    return {
      ok: false,
      code: 'UNKNOWN_DRUG',
      title: 'Drug not found',
      message: `"${name}" is not in the formulary. Choose a listed drug.`
    };
  }

  const family = drugInfo.DrugFamily || drugInfo.PharmaceuticalFamily || '';

  // Step 3: Check 1 - Severe allergy (drug name OR drug family), case-insensitive
  const allergies = ((targetPatient && targetPatient.Allergies) || []).map(norm);
  if (allergies.includes(norm(drugInfo.DrugName)) || (family && allergies.includes(norm(family)))) {
    return {
      ok: false,
      code: 'ALLERGY',
      title: 'Severe Allergy Risk',
      message: `Prescribing blocked: Severe Allergy Risk (${drugInfo.DrugName} / ${family} family).`
    };
  }

  // Step 4: Check 2 - Active contraindications (loop over ActiveMeds in order)
  const contra = (drugInfo.Contraindications || []).map(norm);
  const active = (targetPatient && targetPatient.ActiveMeds) || [];
  for (let i = 0; i < active.length; i++) {
    if (contra.includes(norm(active[i]))) {
      return {
        ok: false,
        code: 'INTERACTION',
        title: 'Adverse Interaction Detected',
        message: `Adverse Interaction Detected with ${active[i]}`
      };
    }
  }

  // Step 5: Success path (pure: caller commits ActiveMeds + Prescription + Audit)
  return {
    ok: true,
    code: 'SUCCESS',
    title: 'Prescription authorized',
    drug: drugInfo,
    message: 'Prescription safely added to record.'
  };
}

export class SmartPrescriptionEngine {
  constructor(formularyCatalog = DEFAULT_FORMULARY) {
    this.formularyCatalog = formularyCatalog;
  }

  checkAllergyConflict(drugInfo, patient) {
    if (!drugInfo || !patient) return { conflict: false };
    const family = drugInfo.DrugFamily || drugInfo.PharmaceuticalFamily || '';
    const allergies = (patient.Allergies || []).map(norm);
    const matched =
      allergies.includes(norm(drugInfo.DrugName)) ||
      (family && allergies.includes(norm(family)));
    return {
      conflict: Boolean(matched),
      message: matched
        ? `Severe Allergy Risk: Patient is allergic to ${drugInfo.DrugName} (${family} family).`
        : null
    };
  }

  validateInteraction(drugInfo, patient) {
    if (!drugInfo || !patient) return { conflict: false };
    const contra = (drugInfo.Contraindications || []).map(norm);
    const active = patient.ActiveMeds || [];
    for (let i = 0; i < active.length; i++) {
      if (contra.includes(norm(active[i]))) {
        return {
          conflict: true,
          conflictingDrug: active[i],
          message: `Adverse Interaction Detected with ${active[i]}`
        };
      }
    }
    return { conflict: false, conflictingDrug: null, message: null };
  }

  /**
   * Used by the UI Prescription Pad to show live warnings as soon as a drug is selected,
   * before the form is even submitted.
   */
  livePreCheck(selectedDrugName, patient) {
    const clean = norm(selectedDrugName);
    if (!clean) return { status: 'IDLE' };
    const drugInfo = this.formularyCatalog.find((d) => norm(d.DrugName) === clean);
    if (!drugInfo) {
      return {
        status: 'UNKNOWN',
        message: `"${selectedDrugName}" is not in the clinic formulary.`
      };
    }
    const allergy = this.checkAllergyConflict(drugInfo, patient);
    if (allergy.conflict) {
      return {
        status: 'ALLERGY',
        drug: drugInfo,
        title: 'Severe Allergy Risk',
        message: allergy.message
      };
    }
    const interaction = this.validateInteraction(drugInfo, patient);
    if (interaction.conflict) {
      return {
        status: 'INTERACTION',
        drug: drugInfo,
        title: 'Adverse Interaction Detected',
        message: interaction.message
      };
    }
    return {
      status: 'SAFE',
      drug: drugInfo,
      title: 'Safety Pre-check Passed',
      message: `No allergy or interaction conflicts found for ${drugInfo.DrugName} (${drugInfo.StandardDosage} ${drugInfo.Route}).`
    };
  }

  authorizePrescription(currentUser, targetPatient, selectedDrug) {
    return prescribeMedication(currentUser, targetPatient, selectedDrug, this.formularyCatalog);
  }
}