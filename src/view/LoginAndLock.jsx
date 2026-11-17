import React, { useState } from 'react';
import { Btn, Field, inputCls } from './Primitives.jsx';
import { hashPassword } from '../model/StaffUser.js';

export function LoginScreen({ onSignIn, notice, mode }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const er = {};
    if (!identifier.trim()) er.identifier = 'Staff ID or Email is required.';
    if (!password) er.password = 'Password is required.';
    if (Object.keys(er).length > 0) {
      setErrors(er);
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      await onSignIn(identifier.trim(), password);
    } catch (err) {
      setErrors({ form: err.message || 'Authentication failed. Check your credentials.' });
    } finally {
      setBusy(false);
    }
  }

  function fillQuickDemo(id, pw) {
    setIdentifier(id);
    setPassword(pw);
    setErrors({});
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-slate-100 dark:bg-slate-950">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl p-6 sm:p-8 border-t-8 border-blue-700">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-200">
            Zero Patient Harm
          </span>
          <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
            {mode === 'cloud' ? 'Firebase Auth + Firestore' : 'Local Demo Repository'}
          </span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white">NPMS Clinical Sign In</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-5">
          South African Primary Healthcare Decision-Support Portal
        </p>

        {notice && (
          <div role="status" className="mb-4 p-3 rounded-xl bg-amber-100 dark:bg-amber-950/60 border border-amber-500 text-amber-950 dark:text-amber-200 text-sm font-medium">
            {notice}
          </div>
        )}

        {errors.form && (
          <div role="alert" className="mb-4 p-3.5 rounded-xl bg-red-100 dark:bg-red-950/70 border-2 border-red-600 text-red-900 dark:text-red-200 text-sm font-semibold">
            {errors.form}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <Field
            label="Staff ID or Clinic Email"
            htmlFor="login-id"
            error={errors.identifier}
            hint="e.g. N-1001, P-2001, or n1001@npms.org.za"
          >
            <input
              id="login-id"
              type="text"
              autoComplete="username"
              className={inputCls(Boolean(errors.identifier))}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          </Field>

          <Field label="Password" htmlFor="login-pw" error={errors.password}>
            <input
              id="login-pw"
              type="password"
              autoComplete="current-password"
              className={inputCls(Boolean(errors.password))}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          <div className="flex justify-end mt-6">
            <Btn type="submit" disabled={busy} className="w-full sm:w-auto">
              {busy ? 'Authenticating...' : 'Sign In to Station'}
            </Btn>
          </div>
        </form>

        <div className="mt-6 pt-5 border-t border-slate-200 dark:border-slate-800">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
            One-Tap Demo Credentials (RBAC Verification)
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => fillQuickDemo('N-1001', 'nurse123')}
              className="min-h-[48px] p-2.5 text-left rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs"
            >
              <span className="font-bold block text-slate-900 dark:text-white">Registered Nurse</span>
              <span className="font-mono text-slate-600 dark:text-slate-300">N-1001 / nurse123</span>
            </button>
            <button
              type="button"
              onClick={() => fillQuickDemo('P-2001', 'doctor123')}
              className="min-h-[48px] p-2.5 text-left rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs"
            >
              <span className="font-bold block text-slate-900 dark:text-white">Attending Physician</span>
              <span className="font-mono text-slate-600 dark:text-slate-300">P-2001 / doctor123</span>
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

export function LockScreenModal({ user, onUnlock, onSignOut }) {
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');

  function handleUnlock(e) {
    e.preventDefault();
    if (!pw) {
      setError('Enter your password to unlock the terminal.');
      return;
    }
    if (!user.PasswordHash || user.PasswordHash === hashPassword(pw)) {
      setPw('');
      setError('');
      onUnlock();
    } else {
      setError('Incorrect password for active session.');
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-title"
    >
      <form
        onSubmit={handleUnlock}
        noValidate
        className="bg-white dark:bg-slate-900 rounded-2xl p-6 w-full max-w-md shadow-2xl border-t-8 border-amber-500"
      >
        <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-amber-400 text-slate-950">
          POPIA AUTO-LOCK (2 MIN INACTIVITY)
        </span>
        <h2 id="lock-title" className="text-xl font-extrabold mt-2 text-slate-900 dark:text-white">
          Clinical Terminal Locked
        </h2>
        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1 mb-4">
          Patient health records are hidden to comply with South African POPIA Section 19 privacy safeguards. Active user:{' '}
          <strong>{user.FullName}</strong> (<span className="font-mono">{user.StaffID}</span>).
        </p>

        <Field label="Enter Password to Resume" htmlFor="unlock-pw" error={error}>
          <input
            id="unlock-pw"
            type="password"
            autoFocus
            className={inputCls(Boolean(error))}
            value={pw}
            onChange={(e) => {
              setPw(e.target.value);
              setError('');
            }}
          />
        </Field>

        <div className="flex justify-between gap-3 mt-5">
          <Btn variant="ghost" onClick={onSignOut}>
            Sign Out
          </Btn>
          <Btn type="submit" variant="primary">
            Unlock Terminal
          </Btn>
        </div>
      </form>
    </div>
  );
}