export function hashPassword(secret) {
  let h = 5381;
  const s = String(secret == null ? '' : secret);
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return 'h' + (h >>> 0).toString(16);
}

export function normalizeRole(role) {
  const r = String(role || '').trim().toLowerCase();
  if (r === 'physician' || r === 'doctor') return 'Physician';
  if (r === 'nurse') return 'Nurse';
  return role;
}

export class StaffUser {
  constructor({ StaffID, FullName, Role, PasswordHash = '', Email = '', LastLoginTime = null, IsActive = true }) {
    this.StaffID = StaffID;
    this.FullName = FullName;
    this.Role = normalizeRole(Role);
    this.PasswordHash = PasswordHash;
    this.Email = Email;
    this.LastLoginTime = LastLoginTime || new Date().toISOString();
    this.IsActive = Boolean(IsActive);
  }

  authenticate(plainPassword) {
    if (!this.IsActive) return false;
    return this.PasswordHash === hashPassword(plainPassword);
  }

  getPermissions() {
    const isDoctor = this.Role === 'Physician';
    return {
      canRegisterPatient: this.IsActive,
      canRecordVitals: this.IsActive,
      canAuthorisePrescription: this.IsActive && isDoctor,
      canAdministerMedication: this.IsActive,
      canCancelPrescription: this.IsActive,
      canDischargePatient: this.IsActive,
      canViewAuditLog: this.IsActive,
      canExportAuditLog: this.IsActive
    };
  }

  logActivity(actionType, details = '') {
    return {
      ActorStaffID: this.StaffID,
      StaffID: this.StaffID,
      ActionType: actionType,
      Action: actionType,
      TransactionDetails: details,
      Detail: details,
      LoggedTimestamp: new Date().toISOString()
    };
  }

  toJSON() {
    return {
      StaffID: this.StaffID,
      FullName: this.FullName,
      Role: this.Role,
      PasswordHash: this.PasswordHash,
      Email: this.Email,
      LastLoginTime: this.LastLoginTime,
      IsActive: this.IsActive
    };
  }
}

export default StaffUser;