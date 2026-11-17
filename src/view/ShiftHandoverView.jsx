import React from 'react';
import { Btn, getTriageStyle, MEWSChip } from './Primitives.jsx';
import { computeAgeFromDOB } from '../model/PatientRecord.js';

export function ShiftHandoverView({ patients, user }) {
  const admitted = patients
    .filter((p) => (p.Status || 'Admitted') === 'Admitted')
    .sort((a, b) => getTriageStyle(a.TriageLevel).rank - getTriageStyle(b.TriageLevel).rank);

  return (
    <section aria-labelledby="handover-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <div>
          <h1 id="handover-heading" className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Nursing Shift Handover Summary (SBAR Report)
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Printable view of all admitted patients with allergies, active medications, latest vitals, and MEWS
          </p>
        </div>
        <Btn onClick={() => window.print()}>Print Handover Summary</Btn>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
        <div className="flex flex-wrap justify-between items-center border-b pb-3 mb-4 text-xs font-mono">
          <span>FACILITY: Primary Healthcare Clinic — Ward A</span>
          <span>PREPARED BY: {user.FullName} ({user.StaffID})</span>
          <span>GENERATED: {new Date().toISOString().slice(0, 16).replace('T', ' ')}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-300 dark:border-slate-700">
                <th className="py-2 pr-3">Bed / MRN</th>
                <th className="pr-3">Patient &amp; Triage</th>
                <th className="pr-3">Presenting Complaint</th>
                <th className="pr-3">Severe Allergies</th>
                <th className="pr-3">Active Medications</th>
                <th className="pr-3">Latest Vitals</th>
                <th>MEWS</th>
              </tr>
            </thead>
            <tbody>
              {admitted.map((p) => {
                const st = getTriageStyle(p.TriageLevel);
                const lv = p.LastVitals;
                return (
                  <tr key={p.PatientID} className="border-b border-slate-200 dark:border-slate-800 align-top">
                    <td className="py-3 pr-3 font-mono text-xs">
                      <strong>{p.AssignedBed || 'Waiting'}</strong>
                      <br />
                      {p.PatientID}
                    </td>
                    <td className="py-3 pr-3">
                      <strong className="block">{p.FullName}</strong>
                      <span className="text-xs text-slate-500">
                        {p.Gender} · {p.Age || computeAgeFromDOB(p.DOB)} yrs
                      </span>
                      <div className="mt-1">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${st.chip}`}>
                          {st.label} ({st.canonical})
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-xs sm:text-sm">{p.MainComplaint}</td>
                    <td className="py-3 pr-3">
                      {p.Allergies?.length ? (
                        <span className="px-2 py-1 rounded bg-red-700 text-white text-xs font-extrabold">
                          {p.Allergies.join(', ')}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">NKDA</span>
                      )}
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs">
                      {p.ActiveMeds?.length ? p.ActiveMeds.join(', ') : 'None'}
                    </td>
                    <td className="py-3 pr-3 font-mono text-xs">
                      {lv
                        ? `BP ${lv.BloodPressureSystolic}/${lv.BloodPressureDiastolic}, HR ${lv.HeartRate}, SpO2 ${lv.OxygenSaturation}%, ${lv.BodyTemperature}°C`
                        : 'Pending'}
                    </td>
                    <td className="py-3">
                      <MEWSChip score={p.MEWSScore ?? lv?.MEWSScore} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}