import React, { useState } from 'react';
import { Btn, Field, inputCls, getTriageStyle, MEWSChip, CriticalAlert } from './Primitives.jsx';
import { computeAgeFromDOB } from '../model/PatientRecord.js';
import { evaluateVitalsSubmission } from '../controller/ClinicalController.js';
import { t } from '../i18n/translations.js';

export function WhiteboardView({
  patients,
  user,
  lang,
  selectedPatientId,
  onSelectPatient,
  onNavigateRegister,
  onQuickSaveVitals
}) {
  const [statusFilter, setStatusFilter] = useState('Admitted');
  const [quickVitalPatient, setQuickVitalPatient] = useState(null);
  const [qf, setQf] = useState({ sys: '120', dia: '80', hr: '78', spo2: '98', temp: '36.8', rr: '16' });
  const [qErr, setQErr] = useState({});
  const [banner, setBanner] = useState(null);

  const filtered = patients.filter((p) => (p.Status || 'Admitted') === statusFilter);
  const sorted = [...filtered].sort((a, b) => {
    const styleA = getTriageStyle(a.TriageLevel);
    const styleB = getTriageStyle(b.TriageLevel);
    if (styleA.rank !== styleB.rank) return styleA.rank - styleB.rank;
    return String(a.Arrived || a.AdmissionTimestamp).localeCompare(String(b.Arrived || b.AdmissionTimestamp));
  });

  const counts = { High: 0, Med: 0, Low: 0 };
  patients
    .filter((p) => (p.Status || 'Admitted') === 'Admitted')
    .forEach((p) => {
      const c = getTriageStyle(p.TriageLevel).canonical;
      counts[c] = (counts[c] || 0) + 1;
    });

  async function submitQuickVitals(e) {
    e.preventDefault();
    if (!quickVitalPatient) return;
    const evaluation = evaluateVitalsSubmission(
      {
        HeartRate: Number(qf.hr),
        BloodPressureSystolic: Number(qf.sys),
        BloodPressureDiastolic: Number(qf.dia),
        OxygenSaturation: Number(qf.spo2),
        BodyTemperature: Number(qf.temp),
        RespiratoryRate: Number(qf.rr),
        AVPU: 'A'
      },
      quickVitalPatient
    );
    if (!evaluation.ok) {
      setQErr(evaluation.errors);
      return;
    }
    await onQuickSaveVitals({
      patientId: quickVitalPatient.PatientID,
      vitalRecord: evaluation.vital,
      finalTriage: evaluation.finalTriage,
      overridden: false,
      suggestedTriage: evaluation.suggestedTriage,
      progressReport: 'Quick-add bedside vitals recorded from Whiteboard.'
    });
    setBanner({
      ok: true,
      title: 'Quick Vitals Logged',
      message: `Updated ${quickVitalPatient.FullName}: BP ${qf.sys}/${qf.dia}, HR ${qf.hr} bpm, SpO2 ${qf.spo2}%, MEWS ${evaluation.mews.score}.`
    });
    setQuickVitalPatient(null);
    setQErr({});
  }

  return (
    <section aria-labelledby="wb-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 id="wb-heading" className="text-2xl font-extrabold text-slate-900 dark:text-white">
            {t(lang, 'whiteboard')}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Sorted by clinical triage priority and arrival timestamp
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-xl bg-slate-200 dark:bg-slate-800 p-1">
            {['Admitted', 'Discharged'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`min-h-[42px] px-3.5 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                  statusFilter === st
                    ? 'bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm'
                    : 'text-slate-700 dark:text-slate-300'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
          <Btn onClick={onNavigateRegister}>{t(lang, 'registerPatient')}</Btn>
        </div>
      </div>

      {/* Sticky Triage Summary Strip */}
      <div className="sticky top-16 z-20 bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur py-2 mb-4 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <span className="px-3.5 py-1.5 rounded-full text-sm font-bold bg-red-700 text-white">
            {t(lang, 'urgent')}: <span className="font-mono">{counts.High}</span>
          </span>
          <span className="px-3.5 py-1.5 rounded-full text-sm font-bold bg-amber-400 text-slate-950">
            {t(lang, 'priority')}: <span className="font-mono">{counts.Med}</span>
          </span>
          <span className="px-3.5 py-1.5 rounded-full text-sm font-bold bg-emerald-700 text-white">
            {t(lang, 'routine')}: <span className="font-mono">{counts.Low}</span>
          </span>
        </div>
        <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
          Showing {sorted.length} {statusFilter.toLowerCase()} patient(s)
        </span>
      </div>

      <CriticalAlert result={banner} onDismiss={() => setBanner(null)} />

      {/* Quick-Add Vitals Modal (COULD #14) */}
      {quickVitalPatient && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label={`Quick vitals for ${quickVitalPatient.FullName}`}
        >
          <form
            onSubmit={submitQuickVitals}
            noValidate
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-lg w-full shadow-2xl border-2 border-blue-700"
          >
            <h2 className="text-lg font-extrabold mb-1">
              Quick-Add Bedside Vitals: {quickVitalPatient.FullName}
            </h2>
            <p className="text-xs font-mono text-slate-500 mb-4">
              {quickVitalPatient.PatientID} · Bed {quickVitalPatient.AssignedBed} · Staff {user.StaffID}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Field label="Systolic BP" htmlFor="qv-sys" error={qErr.BloodPressureSystolic}>
                <input
                  id="qv-sys"
                  inputMode="numeric"
                  className={inputCls(Boolean(qErr.BloodPressureSystolic))}
                  value={qf.sys}
                  onChange={(e) => setQf({ ...qf, sys: e.target.value })}
                />
              </Field>
              <Field label="Diastolic BP" htmlFor="qv-dia" error={qErr.BloodPressureDiastolic}>
                <input
                  id="qv-dia"
                  inputMode="numeric"
                  className={inputCls(Boolean(qErr.BloodPressureDiastolic))}
                  value={qf.dia}
                  onChange={(e) => setQf({ ...qf, dia: e.target.value })}
                />
              </Field>
              <Field label="Heart Rate" htmlFor="qv-hr" error={qErr.HeartRate}>
                <input
                  id="qv-hr"
                  inputMode="numeric"
                  className={inputCls(Boolean(qErr.HeartRate))}
                  value={qf.hr}
                  onChange={(e) => setQf({ ...qf, hr: e.target.value })}
                />
              </Field>
              <Field label="SpO2 (%)" htmlFor="qv-spo2" error={qErr.OxygenSaturation}>
                <input
                  id="qv-spo2"
                  inputMode="numeric"
                  className={inputCls(Boolean(qErr.OxygenSaturation))}
                  value={qf.spo2}
                  onChange={(e) => setQf({ ...qf, spo2: e.target.value })}
                />
              </Field>
              <Field label="Temp (°C)" htmlFor="qv-temp" error={qErr.BodyTemperature}>
                <input
                  id="qv-temp"
                  inputMode="decimal"
                  className={inputCls(Boolean(qErr.BodyTemperature))}
                  value={qf.temp}
                  onChange={(e) => setQf({ ...qf, temp: e.target.value })}
                />
              </Field>
              <Field label="Resp Rate" htmlFor="qv-rr" error={qErr.RespiratoryRate}>
                <input
                  id="qv-rr"
                  inputMode="numeric"
                  className={inputCls(Boolean(qErr.RespiratoryRate))}
                  value={qf.rr}
                  onChange={(e) => setQf({ ...qf, rr: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Btn variant="ghost" onClick={() => { setQuickVitalPatient(null); setQErr({}); }}>
                Cancel
              </Btn>
              <Btn type="submit" variant="safe">
                Save Quick Vitals
              </Btn>
            </div>
          </form>
        </div>
      )}

      {sorted.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 text-center shadow-sm border border-slate-200 dark:border-slate-800">
          <p className="text-slate-600 dark:text-slate-400">No {statusFilter.toLowerCase()} patients in queue.</p>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {sorted.map((p) => {
            const style = getTriageStyle(p.TriageLevel);
            const age = p.Age || computeAgeFromDOB(p.DOB);
            const lv = p.LastVitals;
            const isSelected = selectedPatientId === p.PatientID;
            return (
              <li
                key={p.PatientID}
                className={`rounded-2xl border-l-8 border-2 shadow-sm transition-all flex flex-col justify-between ${style.card} ${
                  isSelected ? 'ring-4 ring-blue-600' : ''
                }`}
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectPatient(p.PatientID)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectPatient(p.PatientID);
                    }
                  }}
                  aria-label={`Open clipboard for ${p.FullName}, triage ${style.label}`}
                  className="p-4 text-left cursor-pointer flex-1 focus:outline-none"
                >
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <span className="font-extrabold text-lg text-slate-900 dark:text-white block">
                        {p.FullName}
                      </span>
                      <span className="font-mono text-xs text-slate-700 dark:text-slate-300">
                        {p.PatientID} · {p.Gender} · {age} yrs · Bed: <strong>{p.AssignedBed || 'Waiting'}</strong>
                      </span>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-extrabold whitespace-nowrap ${style.chip}`}>
                      {style.label} ({style.canonical})
                    </span>
                  </div>

                  <p className="mt-2 text-sm font-medium text-slate-800 dark:text-slate-100">
                    {p.MainComplaint}
                  </p>

                  {/* Last Vitals & MEWS strip */}
                  <div className="mt-3 pt-2.5 border-t border-slate-300/70 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                    {lv ? (
                      <span className="font-mono text-slate-800 dark:text-slate-200">
                        BP {lv.BloodPressureSystolic}/{lv.BloodPressureDiastolic} · HR {lv.HeartRate} · SpO2 {lv.OxygenSaturation}%
                      </span>
                    ) : (
                      <span className="italic text-slate-600 dark:text-slate-400">Awaiting first vitals</span>
                    )}
                    <MEWSChip score={p.MEWSScore ?? lv?.MEWSScore} />
                  </div>

                  {/* Allergy & Active Meds badges */}
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                    {p.Allergies && p.Allergies.length > 0 ? (
                      <span className="inline-block bg-red-700 text-white text-xs font-extrabold px-2.5 py-1 rounded-md">
                        {t(lang, 'allergyBadge')}: {p.Allergies.join(', ')}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">No known allergies</span>
                    )}
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-400">
                      Arrived {p.Arrived || String(p.AdmissionTimestamp).slice(-5)}
                    </span>
                  </div>
                </div>

                {p.Status !== 'Discharged' && (
                  <div className="px-4 pb-3 pt-1 flex justify-end gap-2 border-t border-slate-200/60 dark:border-slate-800/60">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuickVitalPatient(p);
                      }}
                      className="min-h-[48px] px-3 py-1.5 rounded-lg text-xs font-bold bg-white/90 dark:bg-slate-800 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700 hover:bg-blue-50"
                    >
                      + {t(lang, 'quickVitals')}
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectPatient(p.PatientID)}
                      className="min-h-[48px] px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-700 text-white hover:bg-blue-800"
                    >
                      Open Clipboard →
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}