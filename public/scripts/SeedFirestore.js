/**
 * Standalone CLI one-time seed script (`npm run seed`).
 * Reads FIREBASE_CONFIG from src/firebase/config.js and seeds the 3NF collections idempotently.
 */
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, writeBatch } from 'firebase/firestore';
import { FIREBASE_CONFIG, isFirebaseConfigured } from '../src/firebase/config.js';
import { buildSeedData } from '../src/model/seedData.js';

async function runSeed() {
  if (!isFirebaseConfigured()) {
    console.error('ERROR: Paste your Firebase configuration into src/firebase/config.js before running npm run seed.');
    process.exit(1);
  }
  const app = initializeApp(FIREBASE_CONFIG);
  const db = getFirestore(app);
  const seed = buildSeedData();

  const seedRef = doc(db, 'meta', 'seed');
  const existing = await getDoc(seedRef);
  if (existing.exists()) {
    console.log('Database already seeded (meta/seed exists). Skipping to preserve existing records.');
    process.exit(0);
  }

  const batch = writeBatch(db);
  seed.patients.forEach((p) => batch.set(doc(db, 'patients', p.PatientID), p));
  seed.patientAllergies.forEach((a) =>
    batch.set(doc(db, 'patients', a.PatientID, 'allergies', a.AllergyID), a)
  );
  seed.vitals.forEach((v) => batch.set(doc(db, 'vitals', v.VitalID), v));
  seed.consultations.forEach((c) => batch.set(doc(db, 'consultations', c.ConsultID), c));
  seed.formulary.forEach((m) => batch.set(doc(db, 'medications', m.DrugID), m));
  seed.drugInteractions.forEach((di) => batch.set(doc(db, 'drug_interactions', di.InteractionID), di));
  seed.prescriptions.forEach((rx) => batch.set(doc(db, 'prescriptions', rx.PrescriptionID), rx));
  batch.set(doc(db, 'meta', 'counters'), {
    P: seed.patients.length,
    V: seed.vitals.length,
    C: seed.consultations.length,
    RX: seed.prescriptions.length
  });
  batch.set(seedRef, { seededAt: Date.now(), version: '2.0-3NF' });

  await batch.commit();
  console.log('SUCCESS: Seeded NPMS 3NF collections into Firestore.');
  process.exit(0);
}

runSeed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});