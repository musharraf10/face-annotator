import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Null for legacy records until an administrator confirms their branch.
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Branch',
      default: null,
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
    referencePhoto: {
      // `key` is retained only to identify records from the previous S3 rollout.
      key: { type: String, default: null },
      publicId: { type: String, default: null },
      assetId: { type: String, default: null },
      deliveryType: { type: String, enum: ['authenticated'], default: null },
      contentType: { type: String, enum: ['image/webp'], default: null },
      size: { type: Number, default: null },
      width: { type: Number, default: null },
      height: { type: Number, default: null },
      updatedAt: { type: Date, default: null },
    },
    // Object keys awaiting cleanup after a successful database change.
    referencePhotoCleanupKeys: { type: [String], default: [] },
    // Cloudinary public IDs awaiting cleanup; legacy S3 keys above are not processed here.
    referencePhotoCleanupPublicIds: { type: [String], default: [] },
    // Journal uploaded IDs before sending bytes to Cloudinary, so failed Mongo saves are recoverable.
    referencePhotoPendingUploads: [{ publicId: { type: String, required: true }, createdAt: { type: Date, default: Date.now } }],
  },
  {
    timestamps: true,
  }
);

// Legacy unassigned records may contain duplicate IDs. Only assigned records
// participate in branch-level uniqueness.
employeeSchema.index(
  { branchId: 1, id: 1 },
  { unique: true, partialFilterExpression: { branchId: { $type: 'objectId' } } },
);

export const Employee = mongoose.model('Employee', employeeSchema);
