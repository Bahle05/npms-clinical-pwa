import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRepository } from './firebase/repositories.js';
import { norm } from './controller/SmartPrescriptionEngine.js';
import { t } from './i18n/translations.js';
import { inputCls } from './view/Primitives.jsx';
import { LoginScreen, LockScreenModal } from './view/LoginAndLock.jsx';
import { WhiteboardView } from './view/WhiteboardView.jsx';
import { ClipboardView } from './view/ClipboardView.jsx';
import { RegisterPatientView } from './view/RegisterPatientView.jsx';
import { AnalyticsDashboardView } from './view/AnalyticsDashboardView.jsx';
import { ShiftHandoverView } from './view/ShiftHandoverView.jsx';
import { AuditTrailView } from './view/AuditTrailView.jsx';

const LOCK_AFTER_MS = 2 * 60 * 1000; // 2 minutes POPIA inactivity auto-lock

export default function App() {
  const repo = useMemo(() => createRepository(), []);
  const [storeData, setStoreData] = useState({
    users: [],
    formulary: [],
    patients: [],
    vitals: [],
    consultations: [],
    prescriptions: [],
    audit: []
  });
  const [user, setUser] = useState(null);
  const [locked, setLocked] = useState(false);
  const [notice, setNotice] = useState('');
  const [route, setRoute] = useState({ name: 'board', patientId: null });
  const [searchQuery, setSearchQuery] = useState('');
  const [isOffline, setIsOffline] = useState(typeof navigator !== 'undefined' ? !navigator.onLine : false);
  const [lang, setLang] = useState('en');
  const [darkMode, setDarkMode] = useState(false);
  const inactivityTimer = useRef(null);

  // Subscribe to repository data stream only AFTER sign-in. The security rules require a signed-in
  // user, and a Firestore listener that fails on mount is never restarted after login.
  useEffect(() => {
    if (!user) return undefined;
    const unsub = repo.subscribe(
      (snapshot) => setStoreData(snapshot),
      (err) => setNotice(err?.message || 'Database connection error.')
    );
    return () => unsub && unsub();
  }, [repo, user]);

  // Monitor online/offline connectivity state
  useEffect(() => {
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  // Toggle dark mode class on root HTML element
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) root.classList.add('dark');
    else root.classList.remove('dark');
  }, [darkMode]);

  // POPIA 2-minute inactivity screen lock timer
  useEffect(() => {
    if (!user || locked) return;
    const resetTimer = () => {
      clearTimeout(inactivityTimer.current);
      inactivityTimer.current = setTimeout(() => setLocked(true), LOCK_AFTER_MS);
    };
    const events = ['mousemove', 'keydown', 'touchstart', 'click'];
    events.forEach((ev) => window.addEventListener(ev, resetTimer));
    resetTimer();
    return () => {
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      clearTimeout(inactivityTimer.current);
    };
  }, [user, locked]);

  const searchSuggestions = useMemo(() => {
    const q = norm(searchQuery);
    if (!q) return [];
    return storeData.patients
      .filter(
        (p) =>
          norm(p.FullName).includes(q) ||
          norm(p.PatientID).includes(q) ||
          norm(p.AssignedBed).includes(q)
      )
      .slice(0, 6);
  }, [searchQuery, storeData.patients]);

  async function handleSignIn(identifier, password) {
    const loggedInUser = await repo.signIn(identifier, password);
    setUser(loggedInUser);
    setNotice('');
  }

  async function handleSignOut() {
    await repo.signOut(user);
    setUser(null);
    setLocked(false);
    setRoute({ name: 'board', patientId: null });
    setNotice('Signed out safely.');
  }

  if (!user) {
    return <LoginScreen onSignIn={handleSignIn} notice={notice} mode={repo.mode} />;
  }

  const selectedPatient = route.patientId
    ? storeData.patients.find((p) => p.PatientID === route.patientId)
    : null;

  const navItems = [
    { id: 'board', label: t(lang, 'whiteboard') },
    { id: 'register', label: t(lang, 'registerPatient') },
    { id: 'analytics', label: t(lang, 'analytics') },
    { id: 'handover', label: t(lang, 'handover') },
    { id: 'audit', label: t(lang, 'auditTrail') }
  ];

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-20 md:pb-0">
      {locked && (
        <LockScreenModal
          user={user}
          onUnlock={() => setLocked(false)}
          onSignOut={handleSignOut}
        />
      )}

      {/* Left Sidebar Navigation for Tablets & Desktops */}
      <aside
        aria-label="Primary clinic navigation"
        className="hidden md:flex md:w-64 lg:w-72 bg-slate-900 text-white flex-col justify-between p-4 shrink-0 no-print"
      >
        <div>
          <div className="pb-4 mb-4 border-b border-slate-800">
            <h1 className="font-extrabold text-xl tracking-tight text-white">
              {t(lang, 'appName')}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">{user.FullName}</p>
            <p className="font-mono text-xs text-blue-400">
              {user.Role} · {user.StaffID}
            </p>
            <span
              className={`mt-2 inline-block px-2.5 py-1 rounded text-[11px] font-bold ${
                isOffline
                  ? 'bg-amber-400 text-slate-950'
                  : repo.mode === 'cloud'
                  ? 'bg-emerald-700 text-white'
                  : 'bg-blue-700 text-white'
              }`}
            >
              {isOffline
                ? 'OFFLINE QUEUE MODE'
                : repo.mode === 'cloud'
                ? t(lang, 'onlineSynced')
                : t(lang, 'demoMode')}
            </span>
          </div>

          <nav className="space-y-2">
            {navItems.map((item) => {
              const active = route.name === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => setRoute({ name: item.id, patientId: route.patientId })}
                  className={`w-full text-left min-h-[48px] px-4 py-2.5 rounded-xl font-semibold transition-colors ${
                    active ? 'bg-blue-700 text-white shadow' : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="space-y-2 pt-4 border-t border-slate-800">
          {/* Language & Night Shift Toggles */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'zu' : 'en')}
              className="flex-1 min-h-[48px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold"
            >
              {lang === 'en' ? 'isiZulu UI' : 'English UI'}
            </button>
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="flex-1 min-h-[48px] px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold"
            >
              {darkMode ? t(lang, 'lightMode') : t(lang, 'darkMode')}
            </button>
          </div>

          <button
            type="button"
            onClick={() => setLocked(true)}
            className="w-full text-left min-h-[48px] px-4 rounded-xl font-semibold text-amber-300 hover:bg-slate-800"
          >
            {t(lang, 'lockScreen')}
          </button>
          <button
            type="button"
            onClick={handleSignOut}
            className="w-full text-left min-h-[48px] px-4 rounded-xl font-semibold text-red-300 hover:bg-slate-800"
          >
            {t(lang, 'signOut')}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Offline Sync Warning Banner */}
        {isOffline && (
          <div
            role="status"
            className="bg-amber-400 text-slate-950 font-bold text-xs sm:text-sm px-4 py-2.5 text-center no-print"
          >
            {t(lang, 'offlineBanner')}
          </div>
        )}

        {/* Top Universal Search Bar Header */}
        <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 sm:px-6 flex items-center justify-between gap-3 sticky top-0 z-30 no-print">
          <div className="relative flex-1 max-w-xl">
            <label htmlFor="universal-search" className="sr-only">
              {t(lang, 'searchPlaceholder')}
            </label>
            <input
              id="universal-search"
              type="search"
              placeholder={t(lang, 'searchPlaceholder')}
              className={inputCls()}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoComplete="off"
            />
            {searchSuggestions.length > 0 && (
              <ul
                role="listbox"
                className="absolute left-0 right-0 mt-1 bg-white dark:bg-slate-900 border-2 border-slate-300 dark:border-slate-700 rounded-xl shadow-xl overflow-hidden z-50"
              >
                {searchSuggestions.map((p) => (
                  <li key={p.PatientID}>
                    <button
                      type="button"
                      role="option"
                      onClick={() => {
                        setRoute({ name: 'patient', patientId: p.PatientID });
                        setSearchQuery('');
                      }}
                      className="w-full text-left min-h-[48px] px-4 py-2 hover:bg-blue-50 dark:hover:bg-slate-800 flex items-center justify-between"
                    >
                      <span className="font-bold">{p.FullName}</span>
                      <span className="font-mono text-xs text-slate-500">
                        {p.PatientID} · {p.AssignedBed}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex md:hidden items-center gap-2">
            <button
              type="button"
              onClick={() => setLang(lang === 'en' ? 'zu' : 'en')}
              className="min-h-[48px] px-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-xs font-bold"
            >
              {lang.toUpperCase()}
            </button>
            <button
              type="button"
              onClick={() => setLocked(true)}
              className="min-h-[48px] px-3 rounded-xl bg-amber-400 text-slate-950 text-xs font-bold"
            >
              Lock
            </button>
          </div>
        </header>

        {/* Main Workspace */}
        <main className="p-4 sm:p-6 flex-1">
          {route.name === 'board' && (
            <WhiteboardView
              patients={storeData.patients}
              user={user}
              lang={lang}
              selectedPatientId={route.patientId}
              onSelectPatient={(id) => setRoute({ name: 'patient', patientId: id })}
              onNavigateRegister={() => setRoute({ name: 'register', patientId: null })}
              onQuickSaveVitals={(payload) =>
                repo.recordVitalsAndConsult({ ...payload, actorUser: user })
              }
            />
          )}

          {route.name === 'patient' && selectedPatient && (
            <ClipboardView
              key={selectedPatient.PatientID}
              patient={selectedPatient}
              user={user}
              users={storeData.users}
              formulary={storeData.formulary}
              vitals={storeData.vitals}
              consultations={storeData.consultations}
              prescriptions={storeData.prescriptions}
              isOffline={isOffline}
              lang={lang}
              onBack={() => setRoute({ name: 'board', patientId: null })}
              onRecordVitals={(payload) =>
                repo.recordVitalsAndConsult({ ...payload, actorUser: user })
              }
              onPrescribe={(payload) =>
                repo.prescribe({ ...payload, user, isOffline })
              }
              onUpdateMedicationStatus={(payload) =>
                repo.updateMedicationStatus({ ...payload, actorUser: user })
              }
              onUpdateBed={(patientId, newBed) =>
                repo.updatePatientBed(patientId, newBed, user)
              }
              onDischarge={(patientId) => repo.dischargePatient(patientId, user)}
            />
          )}

          {route.name === 'register' && (
            <RegisterPatientView
              patients={storeData.patients}
              onSavePatient={async (patientData) => {
                const newId = await repo.addPatient(patientData, user);
                setRoute({ name: 'patient', patientId: newId });
              }}
              onCancel={() => setRoute({ name: 'board', patientId: null })}
              onOpenExisting={(existingId) => setRoute({ name: 'patient', patientId: existingId })}
            />
          )}

          {route.name === 'analytics' && (
            <AnalyticsDashboardView
              patients={storeData.patients}
              vitals={storeData.vitals}
              audit={storeData.audit}
            />
          )}

          {route.name === 'handover' && (
            <ShiftHandoverView patients={storeData.patients} user={user} />
          )}

          {route.name === 'audit' && <AuditTrailView audit={storeData.audit} />}
        </main>
      </div>

      {/* Bottom Navigation Bar for Phones (<768px) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900 text-white border-t border-slate-800 grid grid-cols-5 gap-1 p-1.5 no-print"
      >
        {navItems.map((item) => {
          const active = route.name === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setRoute({ name: item.id, patientId: route.patientId })}
              className={`min-h-[48px] rounded-lg text-[11px] font-bold flex flex-col items-center justify-center px-1 ${
                active ? 'bg-blue-700 text-white' : 'text-slate-300'
              }`}
            >
              <span className="truncate max-w-full">{item.label.split(' ')[0]}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}