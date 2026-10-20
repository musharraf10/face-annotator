import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
      index: true,
    },
    date: {
      type: String, // Format YYYY-MM-DD
      required: true,
    },
    placedEmployees: {
      type: [String],
      default: [],
    },
    annotations: {
      type: Array,
      default: [],
    },
    imageMeta: {
      name: { type: String, default: 'group-photo.jpg' },
      hasImage: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  }
);

sessionSchema.index({ branchId: 1, date: 1 }, { unique: true, partialFilterExpression: { branchId: { $type: 'objectId' } } });

export const Session = mongoose.model('Session', sessionSchema);
