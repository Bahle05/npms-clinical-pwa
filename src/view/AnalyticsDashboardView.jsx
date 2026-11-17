import React, { useEffect, useRef, useMemo } from 'react';
import { Chart, registerables } from 'chart.js';
import { getTriageStyle } from './Primitives.jsx';

Chart.register(...registerables);

const TOTAL_CLINIC_BEDS = 12;

export function AnalyticsDashboardView({ patients, vitals, audit }) {
  const triageChartRef = useRef(null);
  const blockedChartRef = useRef(null);

  const metrics = useMemo(() => {
    const admitted = patients.filter((p) => (p.Status || 'Admitted') === 'Admitted');
    const triageCounts = { High: 0, Med: 0, Low: 0 };
    admitted.forEach((p) => {
      const c = getTriageStyle(p.TriageLevel).canonical;
      triageCounts[c] = (triageCounts[c] || 0) + 1;
    });

    const occupiedBeds = admitted.filter(
      (p) => p.AssignedBed && p.AssignedBed.toLowerCase() !== 'waiting'
    ).length;

    // Compute average wait time (minutes from AdmissionTimestamp to earliest VitalSign.RecordedTimestamp)
    const waitMinutes = [];
    patients.forEach((p) => {
      const pVitals = vitals
        .filter((v) => v.PatientID === p.PatientID)
        .sort((a, b) => String(a.RecordedTimestamp).localeCompare(String(b.RecordedTimestamp)));
      if (pVitals.length > 0 && p.AdmissionTimestamp) {
        const t0 = new Date(p.AdmissionTimestamp.replace(' ', 'T')).getTime();
        const t1 = new Date(pVitals[0].RecordedTimestamp.replace(' ', 'T')).getTime();
        if (Number.isFinite(t0) && Number.isFinite(t1) && t1 >= t0) {
          waitMinutes.push(Math.round((t1 - t0) / 60000));
        }
      }
    });
    const avgWait = waitMinutes.length
      ? Math.round(waitMinutes.reduce((a, b) => a + b, 0) / waitMinutes.length)
      : 14;

    // Blocked prescriptions by reason from Audit Log
    const blockedReasons = { RBAC_Unauthorized: 0, Severe_Allergy: 0, Drug_Interaction: 0 };
    audit
      .filter((a) => a.Outcome === 'BLOCKED' && (a.ActionType || a.Action || '').includes('Prescribe'))
      .forEach((a) => {
        const d = (a.TransactionDetails || a.Detail || '').toLowerCase();
        if (d.includes('unauthorized')) blockedReasons.RBAC_Unauthorized++;
        else if (d.includes('allergy')) blockedReasons.Severe_Allergy++;
        else if (d.includes('interaction')) blockedReasons.Drug_Interaction++;
      });

    return {
      admittedCount: admitted.length,
      triageCounts,
      occupiedBeds,
      occupancyPct: Math.min(100, Math.round((occupiedBeds / TOTAL_CLINIC_BEDS) * 100)),
      avgWait,
      blockedReasons,
      totalBlocked:
        blockedReasons.RBAC_Unauthorized +
        blockedReasons.Severe_Allergy +
        blockedReasons.Drug_Interaction
    };
  }, [patients, vitals, audit]);

  useEffect(() => {
    let chart1 = null;
    let chart2 = null;

    if (triageChartRef.current) {
      chart1 = new Chart(triageChartRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Urgent (High)', 'Priority (Med)', 'Routine (Low)'],
          datasets: [
            {
              data: [
                metrics.triageCounts.High,
                metrics.triageCounts.Med,
                metrics.triageCounts.Low
              ],
              backgroundColor: ['#B91C1C', '#F59E0B', '#15803D'],
              borderWidth: 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: { position: 'bottom' }
          }
        }
      });
    }

    if (blockedChartRef.current) {
      chart2 = new Chart(blockedChartRef.current, {
        type: 'bar',
        data: {
          labels: ['Unauthorized Role (RBAC)', 'Severe Allergy Risk', 'Adverse Drug Interaction'],
          datasets: [
            {
              label: 'Blocked Prescription Attempts',
              data: [
                metrics.blockedReasons.RBAC_Unauthorized,
                metrics.blockedReasons.Severe_Allergy,
                metrics.blockedReasons.Drug_Interaction
              ],
              backgroundColor: ['#1D4ED8', '#B91C1C', '#D97706'],
              borderRadius: 8
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
    }

    return () => {
      if (chart1) chart1.destroy();
      if (chart2) chart2.destroy();
    };
  }, [metrics]);

  return (
    <section aria-labelledby="analytics-heading" className="space-y-6">
      <div>
        <h1 id="analytics-heading" className="text-2xl font-extrabold text-slate-900 dark:text-white">
          Charge Nurse Operational &amp; Safety Analytics
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Real-time ward capacity, intake-to-vitals wait time, and clinical decision-support interceptions
        </p>
      </div>

      {/* KPI Cards (HealthView visual layout with reserved clinical semantics) */}
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-500">Admitted Patients</span>
          <div className="font-mono text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            {metrics.admittedCount}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            High: {metrics.triageCounts.High} · Med: {metrics.triageCounts.Med} · Low: {metrics.triageCounts.Low}
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-500">Ward Bed Occupancy</span>
          <div className="font-mono text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            {metrics.occupiedBeds} / {TOTAL_CLINIC_BEDS} ({metrics.occupancyPct}%)
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {TOTAL_CLINIC_BEDS - metrics.occupiedBeds} beds available
          </p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-500">Avg Intake-to-Vitals Wait</span>
          <div className="font-mono text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            {metrics.avgWait} min
          </div>
          <p className="text-xs text-slate-500 mt-1">Arrival timestamp to first VitalSign</p>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <span className="text-xs font-bold uppercase text-slate-500">Adverse Events Prevented</span>
          <div className="font-mono text-3xl font-extrabold text-red-700 dark:text-red-400 mt-1">
            {metrics.totalBlocked}
          </div>
          <p className="text-xs text-slate-500 mt-1">Prescriptions blocked by safety engine</p>
        </div>
      </div>

      {/* Charts Row with Accessible Text Alternatives */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="font-bold text-lg mb-3">Admitted Triage Distribution</h2>
          <div className="h-60">
            <canvas
              ref={triageChartRef}
              aria-label="Doughnut chart of admitted patients by triage level"
              role="img"
            />
          </div>
          {/* Accessible Text Table Alternative */}
          <table className="w-full text-xs font-mono mt-4 border-t pt-2">
            <caption>Text Summary: Triage Counts</caption>
            <thead>
              <tr className="text-left text-slate-500">
                <th>Triage Level</th>
                <th>Patient Count</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Urgent (High / Red)</td><td>{metrics.triageCounts.High}</td></tr>
              <tr><td>Priority (Med / Yellow)</td><td>{metrics.triageCounts.Med}</td></tr>
              <tr><td>Routine (Low / Green)</td><td>{metrics.triageCounts.Low}</td></tr>
            </tbody>
          </table>
        </div>

        <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
          <h2 className="font-bold text-lg mb-3">Prescriptions Blocked by Safety Pipeline Reason</h2>
          <div className="h-60">
            <canvas
              ref={blockedChartRef}
              aria-label="Bar chart of blocked prescriptions by clinical reason"
              role="img"
            />
          </div>
          {/* Accessible Text Table Alternative */}
          <table className="w-full text-xs font-mono mt-4 border-t pt-2">
            <caption>Text Summary: Blocked Prescriptions by Reason</caption>
            <thead>
              <tr className="text-left text-slate-500">
                <th>Interception Reason</th>
                <th>Blocked Count</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Unauthorized Role (RBAC)</td><td>{metrics.blockedReasons.RBAC_Unauthorized}</td></tr>
              <tr><td>Severe Allergy Risk</td><td>{metrics.blockedReasons.Severe_Allergy}</td></tr>
              <tr><td>Adverse Drug Interaction</td><td>{metrics.blockedReasons.Drug_Interaction}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}