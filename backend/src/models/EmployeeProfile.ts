import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IEmployeeProfile extends Document {
  userId: Types.ObjectId;
  phone?: string;
  roleTitle?: string;
  department?: string;
  managerId?: Types.ObjectId;
  hireDate?: Date;
  contractType?: 'full-time' | 'part-time' | 'remote' | 'hybrid';
  status?: 'active' | 'suspended' | 'resigned';
  basicSalary?: number;
  salaryType?: 'monthly' | 'daily' | 'hourly';
  workingDays?: number;
  workingHours?: number;
  annualLeaveBalance?: number;
  attendancePolicyId?: Types.ObjectId;
  overtimePolicyId?: Types.ObjectId;
}

const EmployeeProfileSchema = new Schema<IEmployeeProfile>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    phone: { type: String, trim: true },
    roleTitle: { type: String, trim: true },
    department: { type: String, trim: true },
    managerId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    hireDate: { type: Date, default: null },
    contractType: {
      type: String,
      enum: ['full-time', 'part-time', 'remote', 'hybrid'],
      default: 'full-time'
    },
    status: {
      type: String,
      enum: ['active', 'suspended', 'resigned'],
      default: 'active'
    },
    basicSalary: { type: Number, default: 0 },
    salaryType: {
      type: String,
      enum: ['monthly', 'daily', 'hourly'],
      default: 'monthly'
    },
    workingDays: { type: Number, default: 26 },
    workingHours: { type: Number, default: 8 },
    annualLeaveBalance: { type: Number, default: 21 },
    attendancePolicyId: { type: Schema.Types.ObjectId, ref: 'Policy', default: null },
    overtimePolicyId: { type: Schema.Types.ObjectId, ref: 'Policy', default: null }
  },
  { timestamps: true }
);

export default mongoose.model<IEmployeeProfile>('EmployeeProfile', EmployeeProfileSchema);
