import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPayrollRun extends Document {
  month: string; // YYYY-MM
  status: 'draft' | 'calculated' | 'under_review' | 'approved' | 'paid' | 'locked';
  calculatedAt?: Date;
  approvedAt?: Date;
  approvedBy?: Types.ObjectId;
  summary: {
    totalBasicSalary: number;
    totalBonuses: number;
    totalDeductions: number;
    totalNetSalary: number;
    employeesCount: number;
  };
}

const PayrollRunSchema = new Schema<IPayrollRun>(
  {
    month: { type: String, required: true, unique: true }, // Format: YYYY-MM
    status: {
      type: String,
      enum: ['draft', 'calculated', 'under_review', 'approved', 'paid', 'locked'],
      default: 'calculated'
    },
    calculatedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    summary: {
      totalBasicSalary: { type: Number, default: 0 },
      totalBonuses: { type: Number, default: 0 },
      totalDeductions: { type: Number, default: 0 },
      totalNetSalary: { type: Number, default: 0 },
      employeesCount: { type: Number, default: 0 }
    }
  },
  { timestamps: true }
);

export default mongoose.model<IPayrollRun>('PayrollRun', PayrollRunSchema);
