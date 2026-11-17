# Nurse Patient Management System (NPMS) — v2.0 Clinical PWA

**Group:** Software Xccelerators (UWC CSC312 Software Engineering group project)  
**Mandate:** Zero Patient Harm  

## Architecture Highlights
- **MVC Separation:** `src/model/` (3NF domain entities, MEWS calculator, SHA-256 hash chain), `src/controller/` (`SmartPrescriptionEngine`, `ClinicalController`), `src/view/` (Mandel's Golden Rules clinical UI), `src/firebase/` (Repository pattern supporting both Cloud Firestore + Firebase Auth and an automatic In-Memory fallback).
- **Single-File Academic Submission Build:** Run `npm run build:singlefile` to bundle the entire React 18 + Tailwind + Chart.js app into a single self-contained `dist-singlefile/index.html` file that opens via double-click for screen recording.
- **Automated Verification:** Run `npm test` to execute all 19 Vitest unit and Security Rules tests (TC-01 through TC-15 and SR-01 through SR-04).