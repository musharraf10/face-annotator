import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import employeeRoutes from '../src/routes/employees.js';
import adminRoutes from '../src/routes/admin.js';
import authRoutes from '../src/routes/auth.js';
import sessionRoutes from '../src/routes/sessions.js';
import { Employee } from '../src/models/Employee.js';
import { User } from '../src/models/User.js';
import { Branch } from '../src/models/Branch.js';
import { Session } from '../src/models/Session.js';

process.env.JWT_SECRET = 'automated-test-secret-with-more-than-32-characters';
const branchA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const branchB = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const opsUserId = '111111111111111111111111';
const adminUserId = '222222222222222222222222';
const targetUserId = '333333333333333333333333';
const originals = new Map();

function stub(object, method, implementation) {
  if (!originals.has(`${object.modelName}.${method}`)) originals.set(`${object.modelName}.${method}`, [object, method, object[method]]);
  object[method] = implementation;
}

afterEach(() => {
  for (const [object, method, original] of originals.values()) object[method] = original;
  originals.clear();
});

function appFor(router, prefix) {
  const app = express();
  app.use(express.json());
  app.use(prefix, router);
  app.use((error, req, res, next) => res.status(500).json({ error: error.message }));
  return app;
}

async function withServer(app, callback) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try { await callback(origin); } finally { await new Promise((resolve) => server.close(resolve)); }
}

function authHeaders(userId = opsUserId) {
  return { Authorization: `Bearer ${jwt.sign({ id: userId }, process.env.JWT_SECRET)}`, 'Content-Type': 'application/json' };
}

function stubOperations({ branchId = branchA, role = 'operations', branchActive = true } = {}) {
  const account = { _id: opsUserId, role, branchId: role === 'operations' ? branchId : null };
  stub(User, 'findById', async (id) => String(id) === opsUserId ? account : null);
  stub(Branch, 'findOne', async (query) => {
    if (branchActive && String(query._id) === branchId && query.active === true && String(query.operationsUserId) === opsUserId) {
      return { _id: branchId, active: true, operationsUserId: opsUserId };
    }
    return null;
  });
  return account;
}

test('employee APIs reject unauthenticated access', async () => {
  await withServer(appFor(employeeRoutes, '/api/employees'), async (origin) => {
    const response = await fetch(`${origin}/api/employees`);
    assert.equal(response.status, 401);
  });
});

test('employee list is queried only for the authenticated account branch', async () => {
  stubOperations();
  let query;
  stub(Employee, 'find', (filter) => {
    query = filter;
    return { select: () => ({ sort: async () => [{ id: 'A-1', name: 'Branch A employee' }] }) };
  });
  await withServer(appFor(employeeRoutes, '/api/employees'), async (origin) => {
    const response = await fetch(`${origin}/api/employees`, { headers: authHeaders() });
    assert.equal(response.status, 200);
    assert.deepEqual(query, { branchId: branchA });
    assert.deepEqual((await response.json()).employees, [{ id: 'A-1', name: 'Branch A employee', hasReferencePhoto: false, referencePhotoProvider: null }]);
  });
});

test('new employee branch and owner come from the authenticated account', async () => {
  const account = stubOperations();
  let created;
  stub(Employee, 'create', async (data) => { created = data; return { id: data.id, name: data.name }; });
  await withServer(appFor(employeeRoutes, '/api/employees'), async (origin) => {
    const response = await fetch(`${origin}/api/employees`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ id: ' a-2 ', name: 'Employee A', branchId: branchB, userId: '333333333333333333333333' }),
    });
    assert.equal(response.status, 400);
    assert.equal(created, undefined);
    const accepted = await fetch(`${origin}/api/employees`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ id: ' a-2 ', name: 'Employee A' }),
    });
    assert.equal(accepted.status, 201);
    assert.equal((await accepted.json()).employee.hasReferencePhoto, false);
    assert.equal(created.branchId, branchA);
    assert.equal(created.userId, account._id);
    assert.equal(created.id, 'A-2');
  });
});

test('cross-branch employee read, update, and deletion return not found', async () => {
  stubOperations({ branchId: branchA });
  const observed = [];
  stub(Employee, 'findOne', (filter) => {
    observed.push(filter);
    const query = { select: () => query, then: (resolve, reject) => Promise.resolve(null).then(resolve, reject) };
    return query;
  });
  stub(Employee, 'findOneAndDelete', async () => null);
  await withServer(appFor(employeeRoutes, '/api/employees'), async (origin) => {
    const headers = authHeaders();
    assert.equal((await fetch(`${origin}/api/employees/B-7`, { headers })).status, 404);
    assert.equal((await fetch(`${origin}/api/employees/B-7`, { method: 'PUT', headers, body: JSON.stringify({ id: 'B-8', name: 'Other' }) })).status, 404);
    assert.equal((await fetch(`${origin}/api/employees/B-7`, { method: 'DELETE', headers })).status, 404);
    assert.equal(observed.length, 3);
    for (const filter of observed) assert.deepEqual(filter, { branchId: branchA, id: 'B-7' });
  });
});

test('branch collisions are reported by the branch unique index path', async () => {
  stubOperations();
  stub(Employee, 'create', async () => { throw Object.assign(new Error('duplicate'), { code: 11000 }); });
  await withServer(appFor(employeeRoutes, '/api/employees'), async (origin) => {
    const response = await fetch(`${origin}/api/employees`, { method: 'POST', headers: authHeaders(), body: JSON.stringify({ id: 'A-1', name: 'Duplicate' }) });
    assert.equal(response.status, 409);
  });
});

test('bulk employee sync is scoped to the authenticated branch and rejects overrides', async () => {
  stubOperations();
  const upserts = [];
  stub(Employee, 'findOneAndUpdate', async (filter, update) => { upserts.push({ filter, update }); });
  stub(Employee, 'find', () => ({ select: () => ({ sort: async () => [] }) }));
  await withServer(appFor(employeeRoutes, '/api/employees'), async (origin) => {
    const headers = authHeaders();
    const denied = await fetch(`${origin}/api/employees/sync`, { method: 'POST', headers, body: JSON.stringify({ employees: [{ id: 'X-1', name: 'A', branchId: branchB }] }) });
    assert.equal(denied.status, 400);
    assert.equal(upserts.length, 0);
    const accepted = await fetch(`${origin}/api/employees/sync`, { method: 'POST', headers, body: JSON.stringify({ employees: [{ id: ' x-1 ', name: 'A' }] }) });
    assert.equal(accepted.status, 200);
    assert.deepEqual(upserts[0].filter, { branchId: branchA, id: 'X-1' });
    assert.equal(upserts[0].update.$setOnInsert.branchId, branchA);
  });
});

test('session records and listings are scoped to the authorized branch', async () => {
  stubOperations();
  let query;
  stub(Session, 'find', (filter) => { query = filter; return { sort: async () => [] }; });
  await withServer(appFor(sessionRoutes, '/api/sessions'), async (origin) => {
    const response = await fetch(`${origin}/api/sessions`, { headers: authHeaders() });
    assert.equal(response.status, 200);
    assert.deepEqual(query, { branchId: branchA });
  });
});

test('public registration ignores submitted branch and privilege fields', async () => {
  let created;
  stub(User, 'findOne', async () => null);
  stub(User, 'create', async (data) => {
    created = data;
    return { ...data, role: 'unassigned', branchId: null, _id: opsUserId, createdAt: new Date('2025-01-01T00:00:00Z') };
  });
  await withServer(appFor(authRoutes, '/api/auth'), async (origin) => {
    const response = await fetch(`${origin}/api/auth/register`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New user', email: 'new@example.test', password: 'password', role: 'admin', branchId: branchB, isAdmin: true }),
    });
    assert.equal(response.status, 201);
    assert.equal(created.role, undefined);
    assert.equal(created.branchId, undefined);
    assert.equal((await response.json()).user.role, 'unassigned');
  });
});

test('ordinary Operations Employee cannot access administrator endpoints', async () => {
  stubOperations({ role: 'operations' });
  let branchListQueried = false;
  stub(Branch, 'find', async () => { branchListQueried = true; return []; });
  await withServer(appFor(adminRoutes, '/api/admin'), async (origin) => {
    const response = await fetch(`${origin}/api/admin/branches`, { headers: authHeaders() });
    assert.equal(response.status, 403);
    assert.equal(branchListQueried, false);
  });
});

test('administrator assignment activates a branch and assigns the chosen unassigned account transactionally', async () => {
  const admin = { _id: adminUserId, role: 'admin' };
  const target = { _id: targetUserId, role: 'unassigned', branchId: null };
  const branch = { _id: branchA, id: branchA, active: false, operationsUserId: null };
  let branchUpdate;
  let userUpdate;
  let transactionRan = false;
  const transaction = { withTransaction: async (callback) => { transactionRan = true; await callback(); }, endSession: async () => {} };
  stub(mongoose, 'startSession', async () => transaction);
  stub(User, 'findById', async (id) => String(id) === adminUserId ? admin : String(id) === targetUserId ? target : null);
  stub(Branch, 'findById', async () => branch);
  stub(Branch, 'findOneAndUpdate', async (filter, update) => { branchUpdate = { filter, update }; return branch; });
  stub(User, 'findOneAndUpdate', async (filter, update) => { userUpdate = { filter, update }; return target; });
  await withServer(appFor(adminRoutes, '/api/admin'), async (origin) => {
    const response = await fetch(`${origin}/api/admin/branches/${branchA}/operations-account`, {
      method: 'POST', headers: authHeaders(adminUserId), body: JSON.stringify({ userId: targetUserId, branchId: branchB, role: 'admin' }),
    });
    assert.equal(response.status, 200);
    assert.equal(transactionRan, true);
    assert.equal(branchUpdate.update.$set.operationsUserId, targetUserId);
    assert.equal(branchUpdate.update.$set.active, true);
    assert.equal(userUpdate.update.$set.branchId, branchA);
    assert.equal(userUpdate.update.$set.role, 'operations');
  });
});

test('employee ID uniqueness index is branch-scoped and only indexes assigned records', () => {
  const uniqueBranchIndex = Employee.schema.indexes().find(([keys]) => keys.branchId === 1 && keys.id === 1);
  assert.ok(uniqueBranchIndex);
  assert.equal(uniqueBranchIndex[1].unique, true);
  assert.deepEqual(uniqueBranchIndex[1].partialFilterExpression, { branchId: { $type: 'objectId' } });
  const userSchema = User.schema;
  assert.equal(userSchema.path('role').defaultValue, 'unassigned');
  const oneBranchPerAccount = userSchema.indexes().find(([keys]) => keys.branchId === 1);
  assert.equal(oneBranchPerAccount[1].unique, true);
  const oneOperationsAccountPerBranch = Branch.schema.indexes().find(([keys]) => keys.operationsUserId === 1);
  assert.equal(oneOperationsAccountPerBranch[1].unique, true);
});
