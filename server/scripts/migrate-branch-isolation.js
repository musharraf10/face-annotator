import 'dotenv/config';
import mongoose from 'mongoose';

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
try {
  const db = mongoose.connection.db;
  const users = db.collection('users');
  const employees = db.collection('employees');
  const branches = db.collection('branches');
  const audits = db.collection('employeeassignmentaudits');
  const sessionAudits = db.collection('sessionassignmentaudits');
  const sessions = db.collection('sessions');

  const collisions = await employees.aggregate([
    { $match: { branchId: { $type: 'objectId' } } },
    { $group: { _id: { branchId: '$branchId', id: '$id' }, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 10 },
  ]).toArray();
  if (collisions.length) throw new Error('Preflight stopped: duplicate employee IDs exist within an assigned branch. Resolve them before migrating indexes.');

  const duplicateBranchAccounts = await users.aggregate([
    { $match: { branchId: { $type: 'objectId' } } },
    { $group: { _id: '$branchId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 10 },
  ]).toArray();
  if (duplicateBranchAccounts.length) throw new Error('Preflight stopped: more than one account references the same branch. Review account assignments before migrating.');

  const duplicateBranchOperators = await branches.aggregate([
    { $match: { operationsUserId: { $type: 'objectId' } } },
    { $group: { _id: '$operationsUserId', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 10 },
  ]).toArray();
  if (duplicateBranchOperators.length) throw new Error('Preflight stopped: one account is assigned to multiple branches. Review branch assignments before migrating.');

  const duplicateBranchCodes = await branches.aggregate([
    { $group: { _id: '$code', count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $limit: 10 },
  ]).toArray();
  if (duplicateBranchCodes.length) throw new Error('Preflight stopped: duplicate branch codes exist. Resolve them before migrating indexes.');

  const branchIds = await branches.distinct('_id');
  const unknownBranchReferences = await Promise.all([
    employees.countDocuments({ branchId: { $type: 'objectId' }, $expr: { $not: [{ $in: ['$branchId', branchIds] }] } }),
    users.countDocuments({ branchId: { $type: 'objectId' }, $expr: { $not: [{ $in: ['$branchId', branchIds] }] } }),
    sessions.countDocuments({ branchId: { $type: 'objectId' }, $expr: { $not: [{ $in: ['$branchId', branchIds] }] } }),
  ]);
  if (unknownBranchReferences.some(Boolean)) throw new Error('Preflight stopped: employee, account, or session records reference branch records that do not exist.');

  await users.updateMany({ role: { $exists: false } }, { $set: { role: 'unassigned' } });
  await users.updateMany({ branchId: { $exists: false } }, { $set: { branchId: null } });
  await employees.updateMany({ branchId: { $exists: false } }, { $set: { branchId: null } });
  await sessions.updateMany({ branchId: { $exists: false } }, { $set: { branchId: null } });

  await branches.createIndex({ code: 1 }, { unique: true, name: 'code_1' });
  await branches.createIndex(
    { operationsUserId: 1 },
    { unique: true, partialFilterExpression: { operationsUserId: { $type: 'objectId' } }, name: 'operationsUserId_1' },
  );
  await users.createIndex(
    { branchId: 1 },
    { unique: true, partialFilterExpression: { branchId: { $type: 'objectId' } }, name: 'branchId_1_unique_assigned' },
  );
  await employees.createIndex(
    { branchId: 1, id: 1 },
    { unique: true, partialFilterExpression: { branchId: { $type: 'objectId' } }, name: 'branchId_1_id_1' },
  );
  await audits.createIndex({ employeeId: 1 }, { name: 'employeeId_1' });
  await sessionAudits.createIndex({ sessionId: 1 }, { name: 'sessionId_1' });
  await sessions.createIndex(
    { branchId: 1, date: 1 },
    { unique: true, partialFilterExpression: { branchId: { $type: 'objectId' } }, name: 'branchId_1_date_1' },
  );

  const indexes = await employees.indexes();
  if (indexes.some((index) => index.name === 'userId_1_id_1')) {
    await employees.dropIndex('userId_1_id_1');
  }
  const sessionIndexes = await sessions.indexes();
  if (sessionIndexes.some((index) => index.name === 'userId_1_date_1')) {
    await sessions.dropIndex('userId_1_date_1');
  }
  const userIndexes = await users.indexes();
  if (userIndexes.some((index) => index.name === 'branchId_1' && !index.unique)) {
    await users.dropIndex('branchId_1');
  }

  const [legacyCount, unassignedCount, usersCount] = await Promise.all([
    employees.countDocuments({}),
    employees.countDocuments({ branchId: null }),
    users.countDocuments({ role: 'unassigned' }),
  ]);
  console.log(JSON.stringify({ success: true, employeesPreserved: legacyCount, employeesUnassigned: unassignedCount, unassignedAccounts: usersCount, rerunnable: true }));
} finally {
  await mongoose.disconnect();
}
