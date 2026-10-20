import mongoose from 'mongoose';

const branchSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true },
  // A branch becomes active atomically when its Operations Employee is assigned.
  active: { type: Boolean, default: false, required: true },
  operationsUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
}, { timestamps: true });

branchSchema.index({ code: 1 }, { unique: true });
branchSchema.index(
  { operationsUserId: 1 },
  { unique: true, partialFilterExpression: { operationsUserId: { $type: 'objectId' } } },
);

export const Branch = mongoose.model('Branch', branchSchema);
