import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IWhiteboardElement {
  id: string;
  type: 'sticky' | 'task' | 'text' | 'path';
  x: number;
  y: number;
  width?: number;
  height?: number;
  text?: string;
  color?: string;
  taskId?: Types.ObjectId | null;
  points?: { x: number; y: number }[];
}

export interface IWhiteboardConnection {
  fromId: string;
  toId: string;
  color?: string;
}

export interface IWhiteboard extends Document {
  workspaceId: Types.ObjectId;
  title: string;
  elements: IWhiteboardElement[];
  connections: IWhiteboardConnection[];
  createdAt: Date;
  updatedAt: Date;
}

const ElementSchema = new Schema<IWhiteboardElement>(
  {
    id: { type: String, required: true },
    type: { type: String, enum: ['sticky', 'task', 'text', 'path'], required: true },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number },
    height: { type: Number },
    text: { type: String },
    color: { type: String },
    taskId: { type: Schema.Types.ObjectId, ref: 'Task', default: null },
    points: { type: [{ x: Number, y: Number }], default: undefined },
  },
  { _id: false }
);

const ConnectionSchema = new Schema<IWhiteboardConnection>(
  {
    fromId: { type: String, required: true },
    toId: { type: String, required: true },
    color: { type: String },
  },
  { _id: false }
);

const WhiteboardSchema = new Schema<IWhiteboard>(
  {
    workspaceId: { type: Schema.Types.ObjectId, ref: 'Workspace', required: true },
    title: { type: String, required: true, trim: true },
    elements: { type: [ElementSchema], default: [] },
    connections: { type: [ConnectionSchema], default: [] },
  },
  { timestamps: true }
);

export default mongoose.model<IWhiteboard>('Whiteboard', WhiteboardSchema);
