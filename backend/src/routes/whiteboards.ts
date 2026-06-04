import express from 'express';
import Whiteboard from '../models/Whiteboard';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import Workspace from '../models/Workspace';

const router = express.Router();

router.use(authMiddleware);

// Get whiteboards for a workspace
router.get('/workspace/:workspaceId', async (req: AuthRequest, res) => {
  try {
    const { workspaceId } = req.params;
    const userId = req.userId;

    // Check if user has access to workspace
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    if (workspace.ownerId.toString() !== userId?.toString() && !workspace.members.some(m => m.toString() === userId?.toString())) {
      return res.status(403).json({ message: 'Not authorized to access this workspace' });
    }

    const whiteboards = await Whiteboard.find({ workspaceId }).sort({ updatedAt: -1 });
    res.json(whiteboards);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching whiteboards', error: error.message });
  }
});

// Get a single whiteboard by ID
router.get('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const whiteboard = await Whiteboard.findById(id);
    if (!whiteboard) {
      return res.status(404).json({ message: 'Whiteboard not found' });
    }

    // Check workspace access
    const workspace = await Workspace.findById(whiteboard.workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    if (workspace.ownerId.toString() !== userId?.toString() && !workspace.members.some(m => m.toString() === userId?.toString())) {
      return res.status(403).json({ message: 'Not authorized to access this whiteboard' });
    }

    res.json(whiteboard);
  } catch (error: any) {
    res.status(500).json({ message: 'Error fetching whiteboard', error: error.message });
  }
});

// Create a new whiteboard
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { workspaceId, title } = req.body;
    const userId = req.userId;

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    if (workspace.ownerId.toString() !== userId?.toString() && !workspace.members.some(m => m.toString() === userId?.toString())) {
      return res.status(403).json({ message: 'Not authorized to create a whiteboard in this workspace' });
    }

    const whiteboard = new Whiteboard({
      workspaceId,
      title,
      elements: [],
      connections: [],
    });
    
    const savedWhiteboard = await whiteboard.save();
    res.status(201).json(savedWhiteboard);
  } catch (error: any) {
    res.status(500).json({ message: 'Error creating whiteboard', error: error.message });
  }
});

// Update whiteboard (save canvas)
router.put('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { title, elements, connections } = req.body;
    const userId = req.userId;

    const whiteboard = await Whiteboard.findById(id);
    if (!whiteboard) {
      return res.status(404).json({ message: 'Whiteboard not found' });
    }

    const workspace = await Workspace.findById(whiteboard.workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    if (workspace.ownerId.toString() !== userId?.toString() && !workspace.members.some(m => m.toString() === userId?.toString())) {
      return res.status(403).json({ message: 'Not authorized to update this whiteboard' });
    }

    if (title) whiteboard.title = title;
    if (elements) whiteboard.elements = elements;
    if (connections) whiteboard.connections = connections;

    const updatedWhiteboard = await whiteboard.save();
    res.json(updatedWhiteboard);
  } catch (error: any) {
    res.status(500).json({ message: 'Error updating whiteboard', error: error.message });
  }
});

// Delete a whiteboard
router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const userId = req.userId;

    const whiteboard = await Whiteboard.findById(id);
    if (!whiteboard) {
      return res.status(404).json({ message: 'Whiteboard not found' });
    }

    const workspace = await Workspace.findById(whiteboard.workspaceId);
    if (!workspace) {
      return res.status(404).json({ message: 'Workspace not found' });
    }
    // Only workspace owner can delete whiteboards (or maybe any member? Let's say only owner for now, or just limit to workspace members. Let's limit to members).
    if (workspace.ownerId.toString() !== userId?.toString() && !workspace.members.some(m => m.toString() === userId?.toString())) {
      return res.status(403).json({ message: 'Not authorized to delete this whiteboard' });
    }

    await whiteboard.deleteOne();
    res.json({ message: 'Whiteboard deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ message: 'Error deleting whiteboard', error: error.message });
  }
});

export default router;
