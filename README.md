# NPMS: Nurse Patient Management System (Clinical PWA)

A ward-level clinical web app that helps nurses and physicians record patients, track vital signs, prescribe and administer medication safely, and hand over between shifts. It's built around one design rule: **zero patient harm**. The app checks every risky action (a dangerous vital sign, a drug the patient is allergic to, a drug interaction) before it can happen, and records every action in a tamper-evident audit trail.

> Group project for CSC312 Software Engineering at the University of the Western Cape, built by team **Software Xccelerators**.

**Live demo:** https://npms-d5d5b.web.app (fictional patient data only)

| Role | Username | Password |
|---|---|---|
| Nurse | `n1001` | `nurse123` |
| Physician | `p2001` | `doctor123` |

The demo credentials are published deliberately so reviewers can log in. All patients and staff are fictional.

## Key features

- **Smart prescription engine:** before a prescription is saved, it is checked against the patient's allergies (by drug name and drug family) and their active medications for known contraindications. Unsafe orders are blocked with the reason shown.
- **MEWS early-warning scores:** vital signs are range-checked against physiological bounds and scored with the Modified Early Warning Score, so deteriorating patients are flagged on the ward whiteboard.
- **Tamper-evident audit trail:** every sign-in, registration, vital sign and prescription is logged with a SHA-256 hash chained to the previous entry, so any edited or deleted record breaks the chain.
- **Role-based access in the database itself:** Firestore security rules (not just the UI) enforce that only physicians create prescriptions, vitals can't be edited after entry, audit logs are append-only, and staff can't change their own role.
- **Ward views:** patient whiteboard, nurse's clipboard, shift handover, analytics dashboard (Chart.js) and audit trail viewer.
- **Bilingual interface:** English and isiZulu.
- **Installable PWA** that works offline with Firestore's local cache, plus Capacitor configuration for Android and iOS builds.

## Architecture

```
src/
  model/        domain entities: PatientRecord, VitalSign (MEWS), MedicationOrder, StaffUser, AuditTrail (hash chain)
  controller/   ClinicalController, SmartPrescriptionEngine (allergy and interaction checks)
  view/         React views: Whiteboard, Clipboard, ShiftHandover, AnalyticsDashboard, AuditTrail, RegisterPatient
  firebase/     repository pattern over Cloud Firestore + Firebase Auth, with an in-memory fallback
  i18n/         English and isiZulu translations
  tests/        Vitest unit tests and Firestore security rules tests
firestore.rules  server-side access control
```

The app follows **MVC**: clinical rules live in the model and controller layers with no UI code, so they can be unit tested on their own. Data access goes through a **repository** interface, so the same app runs against Cloud Firestore or entirely in memory.

## Tech stack

React 18 · Vite · Tailwind CSS · Chart.js · Firebase (Auth, Cloud Firestore, Hosting) · Capacitor · Vitest · Firebase Rules Unit Testing

## Testing

```bash
npm test
```
19 automated tests: 15 controller tests covering prescribing, allergy and interaction blocking, vitals validation and duplicate patient detection, and 4 security rules tests that run against the Firestore emulator.

## Run it locally

```bash
git clone https://github.com/Bahle05/npms-clinical-pwa.git
cd npms-clinical-pwa
npm install
npm run dev            # http://localhost:5173
```
Without Firebase settings the app runs on its in-memory repository. To use your own Firebase project, set the `VITE_FIREBASE_*` variables in a `.env` file.

`npm run build:singlefile` bundles the whole app into one self-contained `index.html` for offline demonstration.

## Security notes

- The Firebase web API key in the config is restricted to this app's domains and the Firebase APIs it uses. Firebase web keys identify the project; access is controlled by the security rules.
- Public sign-up is disabled. Staff accounts are issued, not self-registered.

## Team

Software Xccelerators, CSC312 Software Engineering, University of the Western Cape, 2026.
Technical lead and repository maintainer: [Bahle Ludidi](https://www.linkedin.com/in/bahle-ludidi-727657352).
