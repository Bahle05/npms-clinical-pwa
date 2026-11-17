// src/i18n/translations.js
// Lightweight i18n for NPMS. Usage: t(lang, 'key') or t(lang, 'key', { name: 'Naledi' })
// A missing key never crashes the UI: it falls back to English, then to a readable version of the key.

export const translations = {
  en: {
    appName: 'NPMS',
    appTitle: 'Nurse Patient Management System',

    // Navigation
    whiteboard: 'Whiteboard',
    registerPatient: 'Register patient',
    analytics: 'Analytics',
    handover: 'Handover',
    auditTrail: 'Audit trail',
    patients: 'Patients',
    dashboard: 'Dashboard',
    staff: 'Staff',
    backToWhiteboard: 'Back to whiteboard',

    // Session and status
    signIn: 'Sign in',
    signOut: 'Sign out',
    lockScreen: 'Lock screen',
    unlock: 'Unlock',
    onlineSynced: 'ONLINE: SYNCED',
    demoMode: 'DEMO MODE',
    offlineBanner: 'Offline: changes will sync when the connection returns. Prescribing is paused until you are back online.',
    lightMode: 'Light mode',
    darkMode: 'Night mode',
    language: 'Language',
    searchPlaceholder: 'Search patient name, ID or bed...',

    // Triage
    urgent: 'Urgent',
    priority: 'Priority',
    routine: 'Routine',
    triage: 'Triage',
    triageLevel: 'Triage level',
    highPriority: 'High',
    mediumPriority: 'Medium',
    lowPriority: 'Low',

    // Generic actions
    save: 'Save',
    saveRecord: 'Save record',
    cancel: 'Cancel',
    dismiss: 'Dismiss',
    confirm: 'Confirm',
    back: 'Back',
    edit: 'Edit',
    submit: 'Submit',
    search: 'Search',
    filter: 'Filter',
    export: 'Export',
    exportCsv: 'Export CSV',
    print: 'Print',
    loading: 'Loading...',

    // Patient fields
    fullName: 'Full name',
    dateOfBirth: 'Date of birth',
    age: 'Age',
    gender: 'Gender',
    bed: 'Bed',
    assignedBed: 'Assigned bed',
    noBed: 'No bed',
    allergies: 'Allergies',
    allergy: 'Allergy',
    mainComplaint: 'Main complaint',
    status: 'Status',
    admitted: 'Admitted',
    discharged: 'Discharged',
    dischargePatient: 'Discharge patient',
    admissionTime: 'Admission time',
    awaitingVitals: 'Awaiting first vitals',
    waiting: 'Waiting',
    minutes: 'min',

    // Vitals
    vitals: 'Vitals',
    vitalSigns: 'Vital signs',
    recordVitals: 'Record vitals',
    heartRate: 'Heart rate',
    bloodPressure: 'Blood pressure',
    systolic: 'Systolic BP',
    diastolic: 'Diastolic BP',
    oxygenSaturation: 'Oxygen saturation (SpO2)',
    temperature: 'Temperature',
    mews: 'MEWS',
    earlyWarningScore: 'Early warning score',
    suggestedTriage: 'Suggested triage',
    acceptSuggestion: 'Use suggested triage',
    keepCurrent: 'Keep current triage',
    tachycardic: 'Tachycardic',
    hypoxic: 'Hypoxic',
    progressNote: 'Progress note',
    consultationNotes: 'Consultation notes',
    medicalHistory: 'Medical history',

    // Medication
    medications: 'Medications',
    prescriptions: 'Prescriptions',
    newPrescription: 'New prescription',
    prescriptionPad: 'Prescription pad',
    submitPrescription: 'Submit prescription',
    drug: 'Drug',
    dosage: 'Dosage',
    frequency: 'Frequency',
    route: 'Route',
    activeMedication: 'Active medication',
    pending: 'Pending',
    administered: 'Administered',
    cancelled: 'Cancelled',
    markAdministered: 'Mark administered',
    cancelOrder: 'Cancel order',
    cancelReason: 'Reason for cancelling',
    unauthorizedAction: 'Unauthorized Action',
    severeAllergyRisk: 'Severe Allergy Risk',
    adverseInteraction: 'Adverse Interaction Detected',
    prescriptionSafe: 'Prescription safely added to record.',
    noConflicts: 'No allergy or interaction conflicts found.',

    // Audit
    auditLog: 'Audit log',
    verifyIntegrity: 'Verify integrity',
    integrityOk: 'Integrity verified: the audit chain is intact.',
    integrityBroken: 'Integrity check failed: the audit chain has been altered.',
    actor: 'Staff',
    action: 'Action',
    outcome: 'Outcome',
    time: 'Time',
    details: 'Details',

    // Analytics
    admittedPatients: 'Admitted patients',
    bedOccupancy: 'Bed occupancy',
    averageWait: 'Average wait to first vitals',
    blockedToday: 'Prescriptions blocked today',
    pendingMedication: 'Pending medication',

    // Handover
    shiftHandover: 'Shift handover',
    printHandover: 'Print / save as PDF',

    // Login
    staffId: 'Staff ID',
    email: 'Email',
    password: 'Password',
    passwordToUnlock: 'Password to unlock',
    screenLocked: 'Screen locked',
    screenLockedHelp: 'Patient information is hidden to protect privacy (POPIA).'
  },

  // isiZulu: best-effort labels; have a first-language speaker review before the final demo.
  zu: {
    appName: 'NPMS',
    appTitle: 'Uhlelo Lokuphatha Iziguli Zabahlengikazi',

    whiteboard: 'Ibhodi',
    registerPatient: 'Bhalisa isiguli',
    analytics: 'Ukuhlaziya',
    handover: 'Ukudlulisa ishifu',
    auditTrail: 'Irekhodi lezenzo',
    patients: 'Iziguli',
    dashboard: 'Idashibhodi',
    staff: 'Abasebenzi',
    backToWhiteboard: 'Buyela ebhodini',

    signIn: 'Ngena',
    signOut: 'Phuma',
    lockScreen: 'Khiya isikrini',
    unlock: 'Vula',
    onlineSynced: 'KUQHUBEKA: KUVUMELANISIWE',
    demoMode: 'IMODI YOKUBONISA',
    offlineBanner: 'Awunalo ixhumano: izinguquko ziyavumelanisa lapho ixhumano libuya.',
    lightMode: 'Imodi yokukhanya',
    darkMode: 'Imodi yobusuku',
    language: 'Ulimi',
    searchPlaceholder: 'Sesha igama, i-ID noma umbhede...',

    urgent: 'Ngokushesha',
    priority: 'Kubalulekile',
    routine: 'Okujwayelekile',
    triage: 'Ukuhlunga',
    triageLevel: 'Izinga lokuhlunga',

    save: 'Gcina',
    saveRecord: 'Gcina irekhodi',
    cancel: 'Khansela',
    dismiss: 'Vala',
    confirm: 'Qinisekisa',
    back: 'Emuva',
    submit: 'Thumela',
    search: 'Sesha',
    print: 'Phrinta',
    loading: 'Iyalayisha...',

    fullName: 'Igama eliphelele',
    dateOfBirth: 'Usuku lokuzalwa',
    age: 'Iminyaka',
    gender: 'Ubulili',
    bed: 'Umbhede',
    allergies: 'Ukungezwani komzimba',
    mainComplaint: 'Isikhalo esikhulu',
    status: 'Isimo',
    admitted: 'Ilaliswe',
    discharged: 'Ikhishiwe',
    dischargePatient: 'Khipha isiguli',

    vitals: 'Izimpawu ezibalulekile',
    recordVitals: 'Rekhoda izimpawu',
    heartRate: 'Ukushaya kwenhliziyo',
    temperature: 'Izinga lokushisa',

    medications: 'Imithi',
    prescriptions: 'Imishuwalense',
    newPrescription: 'Umbhalo omusha wemithi',
    pending: 'Kulindile',
    administered: 'Inikeziwe',
    cancelled: 'Kukhanseliwe',

    auditLog: 'Irekhodi lokuhlola',
    staffId: 'I-ID yesisebenzi',
    password: 'Iphasiwedi'
  }
};

export const languages = [
  { code: 'en', label: 'English' },
  { code: 'zu', label: 'isiZulu' }
];

// "someCamelCaseKey" -> "Some camel case key" (last-resort display text)
function humanize(key) {
  const spaced = String(key).replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export function t(lang, key, vars) {
  const dict = translations[lang] || translations.en;
  let text = dict[key];
  if (text === undefined) text = translations.en[key];
  if (text === undefined) text = humanize(key);
  if (vars) {
    text = text.replace(/\{(\w+)\}/g, (m, name) => (vars[name] !== undefined ? String(vars[name]) : m));
  }
  return text;
}

export default t;