export class MedicationOrder {
  constructor({
    PrescriptionID = '',
    PatientID = '',
    PrescribingDoctorID = '',
    StaffID = '',
    DrugID = '',
    DrugName = '',
    AuthorizedDosage = 'Standard',
    Route = 'PO',
    Frequency = 'BD',
    Status = 'Pending',
    AuthorizationTimestamp = '',
    DateAuthorized = '',
    AdministeredByNurseID = null,
    AdministeredTimestamp = null,
    CancelledByStaffID = null,
    CancelReason = null,
    CancelledTimestamp = null
  }) {
    const stamp = AuthorizationTimestamp || DateAuthorized || new Date().toISOString().slice(0, 16).replace('T', ' ');
    this.PrescriptionID = PrescriptionID;
    this.PatientID = PatientID;
    this.PrescribingDoctorID = PrescribingDoctorID || StaffID;
    this.StaffID = this.PrescribingDoctorID;
    this.DrugID = DrugID;
    this.DrugName = DrugName;
    this.AuthorizedDosage = AuthorizedDosage;
    this.Route = Route;
    this.Frequency = Frequency;
    this.Status = Status === 'Active' ? 'Pending' : Status;
    this.AuthorizationTimestamp = stamp;
    this.DateAuthorized = stamp;
    this.AdministeredByNurseID = AdministeredByNurseID;
    this.AdministeredTimestamp = AdministeredTimestamp;
    this.CancelledByStaffID = CancelledByStaffID;
    this.CancelReason = CancelReason;
    this.CancelledTimestamp = CancelledTimestamp;
  }

  markAdministered(nurseID) {
    if (!nurseID || !String(nurseID).trim()) {
      throw new Error('Nurse ID is required to mark medication as administered.');
    }
    if (this.Status === 'Cancelled') {
      throw new Error('Cannot administer a cancelled medication order.');
    }
    this.Status = 'Administered';
    this.AdministeredByNurseID = String(nurseID).trim();
    this.AdministeredTimestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    return this;
  }

  getSchedule() {
    return `${this.AuthorizedDosage} via ${this.Route} (${this.Frequency})`;
  }

  cancelOrder(reason, actorStaffID = '') {
    const cleanReason = String(reason == null ? '' : reason).trim();
    if (!cleanReason) {
      throw new Error('A mandatory clinical reason is required to cancel a medication order.');
    }
    if (this.Status === 'Administered') {
      throw new Error('Cannot cancel an order that has already been administered.');
    }
    this.Status = 'Cancelled';
    this.CancelReason = cleanReason;
    this.CancelledByStaffID = actorStaffID;
    this.CancelledTimestamp = new Date().toISOString().slice(0, 16).replace('T', ' ');
    return this;
  }

  toJSON() {
    return {
      PrescriptionID: this.PrescriptionID,
      PatientID: this.PatientID,
      PrescribingDoctorID: this.PrescribingDoctorID,
      StaffID: this.StaffID,
      DrugID: this.DrugID,
      DrugName: this.DrugName,
      AuthorizedDosage: this.AuthorizedDosage,
      Route: this.Route,
      Frequency: this.Frequency,
      Status: this.Status,
      AuthorizationTimestamp: this.AuthorizationTimestamp,
      DateAuthorized: this.DateAuthorized,
      AdministeredByNurseID: this.AdministeredByNurseID,
      AdministeredTimestamp: this.AdministeredTimestamp,
      CancelledByStaffID: this.CancelledByStaffID,
      CancelReason: this.CancelReason,
      CancelledTimestamp: this.CancelledTimestamp
    };
  }
}

export default MedicationOrder;