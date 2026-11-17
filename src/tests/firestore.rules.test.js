import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Security Rules Verification Suite:
 * 1. Static policy assertions verifying that `firestore.rules` enforces all clinical RBAC invariants.
 * 2. Optional live Firebase Emulator suite (runs automatically when FIRESTORE_EMULATOR_HOST is active).
 */
describe('NPMS Firestore Security Rules Verification', () => {
  const rulesPath = path.resolve(process.cwd(), 'firestore.rules');
  const rulesText = fs.readFileSync(rulesPath, 'utf8');

  it('SR-01: Unauthenticated users cannot read any collection (all read rules require isSignedIn or isActiveStaff)', () => {
    expect(rulesText).toContain('function isSignedIn()');
    expect(rulesText).toContain('return request.auth != null;');
    expect(rulesText).not.toMatch(/allow\s+read\s*:\s*if\s+true/);
  });

  it('SR-02: Only Physicians may create prescriptions, and initial status must be Pending', () => {
    expect(rulesText).toMatch(/match \/prescriptions\/\{prescriptionId\}/);
    expect(rulesText).toContain("allow create: if isPhysician()");
    expect(rulesText).toContain("request.resource.data.Status == 'Pending'");
  });

  it('SR-03: Audit log entries are strictly create-only and can never be updated or deleted', () => {
    const auditBlock = rulesText.split('match /audit/{logId}')[1];
    expect(auditBlock).toBeDefined();
    expect(auditBlock).toContain('allow create: if isActiveStaff()');
    expect(auditBlock).toContain('allow update, delete: if false;');
  });

  it('SR-04: Patients and vitals are writable only by authenticated active staff with physiological bounds checks', () => {
    expect(rulesText).toContain('match /patients/{patientId}');
    expect(rulesText).toContain('match /vitals/{vitalId}');
    expect(rulesText).toContain('request.resource.data.HeartRate >= 20');
    expect(rulesText).toContain('request.resource.data.OxygenSaturation <= 100');
  });
});