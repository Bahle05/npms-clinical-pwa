import React, { useState, useEffect, useMemo } from 'react';
import { Btn, inputCls } from './Primitives.jsx';
import { AuditTrail } from '../model/AuditTrail.js';

export function AuditTrailView({ audit }) {
  const [staffFilter, setStaffFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [patientFilter, setPatientFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [verification, setVerification] = useState(null);

  useEffect(() => {
    let active = true;
    AuditTrail.verifyIntegrityHash(audit).then((res) => {
      if (active) setVerification(res);
    });
    return () => {
      active = false;
    };
  }, [audit]);

  const filtered = useMemo(() => {
    return [...audit]
      .sort((a, b) => (b.Ts || 0) - (a.Ts || 0))
      .filter((item) => {
        const staff = (item.ActorStaffID || item.StaffID || '').toLowerCase();
        const act = (item.ActionType || item.Action || '').toLowerCase();
        const pat = (item.PatientID || '').toLowerCase();
        const dt = item.LoggedTimestamp || item.Time || '';
        if (staffFilter && !staff.includes(staffFilter.toLowerCase())) return false;
        if (actionFilter && !act.includes(actionFilter.toLowerCase())) return false;
        if (patientFilter && !pat.includes(patientFilter.toLowerCase())) return false;
        if (dateFilter && !dt.startsWith(dateFilter)) return false;
        return true;
      });
  }, [audit, staffFilter, actionFilter, patientFilter, dateFilter]);

  function handleExportCsv() {
    const csvContent = AuditTrail.exportRegulatoryLog(filtered);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `npms_regulatory_audit_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function handleManualVerify() {
    const res = await AuditTrail.verifyIntegrityHash(audit);
    setVerification(res);
  }

  return (
    <section aria-labelledby="audit-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 id="audit-heading" className="text-2xl font-extrabold text-slate-900 dark:text-white">
            Immutable Regulatory Audit Trail
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Append-only log of all clinical actions and blocked attempts with cryptographic SHA-256 hash chaining
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn variant="ghost" onClick={handleManualVerify}>
            Re-Verify SHA-256 Chain
          </Btn>
          <Btn onClick={handleExportCsv}>Export Regulatory CSV</Btn>
        </div>
      </div>

      {/* Cryptographic Hash-Chain Pass/Fail Banner */}
      {verification && (
        <div
          role="status"
          className={`p-4 rounded-2xl border-2 flex flex-wrap items-center justify-between gap-2 ${
            verification.valid
              ? 'border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-950 dark:text-emerald-100'
              : 'border-red-700 bg-red-100 dark:bg-red-950/80 text-red-950 dark:text-red-100'
          }`}
        >
          <div>
            <p className="font-extrabold text-base">
              {verification.valid
                ? 'PASS — Cryptographic SHA-256 Audit Chain Verified Intact'
                : 'FAIL — Audit Log Integrity Breach Detected'}
            </p>
            <p className="text-xs sm:text-sm mt-0.5">{verification.reason}</p>
          </div>
          {verification.headHash && (
            <span className="font-mono text-xs px-2.5 py-1 rounded bg-white/80 dark:bg-slate-900 border">
              Head Hash: {verification.headHash.slice(0, 16)}...
            </span>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 grid sm:grid-cols-4 gap-3">
        <div>
          <label htmlFor="af-staff" className="block text-xs font-bold mb-1">
            Filter by Staff ID
          </label>
          <input
            id="af-staff"
            placeholder="e.g. N-1001 or P-2001"
            className={inputCls()}
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="af-action" className="block text-xs font-bold mb-1">
            Filter by Action
          </label>
          <input
            id="af-action"
            placeholder="e.g. Prescribe, Vitals..."
            className={inputCls()}
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="af-patient" className="block text-xs font-bold mb-1">
            Filter by Patient MRN
          </label>
          <input
            id="af-patient"
            placeholder="e.g. P-002"
            className={inputCls()}
            value={patientFilter}
            onChange={(e) => setPatientFilter(e.target.value)}
          />
        </div>
        <div>
          <label htmlFor="af-date" className="block text-xs font-bold mb-1">
            Filter by Date
          </label>
          <input
            id="af-date"
            type="date"
            className={inputCls()}
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto p-4">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b-2 border-slate-200 dark:border-slate-700">
              <th className="py-2.5 pr-3">Timestamp</th>
              <th className="pr-3">Actor</th>
              <th className="pr-3">Action Type</th>
              <th className="pr-3">Patient</th>
              <th className="pr-3">Outcome</th>
              <th className="pr-3">Transaction Details</th>
              <th>SHA-256 Hash Link</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => (
              <tr key={a.LogID} className="border-b border-slate-100 dark:border-slate-800 align-top">
                <td className="py-2.5 pr-3 font-mono text-xs whitespace-nowrap">
                  {a.LoggedTimestamp || a.Time}
                </td>
                <td className="py-2.5 pr-3 font-mono text-xs font-bold">
                  {a.ActorStaffID || a.StaffID}
                </td>
                <td className="py-2.5 pr-3 font-medium">{a.ActionType || a.Action}</td>
                <td className="py-2.5 pr-3 font-mono text-xs">{a.PatientID}</td>
                <td className="py-2.5 pr-3">
                  <span
                    className={`px-2.5 py-0.5 rounded font-extrabold text-xs ${
                      a.Outcome === 'SUCCESS'
                        ? 'bg-emerald-700 text-white'
                        : 'bg-red-700 text-white'
                    }`}
                  >
                    {a.Outcome}
                  </span>
                </td>
                <td className="py-2.5 pr-3 text-xs sm:text-sm">
                  {a.TransactionDetails || a.Detail}
                </td>
                <td className="py-2.5 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                  <div>Prev: {(a.PrevHash || '').slice(0, 10)}...</div>
                  <div>Hash: {(a.IntegrityHash || '').slice(0, 10)}...</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}