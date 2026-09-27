import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    id: {
      type: String,
      required: [true, 'Employee ID is required'],
      trim: true,
      uppercase: true,
    },
    name: {
      type: String,
      required: [true, 'Employee name is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

// Prevent duplicate employee ID for the same user profile
employeeSchema.index({ userId: 1, id: 1 }, { unique: true });

export const Employee = mongoose.model('Employee', employeeSchema);
