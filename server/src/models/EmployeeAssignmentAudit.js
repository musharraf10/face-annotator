import mongoose from "mongoose";

const employeeAssignmentAuditSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    administratorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    branchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Branch",
      required: true,
    },
  },
  { timestamps: true },
);

export const EmployeeAssignmentAudit = mongoose.model(
  "EmployeeAssignmentAudit",
  employeeAssignmentAuditSchema,
);
