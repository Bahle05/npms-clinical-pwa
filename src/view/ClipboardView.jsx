import React, { useState, useMemo } from 'react';
import {
  Btn,
  Field,
  inputCls,
  CriticalAlert,
  getTriageStyle,
  MEWSChip,
  VitalsSparkline
} from './Primitives.jsx';
import { computeAgeFromDOB, calculateMEWSFromVitals, toCanonicalTriage } from '../model/PatientRecord.js';
import { evaluateVitalsSubmission } from '../controller/ClinicalController.js';
import { SmartPrescriptionEngine } from '../controller/SmartPrescriptionEngine.js';
import { t } from '../i18n/translations.js';

export function ClipboardView({
  patient,
  user,
  users,
  formulary,
  vitals,
  consultations,
  prescriptions,
  isOffline,
  lang,
  onBack,
  onRecordVitals,
  onPrescribe,
  onUpdateMedicationStatus,
  onUpdateBed,
  onDischarge
}) {
  const [activeTab, setActiveTab] = useState('Vitals');
  const [feedback, setFeedback] = useState(null);
  const [editingBed, setEditingBed] = useState(false);
  const [bedValue, setBedValue] = useState(patient.AssignedBed || 'Waiting');

  const style = getTriageStyle(patient.TriageLevel);
  const patientVitals = useMemo(
    () =>
      vitals
        .filter((v) => v.PatientID === patient.PatientID)
        .sort((a, b) => String(b.RecordedTimestamp).localeCompare(String(a.RecordedTimestamp))),
    [vitals, patient.PatientID]
  );

  const patientNotes = useMemo(
    () =>
      consultations
        .filter((c) => c.PatientID === patient.PatientID)
        .sort((a, b) => String(b.Timestamp).localeCompare(String(a.Timestamp))),
    [consultations, patient.PatientID]
  );

  const patientRx = useMemo(
    () =>
      prescriptions
        .filter((r) => r.PatientID === patient.PatientID)
        .sort((a, b) =>
          String(b.AuthorizationTimestamp || b.DateAuthorized).localeCompare(
            String(a.AuthorizationTimestamp || a.DateAuthorized)
          )
        ),
    [prescriptions, patient.PatientID]
  );

  const staffName = (id) => (users.find((u) => u.StaffID === id) || {}).FullName || id || 'Clinical Staff';

  async function saveBedAssignment(e) {
    e.preventDefault();
    if (!bedValue.trim()) return;
    await onUpdateBed(patient.PatientID, bedValue.trim());
    setEditingBed(false);
    setFeedback({ ok: true, title: 'Bed Updated', message: `Assigned bed changed to ${bedValue.trim()}.` });
  }

  async function handleDischargeClick() {
    const res = await onDischarge(patient.PatientID);
    setFeedback(res);
  }

  const tabs = [
    { id: 'Vitals', label: t(lang, 'vitalsTab') },
    { id: 'Medications', label: `${t(lang, 'medicationsTab')} (${patientRx.filter((r) => r.Status === 'Pending').length} Pending)` },
    { id: 'Notes', label: t(lang, 'notesTab') },
    { id: 'History', label: t(lang, 'historyTab') }
  ];

  return (
    <section aria-labelledby="clipboard-patient-name">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <Btn variant="ghost" onClick={onBack}>
          ← Back to Whiteboard
        </Btn>
        {patient.Status !== 'Discharged' && (
          <Btn variant="danger" onClick={handleDischargeClick}>
            {t(lang, 'dischargeBtn')}
          </Btn>
        )}
      </div>

      {/* Persistent Patient Header (Allergies Always Visible) */}
      <div className={`rounded-2xl border-l-8 border-2 p-4 sm:p-5 mb-4 shadow-sm ${style.card}`}>
        <div className="flex flex-wrap justify-between items-start gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 id="clipboard-patient-name" className="text-2xl font-extrabold text-slate-900 dark:text-white">
                {patient.FullName}
              </h1>
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold ${style.chip}`}>
                {style.label} ({style.canonical})
              </span>
              <MEWSChip score={patient.MEWSScore} />
              <span className="px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-slate-800 text-white">
                {patient.Status || 'Admitted'}
              </span>
            </div>
            <p className="font-mono text-xs sm:text-sm text-slate-700 dark:text-slate-300 mt-1">
              MRN: <strong>{patient.PatientID}</strong> · ID: {patient.NationalID || 'N/A'} · {patient.Gender} ·{' '}
              {patient.Age || computeAgeFromDOB(patient.DOB)} yrs (DOB {patient.DOB})
            </p>
            <p className="mt-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
              Presenting Complaint: <strong>{patient.MainComplaint}</strong>
            </p>
          </div>

          {/* Bed Assignment Widget */}
          <div className="bg-white/90 dark:bg-slate-900/90 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700">
            {!editingBed ? (
              <div className="flex items-center gap-2">
                <div className="text-xs">
                  <span className="text-slate-500 block">Assigned Bed</span>
                  <strong className="font-mono text-sm text-slate-900 dark:text-white">
                    {patient.AssignedBed || 'Waiting'}
                  </strong>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingBed(true)}
                  className="min-h-[40px] px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  Change
                </button>
              </div>
            ) : (
              <form onSubmit={saveBedAssignment} className="flex items-center gap-1.5">
                <input
                  type="text"
                  aria-label="Assigned bed"
                  className="min-h-[40px] px-2 py-1 text-xs font-mono border rounded-lg w-28 dark:bg-slate-800"
                  value={bedValue}
                  onChange={(e) => setBedValue(e.target.value)}
                />
                <button type="submit" className="min-h-[40px] px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-700 text-white">
                  Save
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Always-Visible Allergy & Active Medication Strip */}
        <div className="mt-3 pt-3 border-t border-slate-300/80 dark:border-slate-700 flex flex-wrap items-center gap-3">
          {patient.Allergies && patient.Allergies.length > 0 ? (
            <div className="bg-red-700 text-white font-extrabold px-3.5 py-1.5 rounded-lg text-sm flex items-center gap-2">
              <span>⚠ SEVERE ALLERGY: {patient.Allergies.join(', ')}</span>
            </div>
          ) : (
            <div className="bg-emerald-700 text-white font-bold px-3 py-1 rounded-lg text-xs">
              Allergies: None Recorded (NKDA)
            </div>
          )}

          <div className="text-xs sm:text-sm font-medium text-slate-800 dark:text-slate-200">
            Active Medications:{' '}
            <strong className="font-mono">
              {patient.ActiveMeds && patient.ActiveMeds.length > 0 ? patient.ActiveMeds.join(', ') : 'None'}
            </strong>
          </div>
        </div>
      </div>

      <CriticalAlert result={feedback} onDismiss={() => setFeedback(null)} />

      {/* Folder Tabs */}
      <div role="tablist" aria-label="Patient clipboard sections" className="flex flex-wrap gap-2 mb-4">
        {tabs.map((tabItem) => (
          <button
            key={tabItem.id}
            role="tab"
            aria-selected={activeTab === tabItem.id}
            onClick={() => setActiveTab(tabItem.id)}
            className={`min-h-[48px] px-5 py-2.5 rounded-t-xl font-bold text-sm sm:text-base border-2 transition-colors ${
              activeTab === tabItem.id
                ? 'bg-white dark:bg-slate-900 border-blue-700 text-blue-800 dark:text-blue-300 shadow-sm'
                : 'bg-slate-200 dark:bg-slate-800 border-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-300/70'
            }`}
          >
            {tabItem.label}
          </button>
        ))}
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-800">
        {activeTab === 'Vitals' && (
          <VitalsAndMEWSSection
            patient={patient}
            user={user}
            vitalsList={patientVitals}
            staffName={staffName}
            onRecordVitals={async (payload) => {
              await onRecordVitals(payload);
              setFeedback({
                ok: true,
                title: 'Vitals & MEWS Recorded',
                message: `Saved vitals and updated MEWS (${payload.vitalRecord.MEWSScore}) and triage (${payload.finalTriage}).`
              });
            }}
          />
        )}

        {activeTab === 'Medications' && (
          <MedicationsAndPrescriptionPadSection
            patient={patient}
            user={user}
            formulary={formulary}
            prescriptions={patientRx}
            isOffline={isOffline}
            staffName={staffName}
            onPrescribe={onPrescribe}
            onUpdateMedicationStatus={async (payload) => {
              const res = await onUpdateMedicationStatus(payload);
              if (res.ok) {
                setFeedback({
                  ok: true,
                  title: payload.action === 'ADMINISTER' ? 'Medication Administered' : 'Order Cancelled',
                  message: `Prescription ${payload.prescriptionId} updated to ${res.order.Status}.`
                });
              } else {
                setFeedback({ ok: false, code: 'VALIDATION', title: 'Action Failed', message: res.message });
              }
            }}
          />
        )}

        {activeTab === 'Notes' && (
          <ConsultationNotesSection notes={patientNotes} staffName={staffName} />
        )}

        {activeTab === 'History' && (
          <ClinicalHistorySection patient={patient} vitals={patientVitals} prescriptions={patientRx} />
        )}
      </div>
    </section>
  );
}

function VitalsAndMEWSSection({ patient, user, vitalsList, staffName, onRecordVitals }) {
  const [openForm, setOpenForm] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [form, setForm] = useState({
    HeartRate: '82',
    BloodPressureSystolic: '122',
    BloodPressureDiastolic: '78',
    OxygenSaturation: '98',
    BodyTemperature: '36.8',
    RespiratoryRate: '16',
    AVPU: 'A',
    triageOverride: '',
    progressReport: ''
  });
  const [errors, setErrors] = useState({});

  const liveMewsPreview = useMemo(() => {
    return calculateMEWSFromVitals({
      HeartRate: Number(form.HeartRate) || 80,
      BloodPressureSystolic: Number(form.BloodPressureSystolic) || 120,
      BloodPressureDiastolic: Number(form.BloodPressureDiastolic) || 80,
      OxygenSaturation: Number(form.OxygenSaturation) || 98,
      BodyTemperature: Number(form.BodyTemperature) || 36.8,
      RespiratoryRate: Number(form.RespiratoryRate) || 16,
      AVPU: form.AVPU || 'A'
    });
  }, [form]);

  async function handleSubmit(e) {
    e.preventDefault();
    const chosenTriage = form.triageOverride ? toCanonicalTriage(form.triageOverride) : null;
    const res = evaluateVitalsSubmission(
      {
        HeartRate: form.HeartRate === '' ? NaN : Number(form.HeartRate),
        BloodPressureSystolic: form.BloodPressureSystolic === '' ? NaN : Number(form.BloodPressureSystolic),
        BloodPressureDiastolic: form.BloodPressureDiastolic === '' ? NaN : Number(form.BloodPressureDiastolic),
        OxygenSaturation: form.OxygenSaturation === '' ? NaN : Number(form.OxygenSaturation),
        BodyTemperature: form.BodyTemperature === '' ? NaN : Number(form.BodyTemperature),
        RespiratoryRate: form.RespiratoryRate === '' ? NaN : Number(form.RespiratoryRate),
        AVPU: form.AVPU
      },
      patient,
      chosenTriage
    );

    if (!res.ok) {
      setErrors(res.errors);
      return;
    }

    setErrors({});
    await onRecordVitals({
      patientId: patient.PatientID,
      vitalRecord: res.vital,
      finalTriage: res.finalTriage,
      overridden: res.overridden,
      suggestedTriage: res.suggestedTriage,
      progressReport: form.progressReport
    });
    setOpenForm(false);
    setForm((f) => ({ ...f, progressReport: '', triageOverride: '' }));
  }

  const displayed = showAll ? vitalsList : vitalsList.slice(0, 5);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex-1 min-w-[260px]">
          <VitalsSparkline vitalsList={vitalsList} />
        </div>
        {!openForm && (
          <Btn onClick={() => setOpenForm(true)}>+ Record Vitals & Compute MEWS</Btn>
        )}
      </div>

      {openForm && (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="border-2 border-blue-700 rounded-2xl p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50"
        >
          <div className="flex flex-wrap justify-between items-center gap-2 mb-3">
            <h2 className="font-extrabold text-lg">Bedside Vital Signs & MEWS Calculator</h2>
            <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
              Attending Staff: <strong>{user.StaffID}</strong> (Auto-stamped)
            </span>
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <Field label="Systolic BP (50–260 mmHg)" htmlFor="v-sbp" error={errors.BloodPressureSystolic}>
              <input
                id="v-sbp"
                inputMode="numeric"
                className={inputCls(Boolean(errors.BloodPressureSystolic))}
                value={form.BloodPressureSystolic}
                onChange={(e) => setForm({ ...form, BloodPressureSystolic: e.target.value })}
              />
            </Field>
            <Field label="Diastolic BP (30–160 mmHg)" htmlFor="v-dbp" error={errors.BloodPressureDiastolic}>
              <input
                id="v-dbp"
                inputMode="numeric"
                className={inputCls(Boolean(errors.BloodPressureDiastolic))}
                value={form.BloodPressureDiastolic}
                onChange={(e) => setForm({ ...form, BloodPressureDiastolic: e.target.value })}
              />
            </Field>
            <Field label="Heart Rate (20–250 bpm)" htmlFor="v-hr" error={errors.HeartRate}>
              <input
                id="v-hr"
                inputMode="numeric"
                className={inputCls(Boolean(errors.HeartRate))}
                value={form.HeartRate}
                onChange={(e) => setForm({ ...form, HeartRate: e.target.value })}
              />
            </Field>
            <Field label="SpO2 (50–100%)" htmlFor="v-spo2" error={errors.OxygenSaturation}>
              <input
                id="v-spo2"
                inputMode="numeric"
                className={inputCls(Boolean(errors.OxygenSaturation))}
                value={form.OxygenSaturation}
                onChange={(e) => setForm({ ...form, OxygenSaturation: e.target.value })}
              />
            </Field>
            <Field label="Body Temp (30.0–43.0 °C)" htmlFor="v-temp" error={errors.BodyTemperature}>
              <input
                id="v-temp"
                inputMode="decimal"
                className={inputCls(Boolean(errors.BodyTemperature))}
                value={form.BodyTemperature}
                onChange={(e) => setForm({ ...form, BodyTemperature: e.target.value })}
              />
            </Field>
            <Field label="Resp Rate (4–60 /min)" htmlFor="v-rr" error={errors.RespiratoryRate}>
              <input
                id="v-rr"
                inputMode="numeric"
                className={inputCls(Boolean(errors.RespiratoryRate))}
                value={form.RespiratoryRate}
                onChange={(e) => setForm({ ...form, RespiratoryRate: e.target.value })}
              />
            </Field>
          </div>

          <div className="grid sm:grid-cols-2 gap-3 mt-1">
            <Field label="AVPU Consciousness" htmlFor="v-avpu" error={errors.AVPU}>
              <select
                id="v-avpu"
                className={inputCls(Boolean(errors.AVPU))}
                value={form.AVPU}
                onChange={(e) => setForm({ ...form, AVPU: e.target.value })}
              >
                <option value="A">A — Alert (0 pts)</option>
                <option value="V">V — Responds to Voice (+1 pt)</option>
                <option value="P">P — Responds to Pain (+2 pts)</option>
                <option value="U">U — Unresponsive (+3 pts)</option>
              </select>
            </Field>

            <Field
              label={`Triage Level (MEWS Suggests: ${liveMewsPreview.suggestedTriage})`}
              htmlFor="v-triage-override"
              hint="Leave on Auto-Accept or select an override (overrides are audited)"
            >
              <select
                id="v-triage-override"
                className={inputCls()}
                value={form.triageOverride}
                onChange={(e) => setForm({ ...form, triageOverride: e.target.value })}
              >
                <option value="">Auto-Accept MEWS Suggestion ({liveMewsPreview.suggestedTriage})</option>
                <option value="Low">Override → Low (Green: Routine)</option>
                <option value="Med">Override → Med (Yellow: Priority)</option>
                <option value="High">Override → High (Red: Urgent)</option>
              </select>
            </Field>
          </div>

          {/* Live MEWS Early-Warning Preview Banner */}
          <div className="p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="text-xs font-bold uppercase text-slate-500 block">Computed MEWS Early-Warning</span>
              <span className="font-mono text-sm font-bold">
                Score: {liveMewsPreview.score} · Suggested Triage: {liveMewsPreview.suggestedTriage} ({liveMewsPreview.suggestedColor})
              </span>
              {liveMewsPreview.breakdown.length > 0 && (
                <p className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-0.5">
                  Triggers: {liveMewsPreview.breakdown.join(', ')}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {liveMewsPreview.isTachycardic && (
                <span className="px-2.5 py-1 rounded bg-red-700 text-white text-xs font-bold">
                  TACHYCARDIC (&gt;100 bpm)
                </span>
              )}
              {liveMewsPreview.isHypoxic && (
                <span className="px-2.5 py-1 rounded bg-red-700 text-white text-xs font-bold">
                  HYPOXIC (&lt;92% SpO2)
                </span>
              )}
            </div>
          </div>

          <Field label="Optional Consultation / Nursing Progress Note" htmlFor="v-note">
            <textarea
              id="v-note"
              rows={2}
              placeholder="Document clinical observations or nursing interventions..."
              className={inputCls()}
              value={form.progressReport}
              onChange={(e) => setForm({ ...form, progressReport: e.target.value })}
            />
          </Field>

          <div className="flex justify-end gap-3">
            <Btn variant="ghost" onClick={() => { setOpenForm(false); setErrors({}); }}>
              Cancel
            </Btn>
            <Btn type="submit" variant="safe">
              Save Vitals & MEWS
            </Btn>
          </div>
        </form>
      )}

      {vitalsList.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">No vital signs recorded for this patient yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                <th className="py-2.5 pr-3">Timestamp</th>
                <th className="pr-3">BP (mmHg)</th>
                <th className="pr-3">Heart Rate</th>
                <th className="pr-3">SpO2</th>
                <th className="pr-3">Temp</th>
                <th className="pr-3">MEWS</th>
                <th className="pr-3">Clinical Flags</th>
                <th>Recorded By</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((v) => {
                const tachy = v.IsTachycardic ?? v.HeartRate > 100;
                const hypo = v.IsHypoxic ?? v.OxygenSaturation < 92;
                return (
                  <tr key={v.VitalID} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2.5 pr-3 font-mono text-xs">{v.RecordedTimestamp}</td>
                    <td className="pr-3 font-mono font-semibold">
                      {v.BloodPressureSystolic}/{v.BloodPressureDiastolic}
                    </td>
                    <td className="pr-3 font-mono">{v.HeartRate} bpm</td>
                    <td className="pr-3 font-mono">{v.OxygenSaturation}%</td>
                    <td className="pr-3 font-mono">{v.BodyTemperature}°C</td>
                    <td className="pr-3">
                      <MEWSChip score={v.MEWSScore} />
                    </td>
                    <td className="pr-3 space-x-1">
                      {tachy && (
                        <span className="px-2 py-0.5 rounded bg-red-700 text-white text-xs font-bold">
                          Tachycardic
                        </span>
                      )}
                      {hypo && (
                        <span className="px-2 py-0.5 rounded bg-red-700 text-white text-xs font-bold">
                          Hypoxic
                        </span>
                      )}
                      {!tachy && !hypo && (
                        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold">
                          Within Normal
                        </span>
                      )}
                    </td>
                    <td className="text-xs">{staffName(v.RecordedByStaffID)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {vitalsList.length > 5 && (
        <Btn variant="ghost" onClick={() => setShowAll(!showAll)}>
          {showAll ? 'Show Recent 5 Only' : `Expand All (${vitalsList.length} Readings)`}
        </Btn>
      )}
    </div>
  );
}

function MedicationsAndPrescriptionPadSection({
  patient,
  user,
  formulary,
  prescriptions,
  isOffline,
  staffName,
  onPrescribe,
  onUpdateMedicationStatus
}) {
  const [padOpen, setPadOpen] = useState(false);
  const [drugName, setDrugName] = useState('');
  const [dosage, setDosage] = useState('');
  const [route, setRoute] = useState('PO');
  const [frequency, setFrequency] = useState('BD');
  const [rxResult, setRxResult] = useState(null);
  const [cancellingId, setCancellingId] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelErr, setCancelErr] = useState('');

  const engine = useMemo(() => new SmartPrescriptionEngine(formulary), [formulary]);
  const preCheck = useMemo(() => engine.livePreCheck(drugName, patient), [engine, drugName, patient]);

  function handleSelectDrug(val) {
    setDrugName(val);
    const matched = formulary.find((d) => d.DrugName.toLowerCase() === val.trim().toLowerCase());
    if (matched) {
      setDosage(matched.StandardDosage || '500mg');
      setRoute(matched.Route || 'PO');
    }
  }

  async function submitPrescription(e) {
    e.preventDefault();
    const res = await onPrescribe({
      patientId: patient.PatientID,
      drugName,
      dosage: dosage || preCheck.drug?.StandardDosage || 'Standard',
      route,
      frequency
    });
    setRxResult(res);
    if (res.ok) {
      setDrugName('');
      setDosage('');
      setPadOpen(false);
    }
  }

  async function submitCancelOrder(e) {
    e.preventDefault();
    if (!cancelReason.trim()) {
      setCancelErr('A clinical cancellation reason is mandatory.');
      return;
    }
    await onUpdateMedicationStatus({
      prescriptionId: cancellingId,
      action: 'CANCEL',
      reason: cancelReason.trim()
    });
    setCancellingId(null);
    setCancelReason('');
    setCancelErr('');
  }

  return (
    <div className="space-y-4">
      <CriticalAlert result={rxResult} onDismiss={() => setRxResult(null)} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-extrabold text-lg">Medication Orders & Smart Prescription Pad</h2>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Defensive Pipeline: 1. RBAC (Physician Only) → 2. Allergy Check → 3. Drug Interaction Check
          </p>
        </div>
        {!padOpen && (
          <Btn
            onClick={() => {
              setPadOpen(true);
              setRxResult(null);
            }}
            disabled={isOffline}
          >
            + Authorize New Prescription
          </Btn>
        )}
      </div>

      {isOffline && (
        <div role="alert" className="p-3.5 rounded-xl bg-amber-100 border-2 border-amber-500 text-amber-950 text-sm font-semibold">
          Offline Mode Active: Prescribing is disabled while offline because safety checks must run against the live Firestore patient record.
        </div>
      )}

      {padOpen && (
        <form
          onSubmit={submitPrescription}
          noValidate
          className="border-2 border-blue-700 rounded-2xl p-4 sm:p-5 bg-slate-50 dark:bg-slate-800/50"
        >
          <h3 className="font-extrabold text-lg mb-1">Smart Prescription Pad</h3>
          {user.Role !== 'Physician' && (
            <div className="mb-3 p-3 rounded-xl bg-red-100 dark:bg-red-950/70 border-2 border-red-600 text-red-900 dark:text-red-200 text-sm font-bold">
              RBAC Notice: You are signed in as {user.Role} ({user.StaffID}). Submitting this form will be blocked by Step 1 of the safety pipeline and logged to the Audit Trail.
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Formulary Drug (Autocomplete)" htmlFor="rx-drug">
              <input
                id="rx-drug"
                list="formulary-datalist"
                placeholder="Type or select drug (e.g. Amoxicillin, Ibuprofen)..."
                className={inputCls()}
                value={drugName}
                onChange={(e) => handleSelectDrug(e.target.value)}
                autoComplete="off"
              />
              <datalist id="formulary-datalist">
                {formulary.map((d) => (
                  <option key={d.DrugID} value={d.DrugName}>
                    {d.DrugFamily} — Standard: {d.StandardDosage} ({d.Route})
                  </option>
                ))}
              </datalist>
            </Field>

            <Field label="Authorized Dosage" htmlFor="rx-dosage">
              <input
                id="rx-dosage"
                placeholder="e.g. 500mg"
                className={inputCls()}
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
              />
            </Field>

            <Field label="Administration Route" htmlFor="rx-route">
              <select
                id="rx-route"
                className={inputCls()}
                value={route}
                onChange={(e) => setRoute(e.target.value)}
              >
                <option value="PO">PO (Oral)</option>
                <option value="IV">IV (Intravenous)</option>
                <option value="SC">SC (Subcutaneous)</option>
              </select>
            </Field>

            <Field label="Frequency Schedule" htmlFor="rx-freq">
              <select
                id="rx-freq"
                className={inputCls()}
                value={frequency}
                onChange={(e) => setFrequency(e.target.value)}
              >
                <option value="Daily">Daily (Once daily)</option>
                <option value="BD">BD (Twice daily)</option>
                <option value="TID">TID (Three times daily)</option>
              </select>
            </Field>
          </div>

          {/* Live Pre-Check Banner (triggers immediately as soon as a drug is selected) */}
          {preCheck.status !== 'IDLE' && (
            <div
              role="status"
              className={`p-3.5 rounded-xl border-2 mb-4 ${
                preCheck.status === 'SAFE'
                  ? 'border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-200'
                  : 'border-red-700 bg-red-100 dark:bg-red-950/70 text-red-950 dark:text-red-100'
              }`}
            >
              <p className="font-extrabold text-sm">
                Live Pharmacist Pre-Check: {preCheck.title || preCheck.status}
              </p>
              <p className="text-xs sm:text-sm mt-0.5">{preCheck.message}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <Btn
              variant="ghost"
              onClick={() => {
                setPadOpen(false);
                setDrugName('');
              }}
            >
              Cancel
            </Btn>
            <Btn type="submit" variant="safe" disabled={isOffline}>
              Authorize Prescription
            </Btn>
          </div>
        </form>
      )}

      {/* Cancel Order Reason Modal */}
      {cancellingId && (
        <form
          onSubmit={submitCancelOrder}
          noValidate
          className="p-4 rounded-xl border-2 border-red-600 bg-red-50 dark:bg-red-950/40"
        >
          <h3 className="font-bold text-red-900 dark:text-red-200 mb-2">
            Cancel Prescription {cancellingId}
          </h3>
          <Field
            label="Mandatory Clinical Cancellation Reason"
            htmlFor="cancel-reason"
            error={cancelErr}
          >
            <input
              id="cancel-reason"
              className={inputCls(Boolean(cancelErr))}
              placeholder="e.g. Patient developed rash / Switched to oral alternative"
              value={cancelReason}
              onChange={(e) => {
                setCancelReason(e.target.value);
                setCancelErr('');
              }}
            />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={() => { setCancellingId(null); setCancelReason(''); setCancelErr(''); }}>
              Keep Order
            </Btn>
            <Btn type="submit" variant="danger">
              Confirm Cancellation
            </Btn>
          </div>
        </form>
      )}

      {/* Medication Timeline */}
      {prescriptions.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">No prescriptions recorded for this patient.</p>
      ) : (
        <ul className="space-y-3">
          {prescriptions.map((rx) => {
            const isPending = rx.Status === 'Pending';
            const isAdministered = rx.Status === 'Administered';
            const statusBadge = isAdministered
              ? 'bg-emerald-700 text-white'
              : isPending
              ? 'bg-amber-400 text-slate-950'
              : 'bg-red-700 text-white';

            return (
              <li
                key={rx.PrescriptionID}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-3"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-500">{rx.PrescriptionID}</span>
                    <span className="font-extrabold text-base text-slate-900 dark:text-white">
                      {rx.DrugName || rx.DrugID}
                    </span>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700">
                      {rx.AuthorizedDosage || 'Standard'} · {rx.Route || 'PO'} · {rx.Frequency || 'BD'}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-extrabold ${statusBadge}`}>
                      {rx.Status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Authorized: <span className="font-mono">{rx.AuthorizationTimestamp || rx.DateAuthorized}</span> by{' '}
                    {staffName(rx.PrescribingDoctorID || rx.StaffID)}
                    {rx.AdministeredByNurseID && (
                      <>
                        {' '}
                        · Administered by <strong>{staffName(rx.AdministeredByNurseID)}</strong> at{' '}
                        <span className="font-mono">{rx.AdministeredTimestamp}</span>
                      </>
                    )}
                    {rx.CancelReason && (
                      <>
                        {' '}
                        · Cancelled ({rx.CancelReason})
                      </>
                    )}
                  </p>
                </div>

                {isPending && (
                  <div className="flex items-center gap-2">
                    <Btn
                      variant="safe"
                      onClick={() =>
                        onUpdateMedicationStatus({
                          prescriptionId: rx.PrescriptionID,
                          action: 'ADMINISTER'
                        })
                      }
                    >
                      Mark Administered
                    </Btn>
                    <Btn
                      variant="danger"
                      onClick={() => {
                        setCancellingId(rx.PrescriptionID);
                        setCancelReason('');
                        setCancelErr('');
                      }}
                    >
                      Cancel Order
                    </Btn>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ConsultationNotesSection({ notes, staffName }) {
  if (!notes.length) {
    return <p className="text-slate-600 dark:text-slate-400">No consultation progress reports logged yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {notes.map((c) => (
        <li
          key={c.ConsultID}
          className="border-l-4 border-blue-700 pl-4 py-2 bg-slate-50 dark:bg-slate-800/40 rounded-r-xl"
        >
          <p className="text-xs font-mono text-slate-600 dark:text-slate-400">
            {c.Timestamp} · {staffName(c.StaffID)} · BP {c.Systolic}/{c.Diastolic} mmHg, HR {c.HeartRate} bpm
          </p>
          <p className="mt-1 text-sm sm:text-base text-slate-900 dark:text-slate-100">{c.ProgressReport}</p>
        </li>
      ))}
    </ul>
  );
}

function ClinicalHistorySection({ patient, vitals, prescriptions }) {
  return (
    <div className="grid sm:grid-cols-2 gap-4 text-sm">
      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
        <h3 className="font-bold text-slate-900 dark:text-white mb-2">Demographics & Intake Baseline</h3>
        <dl className="space-y-1.5">
          <div>
            <dt className="text-xs text-slate-500">Medical Record Number (MRN)</dt>
            <dd className="font-mono font-bold">{patient.PatientID}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">National ID</dt>
            <dd className="font-mono">{patient.NationalID || 'Not recorded'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Date of Birth / Age</dt>
            <dd className="font-mono">
              {patient.DOB} ({patient.Age || computeAgeFromDOB(patient.DOB)} yrs)
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Admission Timestamp</dt>
            <dd className="font-mono">{patient.AdmissionTimestamp}</dd>
          </div>
        </dl>
      </div>

      <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700">
        <h3 className="font-bold text-slate-900 dark:text-white mb-2">Longitudinal Summary</h3>
        <dl className="space-y-1.5">
          <div>
            <dt className="text-xs text-slate-500">Recorded Allergies (3NF PATIENT_ALLERGY)</dt>
            <dd className="font-bold text-red-700 dark:text-red-400">
              {patient.Allergies?.length ? patient.Allergies.join(', ') : 'None (NKDA)'}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Active Medications</dt>
            <dd className="font-mono">{patient.ActiveMeds?.length ? patient.ActiveMeds.join(', ') : 'None'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Total Vitals Logged</dt>
            <dd className="font-mono">{vitals.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Total Prescriptions Issued</dt>
            <dd className="font-mono">{prescriptions.length}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}