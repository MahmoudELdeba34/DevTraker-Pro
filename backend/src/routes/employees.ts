import { Router, Response } from 'express';
import User from '../models/User';
import EmployeeProfile from '../models/EmployeeProfile';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// GET /api/employees - List all employees with profiles (HR/Admin/Manager only)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.userRole;
    if (role !== 'admin' && role !== 'hr' && role !== 'manager') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const users = await User.find({}, '_id name email role');
    const profiles = await EmployeeProfile.find().populate('managerId', 'name email');

    const combined = users.map(user => {
      const profile = profiles.find(p => p.userId.toString() === user._id.toString());
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profile: profile || null
      };
    });

    res.json({ success: true, data: combined });
  } catch (err) {
    console.error('List employees error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// GET /api/employees/:userId - Get specific employee profile
router.get('/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const targetUserId = req.params['userId'];
    const role = req.userRole;
    
    // Check if self or privileged
    if (targetUserId !== req.userId && role !== 'admin' && role !== 'hr' && role !== 'manager') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const user = await User.findById(targetUserId, '_id name email role');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    let profile = await EmployeeProfile.findOne({ userId: targetUserId })
      .populate('managerId', 'name email')
      .populate('attendancePolicyId')
      .populate('overtimePolicyId');

    // Create an empty profile structure if it doesn't exist yet (for lazy initialization)
    if (!profile && (role === 'admin' || role === 'hr')) {
      profile = await EmployeeProfile.create({ userId: targetUserId });
    }

    res.json({
      success: true,
      data: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        profile: profile || null
      }
    });
  } catch (err) {
    console.error('Get employee profile error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

// PUT /api/employees/:userId - Update or create employee profile (HR/Admin only)
router.put('/:userId', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const role = req.userRole;
    if (role !== 'admin' && role !== 'hr') {
      res.status(403).json({ success: false, error: 'Access denied' });
      return;
    }

    const targetUserId = req.params['userId'];
    const updateData = req.body;

    let profile = await EmployeeProfile.findOne({ userId: targetUserId });

    if (!profile) {
      profile = new EmployeeProfile({ userId: targetUserId });
    }

    // Bind fields
    if (updateData.phone !== undefined) profile.phone = updateData.phone;
    if (updateData.roleTitle !== undefined) profile.roleTitle = updateData.roleTitle;
    if (updateData.department !== undefined) profile.department = updateData.department;
    if (updateData.managerId !== undefined) profile.managerId = updateData.managerId || null;
    if (updateData.hireDate !== undefined) profile.hireDate = updateData.hireDate ? new Date(updateData.hireDate) : undefined;
    if (updateData.contractType !== undefined) profile.contractType = updateData.contractType;
    if (updateData.status !== undefined) profile.status = updateData.status;
    if (updateData.basicSalary !== undefined) profile.basicSalary = Number(updateData.basicSalary);
    if (updateData.salaryType !== undefined) profile.salaryType = updateData.salaryType;
    if (updateData.workingDays !== undefined) profile.workingDays = Number(updateData.workingDays);
    if (updateData.workingHours !== undefined) profile.workingHours = Number(updateData.workingHours);
    if (updateData.annualLeaveEntitlement !== undefined) {
      profile.annualLeaveEntitlement = Number(updateData.annualLeaveEntitlement);
    }
    if (updateData.annualLeaveBalance !== undefined) profile.annualLeaveBalance = Number(updateData.annualLeaveBalance);
    if (updateData.attendancePolicyId !== undefined) profile.attendancePolicyId = updateData.attendancePolicyId || null;
    if (updateData.overtimePolicyId !== undefined) profile.overtimePolicyId = updateData.overtimePolicyId || null;

    await profile.save();

    // Optionally update the role field in the User document itself
    if (updateData.role !== undefined && role === 'admin') {
      const user = await User.findById(targetUserId);
      if (user) {
        user.role = updateData.role;
        await user.save();
      }
    }

    res.json({ success: true, data: profile });
  } catch (err) {
    console.error('Update employee profile error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

export default router;
