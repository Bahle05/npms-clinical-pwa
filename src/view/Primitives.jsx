import React from 'react';
import { toCanonicalTriage } from '../model/PatientRecord.js';

export const TRIAGE_STYLES = {
  High: {
    rank: 0,
    canonical: 'High',
    colorName: 'Red',
    label: 'Urgent',
    card: 'border-red-600 bg-red-50/90 dark:bg-red-950/30 dark:border-red-500',
    chip: 'bg-red-700 text-white',
    dot: 'bg-red-600'
  },
  Med: {
    rank: 1,
    canonical: 'Med',
    colorName: 'Yellow',
    label: 'Priority',
    card: 'border-amber-500 bg-amber-50/90 dark:bg-amber-950/30 dark:border-amber-400',
    chip: 'bg-amber-400 text-slate-950',
    dot: 'bg-amber-500'
  },
  Low: {
    rank: 2,
    canonical: 'Low',
    colorName: 'Green',
    label: 'Routine',
    card: 'border-emerald-700 bg-emerald-50/90 dark:bg-emerald-950/30 dark:border-emerald-500',
    chip: 'bg-emerald-700 text-white',
    dot: 'bg-emerald-600'
  }
};

export function getTriageStyle(level) {
  const key = toCanonicalTriage(level);
  return TRIAGE_STYLES[key] || TRIAGE_STYLES.Low;
}

export function Btn({ variant = 'primary', className = '', type = 'button', children, ...props }) {
  const variants = {
    primary: 'bg-blue-700 text-white hover:bg-blue-800 dark:bg-blue-600 dark:hover:bg-blue-500 shadow-sm',
    safe: 'bg-emerald-700 text-white hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 shadow-sm',
    danger: 'bg-red-700 text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500 shadow-sm',
    warning: 'bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-sm',
    ghost:
      'bg-white text-slate-800 border-2 border-slate-300 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-600 dark:hover:bg-slate-700'
  };
  return (
    <button
      type={type}
      {...props}
      className={`min-h-[48px] min-w-[48px] px-5 py-2.5 rounded-xl font-semibold text-base transition-colors inline-flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant] || variants.primary} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({ label, htmlFor, error, hint, children }) {
  return (
    <div className="mb-4">
      <label htmlFor={htmlFor} className="block font-semibold text-slate-800 dark:text-slate-100 mb-1">
        {label}
      </label>
      {hint && <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{hint}</p>}
      {children}
      {error && (
        <p
          role="alert"
          className="mt-1.5 text-sm text-red-700 dark:text-red-300 font-semibold border-l-4 border-red-600 pl-2.5 py-0.5 bg-red-50 dark:bg-red-950/50 rounded-r"
        >
          {error}
        </p>
      )}
    </div>
  );
}

export function inputCls(hasError = false) {
  return `w-full min-h-[48px] px-3.5 py-2.5 rounded-xl border-2 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-sans ${
    hasError
      ? 'border-red-600 dark:border-red-500'
      : 'border-slate-300 dark:border-slate-700 focus:border-blue-700 dark:focus:border-blue-400'
  }`;
}

export function CriticalAlert({ result, onDismiss }) {
  if (!result) return null;
  if (result.ok) {
    return (
      <div
        role="status"
        className="rounded-xl border-2 border-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:border-emerald-500 p-4 mb-4 flex justify-between items-start gap-3"
      >
        <div>
          <p className="font-extrabold text-emerald-800 dark:text-emerald-200 text-lg">
            {result.title || 'Confirmed'}
          </p>
          <p className="text-slate-800 dark:text-slate-100">{result.message}</p>
        </div>
        {onDismiss && (
          <Btn variant="ghost" onClick={onDismiss} aria-label="Dismiss confirmation">
            Dismiss
          </Btn>
        )}
      </div>
    );
  }

  const isValidation = ['VALIDATION', 'UNKNOWN_DRUG', 'DB_ERROR', 'NOT_FOUND', 'BOUNDS_ERROR'].includes(
    result.code
  );

  return (
    <div
      role="alert"
      className={`rounded-xl border-4 p-4 mb-4 flex justify-between items-start gap-3 ${
        isValidation
          ? 'border-red-500 bg-red-50 dark:bg-red-950/50'
          : 'border-red-700 bg-red-100 dark:bg-red-950/80 dark:border-red-500'
      }`}
    >
      <div>
        <p className="font-extrabold text-red-800 dark:text-red-200 text-lg">
          {isValidation ? '' : 'STOP — '}
          {result.title || 'Clinical Safety Block'}
        </p>
        <p className="text-red-950 dark:text-red-100 font-medium mt-0.5">{result.message}</p>
        {!isValidation && (
          <p className="mt-1.5 text-xs font-mono text-red-900 dark:text-red-200">
            Zero Patient Harm Policy: The patient record was NOT modified. This blocked attempt has been recorded in the SHA-256 Audit Log.
          </p>
        )}
      </div>
      {onDismiss && (
        <Btn variant="ghost" onClick={onDismiss} aria-label="Dismiss safety alert">
          Dismiss
        </Btn>
      )}
    </div>
  );
}

export function MEWSChip({ score }) {
  if (score === null || score === undefined) {
    return (
      <span className="font-mono text-xs px-2.5 py-1 rounded-md bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold">
        MEWS: N/A
      </span>
    );
  }
  let cls = 'bg-emerald-700 text-white';
  if (score >= 5) cls = 'bg-red-700 text-white';
  else if (score >= 3) cls = 'bg-amber-400 text-slate-950';

  return (
    <span className={`font-mono text-xs px-2.5 py-1 rounded-md font-bold ${cls}`}>
      MEWS: {score}
    </span>
  );
}

/**
 * Accessible inline SVG Sparkline for Vitals trends (Heart Rate & Systolic BP).
 * Uses neutral clinical blue/slate strokes so Red/Green semantics remain strictly reserved.
 */
export function VitalsSparkline({ vitalsList = [] }) {
  const chronological = [...vitalsList].sort((a, b) =>
    String(a.RecordedTimestamp).localeCompare(String(b.RecordedTimestamp))
  );
  if (chronological.length < 2) {
    return (
      <p className="text-xs text-slate-500 dark:text-slate-400 italic">
        Record at least 2 vital sign readings to render trend sparklines.
      </p>
    );
  }

  const width = 260;
  const height = 64;
  const pad = 8;

  const buildPath = (key, minVal, maxVal) => {
    const pts = chronological.map((v, idx) => {
      const x = pad + (idx / (chronological.length - 1)) * (width - pad * 2);
      const raw = Number(v[key]) || minVal;
      const clamped = Math.max(minVal, Math.min(maxVal, raw));
      const y = height - pad - ((clamped - minVal) / (maxVal - minVal || 1)) * (height - pad * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return pts.join(' ');
  };

  const hrPoints = buildPath('HeartRate', 40, 180);
  const sbpPoints = buildPath('BloodPressureSystolic', 70, 220);
  const latest = chronological[chronological.length - 1];

  return (
    <div className="bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
          Longitudinal Trend ({chronological.length} readings)
        </span>
        <span className="text-xs font-mono text-slate-600 dark:text-slate-300">
          Latest: SBP {latest.BloodPressureSystolic} mmHg · HR {latest.HeartRate} bpm
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-16 overflow-visible"
        role="img"
        aria-label={`Vital signs trend across ${chronological.length} readings. Latest systolic BP ${latest.BloodPressureSystolic} over ${latest.BloodPressureDiastolic}, heart rate ${latest.HeartRate} bpm.`}
      >
        <polyline
          fill="none"
          stroke="#1D4ED8"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={sbpPoints}
        />
        <polyline
          fill="none"
          stroke="#64748B"
          strokeWidth="2"
          strokeDasharray="4 2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={hrPoints}
        />
      </svg>
      <div className="flex gap-4 text-xs text-slate-600 dark:text-slate-300 mt-1">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-blue-700 inline-block" /> Systolic BP (mmHg)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-3 h-0.5 bg-slate-500 inline-block" /> Heart Rate (bpm)
        </span>
      </div>
    </div>
  );
}