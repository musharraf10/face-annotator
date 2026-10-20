import mongoose from 'mongoose';

const sessionAssignmentAuditSchema = new mongoose.Schema({
  sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Session', required: true, index: true },
  administratorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch', required: true },
}, { timestamps: true });

export const SessionAssignmentAudit = mongoose.model('SessionAssignmentAudit', sessionAssignmentAuditSchema);
