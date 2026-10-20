import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import jwt from 'jsonwebtoken';
import sharp from 'sharp';
import { createEmployeeRouter } from '../src/routes/employees.js';
import { Employee } from '../src/models/Employee.js';
import { User } from '../src/models/User.js';
import { Branch } from '../src/models/Branch.js';

process.env.JWT_SECRET = 'automated-test-secret-with-more-than-32-characters';
const branchA = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const opsUserId = '111111111111111111111111';
const originals = new Map();

function stub(object, method, implementation) {
  const key = `${object.modelName}.${method}`;
  if (!originals.has(key)) originals.set(key, [object, method, object[method]]);
  object[method] = implementation;
}

afterEach(() => {
  for (const [object, method, original] of originals.values()) object[method] = original;
  originals.clear();
});

function appFor(storage, options = {}) {
  const app = express();
  app.use('/api/employees', createEmployeeRouter({ storage, ...options }));
  app.use((error, req, res, next) => res.status(500).json({ success: false, error: 'Internal Server Error' }));
  return app;
}

function setupEmployee(employee = makeEmployee()) {
  stub(User, 'findById', async (id) => String(id) === opsUserId ? { _id: opsUserId, role: 'operations', branchId: branchA } : null);
  stub(Branch, 'findOne', async (query) => String(query._id) === branchA && String(query.operationsUserId) === opsUserId && query.active ? { _id: branchA, active: true } : null);
  stub(Employee, 'findOne', async (query) => String(query.branchId) === branchA && query.id === employee.id ? employee : null);
  stub(Employee, 'exists', async (query) => employee.referencePhoto?.publicId === query['referencePhoto.publicId'] ? { _id: employee.id } : null);
  return employee;
}

function makeEmployee(photo = { publicId: 'presence-check/reference-photos/old', assetId: 'cloudinary-asset-old', deliveryType: 'authenticated', contentType: 'image/webp', size: 20, width: 64, height: 64, updatedAt: new Date() }) {
  return {
    id: 'EMP-1', name: 'Employee One',
    referencePhoto: photo,
    referencePhotoCleanupKeys: [],
    referencePhotoCleanupPublicIds: [],
    referencePhotoPendingUploads: [],
    async save() { this.saveCount = (this.saveCount || 0) + 1; },
  };
}

function authHeaders() {
  return { Authorization: `Bearer ${jwt.sign({ id: opsUserId }, process.env.JWT_SECRET)}` };
}

async function withServer(app, callback) {
  const server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  try { await callback(origin); } finally { await new Promise((resolve) => server.close(resolve)); }
}

async function imageFile(bytes) {
  const jpeg = bytes || await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 180, g: 120, b: 90 } } }).jpeg().toBuffer();
  const form = new FormData();
  form.append('photo', new Blob([jpeg], { type: 'image/jpeg' }), 'employee.jpg');
  return form;
}

test('reference photo upload requires authentication', async () => {
  const storage = { put: async () => assert.fail('should not store'), delete: async () => {} };
  await withServer(appFor(storage), async (origin) => {
    const response = await fetch(`${origin}/api/employees/EMP-1/reference-photo`, { method: 'POST', body: await imageFile() });
    assert.equal(response.status, 401);
  });
});

test('authorized photo upload stores normalized WebP as an authenticated Cloudinary asset', async () => {
  const employee = setupEmployee();
  let stored;
  const storage = { put: async (...args) => { stored = args; return { assetId: 'cloudinary-asset-new', publicId: args[0], deliveryType: 'authenticated' }; }, delete: async () => {} };
  await withServer(appFor(storage), async (origin) => {
    const response = await fetch(`${origin}/api/employees/EMP-1/reference-photo`, { method: 'POST', headers: authHeaders(), body: await imageFile() });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.hasReferencePhoto, true);
    assert.match(stored[0], /^presence-check\/reference-photos\/[0-9a-f-]+$/i);
    assert.equal(stored[2], 'image/webp');
    assert.equal(employee.referencePhoto.publicId, stored[0]);
    assert.equal(employee.referencePhoto.assetId, 'cloudinary-asset-new');
    assert.equal(employee.referencePhoto.deliveryType, 'authenticated');
    assert.deepEqual(employee.referencePhotoCleanupPublicIds, []);
    assert.deepEqual(employee.referencePhotoCleanupKeys, []);
  });
});

test('valid JPEG, PNG, and WebP references are accepted and normalized', async () => {
  for (const [format, mime] of [['jpeg', 'image/jpeg'], ['png', 'image/png'], ['webp', 'image/webp']]) {
    setupEmployee(makeEmployee());
    const input = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 20, g: 90, b: 150 } } }).toFormat(format).toBuffer();
    const form = new FormData();
    form.append('photo', new Blob([input], { type: mime }), `reference.${format}`);
    const storage = { put: async (publicId, _buffer, contentType) => { assert.equal(contentType, 'image/webp'); return { assetId: `asset-${format}`, publicId, deliveryType: 'authenticated' }; }, delete: async () => {} };
    await withServer(appFor(storage), async (origin) => {
      const response = await fetch(`${origin}/api/employees/EMP-1/reference-photo`, { method: 'POST', headers: authHeaders(), body: form });
      assert.equal(response.status, 200, `${format} upload should succeed`);
    });
  }
});

test('unsupported image content and spoofed JPEG content are rejected', async () => {
  setupEmployee();
  const storage = { put: async () => assert.fail('invalid image must not be stored'), delete: async () => {} };
  await withServer(appFor(storage), async (origin) => {
    const response = await fetch(`${origin}/api/employees/EMP-1/reference-photo`, { method: 'POST', headers: authHeaders(), body: await imageFile(Buffer.from('not an image')) });
    assert.equal(response.status, 415);
  });
});

test('oversized photo is rejected at the multipart limit', async () => {
  setupEmployee();
  const storage = { put: async () => assert.fail('oversized image must not be stored'), delete: async () => {} };
  const tooLarge = Buffer.alloc(5 * 1024 * 1024 + 1);
  await withServer(appFor(storage), async (origin) => {
    const response = await fetch(`${origin}/api/employees/EMP-1/reference-photo`, { method: 'POST', headers: authHeaders(), body: await imageFile(tooLarge) });
    assert.equal(response.status, 413);
  });
});

test('another branch cannot read, upload, or delete an employee photo', async () => {
  const employee = makeEmployee();
  setupEmployee(employee);
  stub(Employee, 'findOne', async () => null);
  let storageCalls = 0;
  const storage = { get: async () => { storageCalls++; }, put: async () => { storageCalls++; }, delete: async () => { storageCalls++; } };
  await withServer(appFor(storage), async (origin) => {
    const headers = authHeaders();
    assert.equal((await fetch(`${origin}/api/employees/EMP-1/reference-photo`, { headers })).status, 404);
    assert.equal((await fetch(`${origin}/api/employees/EMP-1/reference-photo`, { method: 'POST', headers, body: await imageFile() })).status, 404);
    assert.equal((await fetch(`${origin}/api/employees/EMP-1/reference-photo`, { method: 'DELETE', headers })).status, 404);
    assert.equal(storageCalls, 0);
    assert.equal(employee.referencePhoto.publicId, 'presence-check/reference-photos/old');
  });
});

test('replacement storage failure preserves the existing photo reference', async () => {
  const employee = setupEmployee();
  const storage = { put: async () => { throw Object.assign(new Error('storage unavailable'), { code: 'PHOTO_PROVIDER_UNAVAILABLE' }); }, delete: async () => {} };
  await withServer(appFor(storage), async (origin) => {
    const response = await fetch(`${origin}/api/employees/EMP-1/reference-photo`, { method: 'POST', headers: authHeaders(), body: await imageFile() });
    assert.equal(response.status, 503);
    assert.equal(employee.referencePhoto.publicId, 'presence-check/reference-photos/old');
  });
});

test('database failure after upload keeps the cleanup journal when Cloudinary is unavailable', async () => {
  const employee = setupEmployee();
  let persistedPublicId = employee.referencePhoto.publicId;
  let persistedPending = [];
  employee.save = async function saveWithDatabaseFailure() {
    this.saveCount = (this.saveCount || 0) + 1;
    if (this.saveCount === 2) throw new Error('MongoDB unavailable after upload');
    persistedPublicId = this.referencePhoto.publicId;
    persistedPending = this.referencePhotoPendingUploads.map((entry) => ({ ...entry }));
    return this;
  };
  stub(Employee, 'exists', async (query) => persistedPublicId === query['referencePhoto.publicId'] ? { _id: employee.id } : null);
  const storage = {
    put: async (publicId) => ({ assetId: 'asset-uploaded', publicId, deliveryType: 'authenticated' }),
    delete: async () => { throw Object.assign(new Error('quota or API outage'), { code: 'PHOTO_PROVIDER_UNAVAILABLE' }); },
  };
  await withServer(appFor(storage), async (origin) => {
    const response = await fetch(`${origin}/api/employees/EMP-1/reference-photo`, { method: 'POST', headers: authHeaders(), body: await imageFile() });
    assert.equal(response.status, 500);
    assert.equal(persistedPublicId, 'presence-check/reference-photos/old');
    assert.equal(persistedPending.length, 1);
    assert.match(persistedPending[0].publicId, /^presence-check\/reference-photos\/[0-9a-f-]+$/i);
  });
});

test('deleting a photo leaves the employee record and queues failed object cleanup', async () => {
  const employee = setupEmployee();
  const storage = { delete: async () => { throw new Error('storage unavailable'); } };
  await withServer(appFor(storage), async (origin) => {
    const response = await fetch(`${origin}/api/employees/EMP-1/reference-photo`, { method: 'DELETE', headers: authHeaders() });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.hasReferencePhoto, false);
    assert.equal(result.cleanupPending, 1);
    assert.equal(employee.id, 'EMP-1');
    assert.equal(employee.referencePhoto.publicId, null);
    assert.deepEqual(employee.referencePhotoCleanupPublicIds, ['presence-check/reference-photos/old']);
  });
});

test('deleting an employee cleans its photo first and preserves the record on storage failure', async () => {
  const employee = setupEmployee();
  let employeeDeleteCalled = false;
  stub(Employee, 'findOneAndDelete', async () => { employeeDeleteCalled = true; return employee; });
  const storage = { delete: async () => { throw new Error('storage unavailable'); } };
  await withServer(appFor(storage), async (origin) => {
    const response = await fetch(`${origin}/api/employees/EMP-1`, { method: 'DELETE', headers: authHeaders() });
    assert.equal(response.status, 503);
    assert.equal(employeeDeleteCalled, false);
    assert.equal(employee.id, 'EMP-1');
    assert.equal(employee.referencePhoto.publicId, null);
    assert.deepEqual(employee.referencePhotoCleanupPublicIds, ['presence-check/reference-photos/old']);
  });
});

test('authorized backend retrieval returns private non-cacheable image bytes without forwarding Cloudinary URLs', async () => {
  setupEmployee();
  let readPublicId;
  const expected = Buffer.from('private-webp-data');
  const storage = { get: async (publicId) => { readPublicId = publicId; return expected; } };
  await withServer(appFor(storage), async (origin) => {
    const response = await fetch(`${origin}/api/employees/EMP-1/reference-photo`, { headers: authHeaders() });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(readPublicId, 'presence-check/reference-photos/old');
    assert.equal(response.headers.get('content-type'), 'image/webp');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), expected);
  });
});

test('a backend storage read failure does not expose an object URL or key', async () => {
  setupEmployee();
  const storage = { get: async () => { throw new Error('private bucket outage'); } };
  await withServer(appFor(storage), async (origin) => {
    const response = await fetch(`${origin}/api/employees/EMP-1/reference-photo`, { headers: authHeaders() });
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { success: false, error: 'Internal Server Error' });
  });
});
