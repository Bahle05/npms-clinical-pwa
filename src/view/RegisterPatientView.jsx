import React, { useState } from 'react';
import { Btn, Field, inputCls } from './Primitives.jsx';
import { validateAndCheckDuplicatePatient } from '../controller/ClinicalController.js';

export function RegisterPatientView({ patients, onSavePatient, onCancel, onOpenExisting }) {
  const [form, setForm] = useState({
    FullName: '',
    NationalID: '',
    DOB: '',
    Gender: '',
    AssignedBed: 'Bed A-02',
    TriageLevel: 'Low',
    Allergies: '',
    MainComplaint: ''
  });
  const [errors, setErrors] = useState({});
  const [duplicate, setDuplicate] = useState(null);

  const update = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    const check = validateAndCheckDuplicatePatient(form, patients);
    if (!check.ok) {
      if (check.code === 'DUPLICATE') {
        setErrors({});
        setDuplicate(check.duplicate);
        return;
      }
      setErrors(check.errors || {});
      return;
    }
    setErrors({});
    setDuplicate(null);
    await onSavePatient(check.patient);
  }

  return (
    <section aria-labelledby="reg-heading" className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 id="reg-heading" className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Register New Clinic Patient
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Includes automated National ID &amp; DOB duplicate record interception
          </p>
        </div>
        <Btn variant="ghost" onClick={onCancel}>
          Cancel
        </Btn>
      </div>

      {duplicate && (
        <div
          role="alert"
          className="rounded-2xl border-4 border-red-700 bg-red-100 dark:bg-red-950/80 p-5 mb-5"
        >
          <p className="font-extrabold text-red-900 dark:text-red-200 text-lg">
            STOP — Duplicate Patient Record Detected
          </p>
          <p className="text-sm text-red-950 dark:text-red-100 mt-1">
            <strong>{duplicate.FullName}</strong> (MRN: <span className="font-mono">{duplicate.PatientID}</span>, DOB:{' '}
            <span className="font-mono">{duplicate.DOB}</span>) already has an active longitudinal folder. Do not create a fragmented duplicate record.
          </p>
          <div className="mt-3">
            <Btn onClick={() => onOpenExisting(duplicate.PatientID)}>
              Open Existing Folder ({duplicate.PatientID})
            </Btn>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        noValidate
        className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800"
      >
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Full Name" htmlFor="reg-name" error={errors.FullName}>
            <input
              id="reg-name"
              className={inputCls(Boolean(errors.FullName))}
              value={form.FullName}
              onChange={update('FullName')}
            />
          </Field>

          <Field label="National ID / Passport Number" htmlFor="reg-nid" error={errors.NationalID}>
            <input
              id="reg-nid"
              className={`${inputCls(Boolean(errors.NationalID))} font-mono`}
              placeholder="13-digit SA ID"
              value={form.NationalID}
              onChange={update('NationalID')}
            />
          </Field>

          <Field label="Date of Birth" htmlFor="reg-dob" error={errors.DOB}>
            <input
              id="reg-dob"
              type="date"
              className={inputCls(Boolean(errors.DOB))}
              value={form.DOB}
              onChange={update('DOB')}
            />
          </Field>

          <Field label="Gender" htmlFor="reg-gender" error={errors.Gender}>
            <select
              id="reg-gender"
              className={inputCls(Boolean(errors.Gender))}
              value={form.Gender}
              onChange={update('Gender')}
            >
              <option value="">Select gender...</option>
              <option value="Female">Female</option>
              <option value="Male">Male</option>
              <option value="Other">Other</option>
            </select>
          </Field>

          <Field label="Assigned Ward Bed" htmlFor="reg-bed">
            <input
              id="reg-bed"
              className={`${inputCls()} font-mono`}
              value={form.AssignedBed}
              onChange={update('AssignedBed')}
            />
          </Field>

          <Field label="Initial Triage Priority" htmlFor="reg-triage">
            <select
              id="reg-triage"
              className={inputCls()}
              value={form.TriageLevel}
              onChange={update('TriageLevel')}
            >
              <option value="Low">Low (Green — Routine)</option>
              <option value="Med">Med (Yellow — Priority)</option>
              <option value="High">High (Red — Urgent)</option>
            </select>
          </Field>
        </div>

        <Field
          label="Known Drug or Family Allergies (comma-separated)"
          htmlFor="reg-allergies"
          hint="e.g. Penicillin, Aspirin (leave blank if NKDA)"
        >
          <input
            id="reg-allergies"
            className={inputCls()}
            value={form.Allergies}
            onChange={update('Allergies')}
          />
        </Field>

        <Field label="Main Presenting Complaint" htmlFor="reg-complaint" error={errors.MainComplaint}>
          <textarea
            id="reg-complaint"
            rows={2}
            className={inputCls(Boolean(errors.MainComplaint))}
            value={form.MainComplaint}
            onChange={update('MainComplaint')}
          />
        </Field>

        <div className="flex justify-end gap-3 mt-4">
          <Btn variant="ghost" onClick={onCancel}>
            Cancel
          </Btn>
          <Btn type="submit" variant="safe">
            Save Patient Record
          </Btn>
        </div>
      </form>
    </section>
  );
}