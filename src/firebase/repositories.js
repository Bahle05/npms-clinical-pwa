import { initializeApp, getApps } from 'firebase/app';
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as fbSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  onSnapshot,
  runTransaction,
  writeBatch,
  query,
  orderBy
} from 'firebase/firestore';

import { FIREBASE_CONFIG, isFirebaseConfigured } from './config.js';
import { buildSeedData } from '../model/seedData.js';
import { prescribeMedication } from '../controller/SmartPrescriptionEngine.js';
import { formatClinicalStamp, transitionMedicationOrder } from '../controller/ClinicalController.js';
import { AuditTrail } from '../model/AuditTrail.js';
import { hashPassword } from '../model/StaffUser.js';

const maxIdNum = (list, key) =>
  Math.max(0, ...list.map((x) => parseInt(String(x[key] || '').replace(/\D/g, ''), 10) || 0));

/**
 * In-Memory Repository implementation (used when Firebase config is empty or for unit testing).
 * Mirrors the exact async contract of FirestoreRepository.
 */
export class InMemoryRepository {
  constructor(initialSeed = null) {
    this.mode = 'memory';
    this.state = initialSeed || buildSeedData();
    this.listeners = new Set();
    this._initAuditGenesis();
  }

  async _initAuditGenesis() {
    if (this.state.audit.length === 0) {
      const first = await AuditTrail.createChainedEntry(
        {
          LogID: 'A-GENESIS-001',
          ActorStaffID: 'SYSTEM',
          PatientID: '-',
          ActionType: 'System Initialized',
          Outcome: 'SUCCESS',
          TransactionDetails: 'NPMS Clinical Repository initialized with 3NF seed data.',
          Ts: Date.now() - 3600000
        },
        null
      );
      this.state.audit = [first];
      this._emit();
    }
  }

  _emit() {
    const snapshot = {
      users: [...this.state.users],
      formulary: [...this.state.formulary],
      patients: [...this.state.patients],
      vitals: [...this.state.vitals],
      consultations: [...this.state.consultations],
      prescriptions: [...this.state.prescriptions],
      audit: [...this.state.audit]
    };
    this.listeners.forEach((cb) => cb(snapshot));
  }

  subscribe(onData) {
    this.listeners.add(onData);
    this._emit();
    return () => this.listeners.delete(onData);
  }

  async signIn(identifier, password) {
    const clean = String(identifier || '').trim().toLowerCase();
    const user = this.state.users.find(
      (u) => u.StaffID.toLowerCase() === clean || (u.Email && u.Email.toLowerCase() === clean)
    );
    if (!user || !user.IsActive || user.PasswordHash !== hashPassword(password)) {
      throw new Error('Invalid Staff ID / Email or password.');
    }
    await this.appendAudit({
      ActorStaffID: user.StaffID,
      PatientID: '-',
      ActionType: 'Staff Sign In',
      Outcome: 'SUCCESS',
      TransactionDetails: `${user.FullName} (${user.Role}) authenticated.`
    });
    return user;
  }

  async signOut(user) {
    if (user) {
      await this.appendAudit({
        ActorStaffID: user.StaffID,
        PatientID: '-',
        ActionType: 'Staff Sign Out',
        Outcome: 'SUCCESS',
        TransactionDetails: `${user.FullName} signed out.`
      });
    }
  }

  async appendAudit(entry) {
    const sorted = [...this.state.audit].sort((a, b) => (a.Ts || 0) - (b.Ts || 0));
    const prev = sorted.length > 0 ? sorted[sorted.length - 1] : null;
    const chained = await AuditTrail.createChainedEntry(entry, prev);
    this.state.audit = [...this.state.audit, chained];
    this._emit();
    return chained;
  }

  async addPatient(patientData, actorUser) {
    const id = 'P-' + String(maxIdNum(this.state.patients, 'PatientID') + 1).padStart(3, '0');
    const record = { ...patientData, PatientID: id };
    this.state.patients = [...this.state.patients, record];
    // Normalized 3NF PATIENT_ALLERGY rows
    const newAllergies = (record.Allergies || []).map((alg, idx) => ({
      AllergyID: `ALG-${id}-${idx + 1}`,
      PatientID: id,
      Allergen: alg,
      AllergenType: 'Drug/Family',
      RecordedTimestamp: record.AdmissionTimestamp
    }));
    this.state.patientAllergies = [...this.state.patientAllergies, ...newAllergies];
    await this.appendAudit({
      ActorStaffID: actorUser.StaffID,
      PatientID: id,
      ActionType: 'Register patient',
      Outcome: 'SUCCESS',
      TransactionDetails: `Registered ${record.FullName} (Bed: ${record.AssignedBed}, Triage: ${record.TriageLevel})`
    });
    this._emit();
    return id;
  }

  async updatePatientBed(patientId, newBed, actorUser) {
    this.state.patients = this.state.patients.map((p) =>
      p.PatientID === patientId ? { ...p, AssignedBed: newBed } : p
    );
    await this.appendAudit({
      ActorStaffID: actorUser.StaffID,
      PatientID: patientId,
      ActionType: 'Assign bed',
      Outcome: 'SUCCESS',
      TransactionDetails: `Assigned bed updated to ${newBed}`
    });
    this._emit();
  }

  async recordVitalsAndConsult({ patientId, vitalRecord, finalTriage, overridden, suggestedTriage, progressReport, actorUser }) {
    const vitalId = 'V-' + String(maxIdNum(this.state.vitals, 'VitalID') + 1).padStart(3, '0');
    const fullVital = { ...vitalRecord, VitalID: vitalId, PatientID: patientId, RecordedByStaffID: actorUser.StaffID };
    this.state.vitals = [...this.state.vitals, fullVital];

    if (progressReport && progressReport.trim()) {
      const consultId = 'C-' + String(maxIdNum(this.state.consultations, 'ConsultID') + 1).padStart(3, '0');
      this.state.consultations = [
        ...this.state.consultations,
        {
          ConsultID: consultId,
          PatientID: patientId,
          StaffID: actorUser.StaffID,
          VitalID: vitalId,
          Timestamp: fullVital.RecordedTimestamp,
          Systolic: fullVital.BloodPressureSystolic,
          Diastolic: fullVital.BloodPressureDiastolic,
          HeartRate: fullVital.HeartRate,
          OxygenSaturation: fullVital.OxygenSaturation,
          BodyTemperature: fullVital.BodyTemperature,
          ProgressReport: progressReport.trim()
        }
      ];
    }

    this.state.patients = this.state.patients.map((p) =>
      p.PatientID === patientId
        ? { ...p, LastVitals: fullVital, MEWSScore: fullVital.MEWSScore, TriageLevel: finalTriage }
        : p
    );

    const detail = `BP ${fullVital.BloodPressureSystolic}/${fullVital.BloodPressureDiastolic}, HR ${fullVital.HeartRate} bpm, SpO2 ${fullVital.OxygenSaturation}%, Temp ${fullVital.BodyTemperature}°C, MEWS ${fullVital.MEWSScore}`;
    await this.appendAudit({
      ActorStaffID: actorUser.StaffID,
      PatientID: patientId,
      ActionType: overridden ? 'Log vitals (Triage Override)' : 'Log vitals',
      Outcome: 'SUCCESS',
      TransactionDetails: overridden
        ? `${detail} | Override: MEWS suggested ${suggestedTriage}, staff selected ${finalTriage}`
        : detail
    });
    this._emit();
    return fullVital;
  }

  async prescribe({ user, patientId, drugName, dosage, route, frequency, isOffline }) {
    if (isOffline) {
      return {
        ok: false,
        code: 'OFFLINE_BLOCKED',
        title: 'Offline Safety Lock',
        message: 'Prescription authorization is blocked while offline because the safety engine requires a live transaction against the freshest patient record.'
      };
    }
    const patient = this.state.patients.find((p) => p.PatientID === patientId);
    if (!patient) {
      return { ok: false, code: 'NOT_FOUND', title: 'Patient not found', message: 'Patient record does not exist.' };
    }

    const r = prescribeMedication(user, patient, drugName, this.state.formulary);
    if (r.ok) {
      const rxId = 'RX-' + String(maxIdNum(this.state.prescriptions, 'PrescriptionID') + 1).padStart(3, '0');
      const now = formatClinicalStamp();
      const newOrder = {
        PrescriptionID: rxId,
        PatientID: patientId,
        PrescribingDoctorID: user.StaffID,
        StaffID: user.StaffID,
        DrugID: r.drug.DrugID,
        DrugName: r.drug.DrugName,
        AuthorizedDosage: dosage || r.drug.StandardDosage || 'Standard',
        Route: route || r.drug.Route || 'PO',
        Frequency: frequency || 'BD',
        Status: 'Pending',
        AuthorizationTimestamp: now,
        DateAuthorized: now,
        AdministeredByNurseID: null,
        AdministeredTimestamp: null
      };
      this.state.prescriptions = [...this.state.prescriptions, newOrder];
      this.state.patients = this.state.patients.map((p) =>
        p.PatientID === patientId
          ? {
              ...p,
              ActiveMeds: p.ActiveMeds.includes(r.drug.DrugName)
                ? p.ActiveMeds
                : [...p.ActiveMeds, r.drug.DrugName]
            }
          : p
      );
      await this.appendAudit({
        ActorStaffID: user.StaffID,
        PatientID: patientId,
        ActionType: 'Prescribe medication',
        Outcome: 'SUCCESS',
        TransactionDetails: `${r.drug.DrugName} (${newOrder.AuthorizedDosage} ${newOrder.Route} ${newOrder.Frequency}) — Status: Pending`
      });
      this._emit();
    } else if (['UNAUTHORIZED', 'ALLERGY', 'INTERACTION'].includes(r.code)) {
      await this.appendAudit({
        ActorStaffID: user ? user.StaffID : 'UNKNOWN',
        PatientID: patientId,
        ActionType: 'Prescribe medication',
        Outcome: 'BLOCKED',
        TransactionDetails: `${r.title}: ${drugName} (${r.message})`
      });
      this._emit();
    }
    return r;
  }

  async updateMedicationStatus({ prescriptionId, action, actorUser, reason = '' }) {
    const target = this.state.prescriptions.find((r) => r.PrescriptionID === prescriptionId);
    if (!target) return { ok: false, message: 'Prescription not found.' };
    const patientOrders = this.state.prescriptions.filter((r) => r.PatientID === target.PatientID);
    const res = transitionMedicationOrder(target, action, actorUser, reason, patientOrders);
    if (!res.ok) return res;

    this.state.prescriptions = this.state.prescriptions.map((r) =>
      r.PrescriptionID === prescriptionId ? res.order : r
    );
    this.state.patients = this.state.patients.map((p) =>
      p.PatientID === target.PatientID ? { ...p, ActiveMeds: res.activeMeds } : p
    );

    await this.appendAudit({
      ActorStaffID: actorUser.StaffID,
      PatientID: target.PatientID,
      ActionType: action === 'ADMINISTER' ? 'Administer medication' : 'Cancel prescription',
      Outcome: 'SUCCESS',
      TransactionDetails:
        action === 'ADMINISTER'
          ? `Administered ${target.DrugName} (${prescriptionId})`
          : `Cancelled ${target.DrugName} (${prescriptionId}) — Reason: ${reason}`
    });
    this._emit();
    return res;
  }

  async dischargePatient(patientId, actorUser) {
    const patient = this.state.patients.find((p) => p.PatientID === patientId);
    if (!patient) return { ok: false, title: 'Not found', message: 'Patient not found.' };
    const pModel = new (await import('../model/PatientRecord.js')).PatientRecord(patient);
    const res = pModel.dischargePatient(this.state.prescriptions);
    if (!res.ok) {
      await this.appendAudit({
        ActorStaffID: actorUser.StaffID,
        PatientID: patientId,
        ActionType: 'Discharge patient',
        Outcome: 'BLOCKED',
        TransactionDetails: res.message
      });
      this._emit();
      return res;
    }
    this.state.patients = this.state.patients.map((p) =>
      p.PatientID === patientId ? pModel.toJSON() : p
    );
    await this.appendAudit({
      ActorStaffID: actorUser.StaffID,
      PatientID: patientId,
      ActionType: 'Discharge patient',
      Outcome: 'SUCCESS',
      TransactionDetails: res.message
    });
    this._emit();
    return res;
  }
}

/**
 * Firebase Firestore + Firebase Authentication Repository with IndexedDB offline persistence
 * and transactional prescription safety checks.
 */
export class FirestoreRepository {
  constructor() {
    this.mode = 'cloud';
    this.seed = buildSeedData();
    const app = getApps().length ? getApps()[0] : initializeApp(FIREBASE_CONFIG);
    this.auth = getAuth(app);
    // Must be synchronous: subscribe() uses this.db immediately. If Firestore was already
    // initialised for this app (React StrictMode runs constructors twice in dev), reuse it.
    try {
      this.db = initializeFirestore(app, {
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
      });
    } catch {
      this.db = getFirestore(app);
    }
  }

  onAuthChange(callback) {
    return onAuthStateChanged(this.auth, async (fbUser) => {
      if (!fbUser) return callback(null);
      try {
        const uSnap = await getDoc(doc(this.db, 'users', fbUser.uid));
        if (uSnap.exists()) {
          callback({ uid: fbUser.uid, ...uSnap.data() });
        } else {
          const email = (fbUser.email || '').toLowerCase();
          const matched = this.seed.users.find((u) => u.Email.toLowerCase() === email) || {
            StaffID: 'N-1001',
            FullName: fbUser.displayName || email,
            Role: email.startsWith('p') ? 'Physician' : 'Nurse',
            Email: email,
            IsActive: true
          };
          await setDoc(doc(this.db, 'users', fbUser.uid), {
            ...matched,
            LastLoginTime: formatClinicalStamp()
          });
          callback({ uid: fbUser.uid, ...matched });
        }
      } catch {
        callback(null);
      }
    });
  }

  async signIn(identifier, password) {
    const clean = String(identifier || '').trim().toLowerCase();
    const email = clean.includes('@') ? clean : `${clean.replace(/[^a-z0-9]/g, '')}@npms.org.za`;
    let cred;
    try {
      cred = await signInWithEmailAndPassword(this.auth, email, password);
    } catch (err) {
      // Auto-provision demo staff accounts if signing in for the very first time on a fresh Firebase project
      const demoProfile = this.seed.users.find((u) => u.Email.toLowerCase() === email);
      if (demoProfile && (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential')) {
        cred = await createUserWithEmailAndPassword(this.auth, email, password);
        await setDoc(doc(this.db, 'users', cred.user.uid), {
          ...demoProfile,
          LastLoginTime: formatClinicalStamp()
        });
      } else {
        throw err;
      }
    }
    const uRef = doc(this.db, 'users', cred.user.uid);
    const uSnap = await getDoc(uRef);
    let profile = uSnap.exists()
      ? uSnap.data()
      : this.seed.users.find((u) => u.Email.toLowerCase() === email);
    if (!profile) {
      profile = {
        StaffID: clean.toUpperCase(),
        FullName: cred.user.email,
        Role: 'Nurse',
        Email: cred.user.email,
        IsActive: true
      };
    }
    await setDoc(uRef, { ...profile, LastLoginTime: formatClinicalStamp() }, { merge: true });
    await this.ensureSeed();
    await this.appendAudit({
      ActorStaffID: profile.StaffID,
      PatientID: '-',
      ActionType: 'Staff Sign In',
      Outcome: 'SUCCESS',
      TransactionDetails: `${profile.FullName} (${profile.Role}) authenticated via Firebase Auth.`
    });
    return { uid: cred.user.uid, ...profile };
  }

  async signOut(user) {
    if (user) {
      await this.appendAudit({
        ActorStaffID: user.StaffID,
        PatientID: '-',
        ActionType: 'Staff Sign Out',
        Outcome: 'SUCCESS',
        TransactionDetails: `${user.FullName} signed out.`
      });
    }
    await fbSignOut(this.auth);
  }

  async ensureSeed() {
    const seedRef = doc(this.db, 'meta', 'seed');
    const snap = await getDoc(seedRef);
    if (snap.exists()) return false;

    const batch = writeBatch(this.db);
    this.seed.patients.forEach((p) => {
      batch.set(doc(this.db, 'patients', p.PatientID), p);
    });
    this.seed.patientAllergies.forEach((a) => {
      batch.set(doc(this.db, 'patients', a.PatientID, 'allergies', a.AllergyID), a);
    });
    this.seed.vitals.forEach((v) => {
      batch.set(doc(this.db, 'vitals', v.VitalID), v);
    });
    this.seed.consultations.forEach((c) => {
      batch.set(doc(this.db, 'consultations', c.ConsultID), c);
    });
    this.seed.formulary.forEach((m) => {
      batch.set(doc(this.db, 'medications', m.DrugID), m);
    });
    this.seed.drugInteractions.forEach((di) => {
      batch.set(doc(this.db, 'drug_interactions', di.InteractionID), di);
    });
    this.seed.prescriptions.forEach((rx) => {
      batch.set(doc(this.db, 'prescriptions', rx.PrescriptionID), rx);
    });
    batch.set(doc(this.db, 'meta', 'counters'), {
      P: this.seed.patients.length,
      V: this.seed.vitals.length,
      C: this.seed.consultations.length,
      RX: this.seed.prescriptions.length
    });
    batch.set(seedRef, { seededAt: Date.now(), version: '2.0-3NF' });
    await batch.commit();
    return true;
  }

  subscribe(onData, onError) {
    const collectionsToWatch = ['patients', 'vitals', 'consultations', 'prescriptions', 'audit', 'medications'];
    const cache = {
      users: this.seed.users,
      formulary: this.seed.formulary,
      patients: [],
      vitals: [],
      consultations: [],
      prescriptions: [],
      audit: []
    };
    const unsubs = collectionsToWatch.map((colName) =>
      onSnapshot(
        collection(this.db, colName),
        (snap) => {
          const rows = snap.docs.map((d) => d.data());
          if (colName === 'medications' && rows.length > 0) {
            cache.formulary = rows;
          } else if (colName !== 'medications') {
            cache[colName] = rows;
          }
          onData({ ...cache });
        },
        (err) => onError && onError(err)
      )
    );
    return () => unsubs.forEach((u) => u());
  }

  async _nextId(key, prefix, width = 3) {
    const cRef = doc(this.db, 'meta', 'counters');
    return runTransaction(this.db, async (tx) => {
      const s = await tx.get(cRef);
      const n = ((s.exists() && s.data()[key]) || 0) + 1;
      tx.set(cRef, { [key]: n }, { merge: true });
      return prefix + String(n).padStart(width, '0');
    });
  }

  async appendAudit(entry) {
    const q = query(collection(this.db, 'audit'), orderBy('Ts', 'asc'));
    const snap = await getDocs(q);
    const docs = snap.docs.map((d) => d.data()).sort((a, b) => (a.Ts || 0) - (b.Ts || 0));
    const prev = docs.length > 0 ? docs[docs.length - 1] : null;
    const chained = await AuditTrail.createChainedEntry(entry, prev);
    await setDoc(doc(this.db, 'audit', chained.LogID), chained);
    return chained;
  }

  async addPatient(patientData, actorUser) {
    const id = await this._nextId('P', 'P-', 3);
    const record = { ...patientData, PatientID: id };
    const batch = writeBatch(this.db);
    batch.set(doc(this.db, 'patients', id), record);
    (record.Allergies || []).forEach((alg, idx) => {
      const algId = `ALG-${id}-${idx + 1}`;
      batch.set(doc(this.db, 'patients', id, 'allergies', algId), {
        AllergyID: algId,
        PatientID: id,
        Allergen: alg,
        AllergenType: 'Drug/Family',
        RecordedTimestamp: record.AdmissionTimestamp
      });
    });
    await batch.commit();
    await this.appendAudit({
      ActorStaffID: actorUser.StaffID,
      PatientID: id,
      ActionType: 'Register patient',
      Outcome: 'SUCCESS',
      TransactionDetails: `Registered ${record.FullName} (Bed: ${record.AssignedBed}, Triage: ${record.TriageLevel})`
    });
    return id;
  }

  async updatePatientBed(patientId, newBed, actorUser) {
    await updateDoc(doc(this.db, 'patients', patientId), { AssignedBed: newBed });
    await this.appendAudit({
      ActorStaffID: actorUser.StaffID,
      PatientID: patientId,
      ActionType: 'Assign bed',
      Outcome: 'SUCCESS',
      TransactionDetails: `Assigned bed updated to ${newBed}`
    });
  }

  async recordVitalsAndConsult({ patientId, vitalRecord, finalTriage, overridden, suggestedTriage, progressReport, actorUser }) {
    const vitalId = await this._nextId('V', 'V-', 3);
    const fullVital = { ...vitalRecord, VitalID: vitalId, PatientID: patientId, RecordedByStaffID: actorUser.StaffID };
    const batch = writeBatch(this.db);
    batch.set(doc(this.db, 'vitals', vitalId), fullVital);
    batch.update(doc(this.db, 'patients', patientId), {
      LastVitals: fullVital,
      MEWSScore: fullVital.MEWSScore,
      TriageLevel: finalTriage
    });

    if (progressReport && progressReport.trim()) {
      const consultId = await this._nextId('C', 'C-', 3);
      batch.set(doc(this.db, 'consultations', consultId), {
        ConsultID: consultId,
        PatientID: patientId,
        StaffID: actorUser.StaffID,
        VitalID: vitalId,
        Timestamp: fullVital.RecordedTimestamp,
        Systolic: fullVital.BloodPressureSystolic,
        Diastolic: fullVital.BloodPressureDiastolic,
        HeartRate: fullVital.HeartRate,
        OxygenSaturation: fullVital.OxygenSaturation,
        BodyTemperature: fullVital.BodyTemperature,
        ProgressReport: progressReport.trim()
      });
    }
    await batch.commit();

    const detail = `BP ${fullVital.BloodPressureSystolic}/${fullVital.BloodPressureDiastolic}, HR ${fullVital.HeartRate} bpm, SpO2 ${fullVital.OxygenSaturation}%, Temp ${fullVital.BodyTemperature}°C, MEWS ${fullVital.MEWSScore}`;
    await this.appendAudit({
      ActorStaffID: actorUser.StaffID,
      PatientID: patientId,
      ActionType: overridden ? 'Log vitals (Triage Override)' : 'Log vitals',
      Outcome: 'SUCCESS',
      TransactionDetails: overridden
        ? `${detail} | Override: MEWS suggested ${suggestedTriage}, staff selected ${finalTriage}`
        : detail
    });
    return fullVital;
  }

  async prescribe({ user, patientId, drugName, dosage, route, frequency, isOffline }) {
    if (isOffline) {
      return {
        ok: false,
        code: 'OFFLINE_BLOCKED',
        title: 'Offline Safety Lock',
        message: 'Prescription authorization is blocked while offline because the safety engine requires a live transaction against the freshest patient record.'
      };
    }
    const pRef = doc(this.db, 'patients', patientId);
    const cRef = doc(this.db, 'meta', 'counters');
    const result = await runTransaction(this.db, async (tx) => {
      const pSnap = await tx.get(pRef);
      const cSnap = await tx.get(cRef);
      if (!pSnap.exists()) {
        return { ok: false, code: 'NOT_FOUND', title: 'Patient not found', message: 'Patient record no longer exists.' };
      }
      const freshestPatient = pSnap.data();
      const check = prescribeMedication(user, freshestPatient, drugName, this.seed.formulary);
      if (!check.ok) return check;

      const nextNum = ((cSnap.exists() && cSnap.data().RX) || 0) + 1;
      const rxId = 'RX-' + String(nextNum).padStart(3, '0');
      const now = formatClinicalStamp();
      const newOrder = {
        PrescriptionID: rxId,
        PatientID: patientId,
        PrescribingDoctorID: user.StaffID,
        StaffID: user.StaffID,
        DrugID: check.drug.DrugID,
        DrugName: check.drug.DrugName,
        AuthorizedDosage: dosage || check.drug.StandardDosage || 'Standard',
        Route: route || check.drug.Route || 'PO',
        Frequency: frequency || 'BD',
        Status: 'Pending',
        AuthorizationTimestamp: now,
        DateAuthorized: now,
        AdministeredByNurseID: null,
        AdministeredTimestamp: null
      };
      const updatedActive = (freshestPatient.ActiveMeds || []).includes(check.drug.DrugName)
        ? freshestPatient.ActiveMeds
        : [...(freshestPatient.ActiveMeds || []), check.drug.DrugName];

      tx.set(cRef, { RX: nextNum }, { merge: true });
      tx.update(pRef, { ActiveMeds: updatedActive });
      tx.set(doc(this.db, 'prescriptions', rxId), newOrder);
      return { ...check, order: newOrder };
    });

    if (result.ok) {
      await this.appendAudit({
        ActorStaffID: user.StaffID,
        PatientID: patientId,
        ActionType: 'Prescribe medication',
        Outcome: 'SUCCESS',
        TransactionDetails: `${result.drug.DrugName} (${result.order.AuthorizedDosage} ${result.order.Route} ${result.order.Frequency}) — Status: Pending`
      });
    } else if (['UNAUTHORIZED', 'ALLERGY', 'INTERACTION'].includes(result.code)) {
      await this.appendAudit({
        ActorStaffID: user ? user.StaffID : 'UNKNOWN',
        PatientID: patientId,
        ActionType: 'Prescribe medication',
        Outcome: 'BLOCKED',
        TransactionDetails: `${result.title}: ${drugName} (${result.message})`
      });
    }
    return result;
  }

  async updateMedicationStatus({ prescriptionId, action, actorUser, reason = '' }) {
    const rxRef = doc(this.db, 'prescriptions', prescriptionId);
    const rxSnap = await getDoc(rxRef);
    if (!rxSnap.exists()) return { ok: false, message: 'Prescription not found.' };
    const target = rxSnap.data();

    const allRxSnap = await getDocs(collection(this.db, 'prescriptions'));
    const patientOrders = allRxSnap.docs
      .map((d) => d.data())
      .filter((r) => r.PatientID === target.PatientID);

    const res = transitionMedicationOrder(target, action, actorUser, reason, patientOrders);
    if (!res.ok) return res;

    const batch = writeBatch(this.db);
    batch.set(rxRef, res.order);
    batch.update(doc(this.db, 'patients', target.PatientID), { ActiveMeds: res.activeMeds });
    await batch.commit();

    await this.appendAudit({
      ActorStaffID: actorUser.StaffID,
      PatientID: target.PatientID,
      ActionType: action === 'ADMINISTER' ? 'Administer medication' : 'Cancel prescription',
      Outcome: 'SUCCESS',
      TransactionDetails:
        action === 'ADMINISTER'
          ? `Administered ${target.DrugName} (${prescriptionId})`
          : `Cancelled ${target.DrugName} (${prescriptionId}) — Reason: ${reason}`
    });
    return res;
  }

  async dischargePatient(patientId, actorUser) {
    const pRef = doc(this.db, 'patients', patientId);
    const pSnap = await getDoc(pRef);
    if (!pSnap.exists()) return { ok: false, title: 'Not found', message: 'Patient not found.' };

    const allRxSnap = await getDocs(collection(this.db, 'prescriptions'));
    const allOrders = allRxSnap.docs.map((d) => d.data());

    const { PatientRecord } = await import('../model/PatientRecord.js');
    const pModel = new PatientRecord(pSnap.data());
    const res = pModel.dischargePatient(allOrders);

    if (!res.ok) {
      await this.appendAudit({
        ActorStaffID: actorUser.StaffID,
        PatientID: patientId,
        ActionType: 'Discharge patient',
        Outcome: 'BLOCKED',
        TransactionDetails: res.message
      });
      return res;
    }

    await updateDoc(pRef, { Status: 'Discharged', DischargedTimestamp: pModel.DischargedTimestamp });
    await this.appendAudit({
      ActorStaffID: actorUser.StaffID,
      PatientID: patientId,
      ActionType: 'Discharge patient',
      Outcome: 'SUCCESS',
      TransactionDetails: res.message
    });
    return res;
  }
}

let repositorySingleton = null;

// One repository per page load (StrictMode would otherwise create two).
export function createRepository() {
  if (repositorySingleton) return repositorySingleton;
  if (isFirebaseConfigured()) {
    try {
      repositorySingleton = new FirestoreRepository();
    } catch (err) {
      console.error('Firestore initialization failed, falling back to InMemoryRepository:', err);
      repositorySingleton = new InMemoryRepository();
    }
  } else {
    repositorySingleton = new InMemoryRepository();
  }
  return repositorySingleton;
}