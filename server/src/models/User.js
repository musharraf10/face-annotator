import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please provide a name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please provide an email or profile ID'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please provide a password'],
      minlength: [4, 'Password must be at least 4 characters long'],
    },
    role: {
      type: String,
      enum: ['unassigned', 'operations', 'admin'],
      default: 'unassigned',
      required: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// An Operations Employee account can belong to only one branch.
userSchema.index(
  { branchId: 1 },
  { unique: true, partialFilterExpression: { branchId: { $type: 'objectId' } }, name: 'branchId_1_unique_assigned' },
);

export const User = mongoose.model('User', userSchema);
