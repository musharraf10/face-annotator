import express from 'express';
import mongoose from 'mongoose';
import { Branch } from '../models/Branch.js';
import { Employee } from '../models/Employee.js';
import { EmployeeAssignmentAudit } from '../models/EmployeeAssignmentAudit.js';
import { Session } from '../models/Session.js';
import { SessionAssignmentAudit } from '../models/SessionAssignmentAudit.js';
import { User } from '../models/User.js';
import { protect, requireAdministrator } from '../middleware/auth.js';

const router = express.Router();
router.use(protect, requireAdministrator);

router.get('/branches', async (req, res, next) => {
  try {
    const branches = await Branch.find().select('name code active operationsUserId createdAt').populate('operationsUserId', 'name email');
    res.json({ success: true, branches });
  } catch (error) { next(error); }
});

router.get('/unassigned-accounts', async (req, res, next) => {
  try {
    const accounts = await User.find({ role: 'unassigned', branchId: null }).select('name email createdAt').sort({ createdAt: 1 });
    res.json({ success: true, accounts: accounts.map(({ id, name, email, createdAt }) => ({ id, name, email, createdAt })) });
  } catch (error) { next(error); }
});

router.post('/branches', async (req, res, next) => {
  try {
    const { name, code } = req.body;
    if (typeof name !== 'string' || !name.trim() || typeof code !== 'string' || !code.trim()) {
      return res.status(400).json({ success: false, error: 'Branch name and code are required.' });
    }
    if (await Branch.countDocuments() >= 10) return res.status(409).json({ success: false, error: 'The initial portal limit of 10 branches has been reached.' });
    const branch = await Branch.create({ name: name.trim(), code: code.trim().toUpperCase() });
    res.status(201).json({ success: true, branch: { id: branch.id, name: branch.name, code: branch.code, active: branch.active } });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, error: 'Branch code is already in use.' });
    next(error);
  }
});

router.patch('/branches/:branchId/status', async (req, res, next) => {
  try {
    const { branchId } = req.params;
    const { active } = req.body;
    if (!mongoose.isValidObjectId(branchId) || typeof active !== 'boolean') {
      return res.status(400).json({ success: false, error: 'A valid branchId and boolean active value are required.' });
    }
    const branch = await Branch.findById(branchId);
    if (!branch) return res.status(404).json({ success: false, error: 'Branch not found.' });
    if (active) {
      const operator = branch.operationsUserId ? await User.findOne({ _id: branch.operationsUserId, branchId: branch._id, role: 'operations' }) : null;
      if (!operator) return res.status(409).json({ success: false, error: 'Assign a valid Operations Employee account before activating this branch.' });
    }
    branch.active = active;
    await branch.save();
    res.json({ success: true, branch: { id: branch.id, name: branch.name, code: branch.code, active: branch.active } });
  } catch (error) { next(error); }
});

async function assignOperationsUser(req, res, next, replace) {
  let session;
  try {
    session = await mongoose.startSession();
    const { branchId } = req.params;
    const { userId } = req.body;
    if (!mongoose.isValidObjectId(branchId) || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ success: false, error: 'Valid branchId and userId are required.' });
    }
    const branch = await Branch.findById(branchId);
    const target = await User.findById(userId);
    if (!branch) return res.status(404).json({ success: false, error: 'Branch not found.' });
    if (!target || target.role !== 'unassigned' || target.branchId) return res.status(409).json({ success: false, error: 'Account is unavailable for Operations Employee assignment.' });
    const previousUserId = branch.operationsUserId?.toString() || null;
    if (replace ? !previousUserId : Boolean(previousUserId)) {
      return res.status(409).json({ success: false, error: replace ? 'Branch has no Operations Employee account to replace.' : 'Branch already has an Operations Employee account.' });
    }

    await session.withTransaction(async () => {
      const reserved = await Branch.findOneAndUpdate(
        { _id: branch._id, active: branch.active, operationsUserId: previousUserId || null },
        { $set: { operationsUserId: target._id, active: true } },
        { new: true, session },
      );
      if (!reserved) throw new Error('Branch assignment changed; transaction cancelled.');
      if (previousUserId) {
        await User.updateOne({ _id: previousUserId, role: 'operations', branchId: branch._id }, { $set: { role: 'unassigned', branchId: null } }, { session });
      }
      const updatedTarget = await User.findOneAndUpdate(
        { _id: target._id, role: 'unassigned', branchId: null },
        { $set: { role: 'operations', branchId: branch._id } },
        { new: true, session },
      );
      if (!updatedTarget) throw new Error('Account assignment changed; transaction cancelled.');
    });
    res.json({ success: true, assignment: { branchId: branch.id, userId: target.id } });
  } catch (error) {
    if (error.code === 11000 || /assignment changed/i.test(error.message)) {
      return res.status(409).json({ success: false, error: 'Branch or account assignment changed; refresh and retry.' });
    }
    next(error);
  } finally {
    if (session) await session.endSession();
  }
}

router.post('/branches/:branchId/operations-account', (req, res, next) => assignOperationsUser(req, res, next, false));
router.put('/branches/:branchId/operations-account', (req, res, next) => assignOperationsUser(req, res, next, true));

router.get('/legacy-employees', async (req, res, next) => {
  try {
    const employees = await Employee.find({ branchId: null }).select('id name userId createdAt updatedAt').sort({ createdAt: 1 });
    res.json({ success: true, employees });
  } catch (error) { next(error); }
});

router.post('/legacy-employees/assign', async (req, res, next) => {
  let session;
  try {
    session = await mongoose.startSession();
    const { branchId, employeeIds } = req.body;
    if (!mongoose.isValidObjectId(branchId) || !Array.isArray(employeeIds) || !employeeIds.length || employeeIds.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ success: false, error: 'A valid branchId and non-empty employeeIds array are required.' });
    }
    const ids = [...new Set(employeeIds.map(String))];
    if (ids.length !== employeeIds.length) return res.status(400).json({ success: false, error: 'Duplicate employee record IDs were supplied.' });
    const branch = await Branch.findOne({ _id: branchId, active: true });
    if (!branch) return res.status(404).json({ success: false, error: 'Active branch not found.' });
    const records = await Employee.find({ _id: { $in: ids }, branchId: null }).session(session);
    if (records.length !== ids.length) return res.status(409).json({ success: false, error: 'One or more records are missing or have already been assigned.' });

    const selectedIds = new Set(records.map((record) => record.id));
    const existing = await Employee.find({ branchId, id: { $in: [...selectedIds] } }).select('id').session(session);
    if (existing.length) return res.status(409).json({ success: false, error: 'Assignment would create duplicate employee IDs in the destination branch.', duplicateIds: existing.map((record) => record.id) });

    await session.withTransaction(async () => {
      for (const record of records) {
        const update = await Employee.updateOne({ _id: record._id, branchId: null }, { $set: { branchId: branch._id } }, { session });
        if (update.modifiedCount !== 1) throw new Error('Legacy assignment precondition changed; transaction cancelled.');
      }
      await EmployeeAssignmentAudit.insertMany(records.map((record) => ({ employeeId: record._id, administratorId: req.account._id, branchId: branch._id })), { session });
    });
    res.json({ success: true, assignedCount: records.length, employeeIds: records.map((record) => record.id), branchId: branch.id });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, error: 'Assignment would create duplicate employee IDs in the destination branch.' });
    next(error);
  } finally {
    if (session) await session.endSession();
  }
});

router.get('/legacy-sessions', async (req, res, next) => {
  try {
    const sessions = await Session.find({ branchId: null }).select('userId date placedEmployees annotations imageMeta updatedAt').sort({ date: -1 });
    res.json({ success: true, sessions });
  } catch (error) { next(error); }
});

router.post('/legacy-sessions/assign', async (req, res, next) => {
  let session;
  try {
    session = await mongoose.startSession();
    const { branchId, sessionIds } = req.body;
    if (!mongoose.isValidObjectId(branchId) || !Array.isArray(sessionIds) || !sessionIds.length || sessionIds.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ success: false, error: 'A valid branchId and non-empty sessionIds array are required.' });
    }
    const ids = [...new Set(sessionIds.map(String))];
    if (ids.length !== sessionIds.length) return res.status(400).json({ success: false, error: 'Duplicate session record IDs were supplied.' });
    const branch = await Branch.findOne({ _id: branchId, active: true });
    if (!branch) return res.status(404).json({ success: false, error: 'Active branch not found.' });
    const records = await Session.find({ _id: { $in: ids }, branchId: null }).session(session);
    if (records.length !== ids.length) return res.status(409).json({ success: false, error: 'One or more sessions are missing or have already been assigned.' });
    const dates = records.map((record) => record.date);
    const conflicts = await Session.find({ branchId, date: { $in: dates } }).select('date').session(session);
    if (conflicts.length) return res.status(409).json({ success: false, error: 'Assignment would conflict with an existing branch session date.', dates: conflicts.map((record) => record.date) });

    await session.withTransaction(async () => {
      for (const record of records) {
        const update = await Session.updateOne({ _id: record._id, branchId: null }, { $set: { branchId: branch._id } }, { session });
        if (update.modifiedCount !== 1) throw new Error('Legacy session assignment precondition changed; transaction cancelled.');
      }
      await SessionAssignmentAudit.insertMany(records.map((record) => ({ sessionId: record._id, administratorId: req.account._id, branchId: branch._id })), { session });
    });
    res.json({ success: true, assignedCount: records.length, dates, branchId: branch.id });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ success: false, error: 'Assignment would conflict with an existing branch session date.' });
    next(error);
  } finally {
    if (session) await session.endSession();
  }
});

export default router;
