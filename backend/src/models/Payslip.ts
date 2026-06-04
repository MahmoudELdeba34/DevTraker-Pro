import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPayslip extends Document {
  payrollRunId: Types.ObjectId;
  userId: Types.ObjectId;
  basicSalary: number;
  workedDays: number;
  absentDays: number;
  paidLeaves: number;
  unpaidLeaves: number;
  lateMinutes: number;
  overtimeHours: number;
  overtimeAmount: number;
  bonuses: number;
  deductions: number;
  netSalary: number;
  status: 'draft' | 'approved' | 'paid';
}

const PayslipSchema = new Schema<IPayslip>(
  {
    payrollRunId: { type: Schema.Types.ObjectId, ref: 'PayrollRun', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    basicSalary: { type: Number, required: true },
    workedDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    paidLeaves: { type: Number, default: 0 },
    unpaidLeaves: { type: Number, default: 0 },
    lateMinutes: { type: Number, default: 0 },
    overtimeHours: { type: Number, default: 0 },
    overtimeAmount: { type: Number, default: 0 },
    bonuses: { type: Number, default: 0 },
    deductions: { type: Number, default: 0 },
    netSalary: { type: Number, required: true },
    status: {
      type: String,
      enum: ['draft', 'approved', 'paid'],
      default: 'draft'
    }
  },
  { timestamps: true }
);

// Ensure only one payslip per user per payroll run
PayslipSchema.index({ payrollRunId: 1, userId: 1 }, { unique: true });

export default mongoose.model<IPayslip>('Payslip', PayslipSchema);
