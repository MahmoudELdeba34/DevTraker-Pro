import express from 'express';
import Workspace from '../models/Workspace';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = express.Router();

router.use(authMiddleware);

// Get all workspaces for the current user (owner or member)
router.get('/', async (req: AuthRequest, res) => {
  try {
    const userId = req.userId;
    const workspaces = await Workspace.find()
      .populate('ownerId', 'name email')
      .populate('members', 'name email');
    res.json(workspaces);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching workspaces', error: error.message });
  }
});

// Create a new workspace
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { name, description, members } = req.body;
    const workspace = new Workspace({
      name,
      description,
      ownerId: req.userId,
      members: members || [],
    });
    const savedWorkspace = await workspace.save();
    res.status(201).json(savedWorkspace);
  } catch (error: any) {
    res.status(500).json({ message: 'Error creating workspace', error: error.message });
  }
});

// Update a workspace
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { name, description, members } = req.body;
    
    const workspace = await Workspace.findById(id);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    
    // Only owner can update the workspace
    if (workspace.ownerId.toString() !== req.userId?.toString()) {
      return res.status(403).json({ message: 'Not authorized to update this workspace' });
    }
    
    if (name) workspace.name = name;
    if (description !== undefined) workspace.description = description;
    if (members) workspace.members = members;
    
    const updatedWorkspace = await workspace.save();
    res.json(updatedWorkspace);
  } catch (error: any) {
    res.status(500).json({ message: 'Error updating workspace', error: error.message });
  }
});

// Delete a workspace
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const workspace = await Workspace.findById(id);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    
    // Only owner can delete
    if (workspace.ownerId.toString() !== req.userId?.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this workspace' });
    }
    
    await workspace.deleteOne();
    res.json({ message: 'Workspace deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error deleting workspace', error: error.message });
  }
});

// ─── Member Management ──────────────────────────────────────────

// Get workspace members (populated)
router.get('/:id/members', async (req: AuthRequest, res) => {
  try {
    const workspace = await Workspace.findById(req.params.id)
      .populate('members', 'name email role')
      .populate('ownerId', 'name email role');
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    // Include owner as first member with an "owner" flag
    const ownerObj = workspace.ownerId as any;
    const membersList = (workspace.members as any[]).map(m => ({
      _id: m._id,
      name: m.name,
      email: m.email,
      role: m.role,
      isOwner: m._id.toString() === ownerObj._id.toString(),
    }));
    // If owner is not already in members array, prepend them
    const ownerInList = membersList.some(m => m._id.toString() === ownerObj._id.toString());
    if (!ownerInList) {
      membersList.unshift({
        _id: ownerObj._id,
        name: ownerObj.name,
        email: ownerObj.email,
        role: ownerObj.role,
        isOwner: true,
      });
    } else {
      // Mark the owner in the list
      const ownerEntry = membersList.find(m => m._id.toString() === ownerObj._id.toString());
      if (ownerEntry) ownerEntry.isOwner = true;
    }
    res.json(membersList);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching members', error: error.message });
  }
});

// Add a member to workspace
router.post('/:id/members', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ message: 'userId is required' });
    }
    const workspace = await Workspace.findById(req.params.id);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    // Check if already a member
    const alreadyMember = workspace.members.some(
      (m: any) => m.toString() === userId
    );
    if (alreadyMember) {
      return res.status(409).json({ message: 'User is already a member' });
    }
    workspace.members.push(userId);
    await workspace.save();
    // Return populated workspace
    const populated = await Workspace.findById(workspace._id)
      .populate('members', 'name email role')
      .populate('ownerId', 'name email role');
    res.status(201).json(populated);
  } catch (error: any) {
    res.status(500).json({ message: 'Error adding member', error: error.message });
  }
});

// Remove a member from workspace
router.delete('/:id/members/:userId', async (req: AuthRequest, res) => {
  try {
    const { id, userId } = req.params;
    const workspace = await Workspace.findById(id);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    // Can't remove the owner
    if (workspace.ownerId.toString() === userId) {
      return res.status(403).json({ message: 'Cannot remove the workspace owner' });
    }
    workspace.members = workspace.members.filter(
      (m: any) => m.toString() !== userId
    ) as any;
    await workspace.save();
    res.json({ message: 'Member removed successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error removing member', error: error.message });
  }
});

export default router;
