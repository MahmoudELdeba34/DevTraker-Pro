import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISalaryAdjustment extends Document {
  userId: Types.ObjectId;
  type: 'deduction' | 'bonus';
  subType: 'late' | 'absent' | 'bonus' | 'allowance' | 'commission' | 'penalty' | 'manual';
  amount: number;
  date: Date;
  payrollMonth: string; // YYYY-MM
  reason: string;
  createdBy: Types.ObjectId;
  status: 'draft' | 'approved' | 'applied' | 'cancelled';
}

const SalaryAdjustmentSchema = new Schema<ISalaryAdjustment>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['deduction', 'bonus'], required: true },
    subType: {
      type: String,
      enum: ['late', 'absent', 'bonus', 'allowance', 'commission', 'penalty', 'manual'],
      required: true
    },
    amount: { type: Number, required: true },
    date: { type: Date, required: true },
    payrollMonth: { type: String, required: true }, // format: "YYYY-MM"
    reason: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: ['draft', 'approved', 'applied', 'cancelled'],
      default: 'approved'
    }
  },
  { timestamps: true }
);

export default mongoose.model<ISalaryAdjustment>('SalaryAdjustment', SalaryAdjustmentSchema);
