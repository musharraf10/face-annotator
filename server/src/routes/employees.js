import express from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { Employee } from '../models/Employee.js';
import { protect, requireOperationsAccount } from '../middleware/auth.js';
import { referencePhotoStorage } from '../services/referencePhotoStorage.js';
import { InvalidReferencePhotoError, processReferencePhoto } from '../services/processReferencePhoto.js';

const defaultPhotoLimit = 5 * 1024 * 1024;
const configuredPhotoLimit = Number.parseInt(process.env.REFERENCE_PHOTO_MAX_BYTES || '', 10);
const maxPhotoBytes = Number.isInteger(configuredPhotoLimit) && configuredPhotoLimit > 0
  ? Math.min(configuredPhotoLimit, 10 * 1024 * 1024)
  : defaultPhotoLimit;

const acceptedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

function hasOwnershipOverride(value) {
  return value && (Object.hasOwn(value, 'branchId') || Object.hasOwn(value, 'userId'));
}

function duplicateResponse(res, id) {
  return res.status(409).json({ success: false, error: `Employee ID "${id}" already exists in this branch.` });
}

async function findEmployee(branchId, employeeId) {
  return Employee.findOne({ branchId, id: employeeId.trim().toUpperCase() });
}

function isLegacyS3Photo(photo) {
  return Boolean(photo?.key && !photo?.publicId);
}

function hasReferencePhoto(photo) {
  return Boolean(photo?.publicId || photo?.key);
}

async function cleanupPendingPublicIds(employee, storage) {
  const pending = [...(employee.referencePhotoCleanupPublicIds || [])];
  for (const publicId of pending) {
    try {
      const referenced = await Employee.exists({ 'referencePhoto.publicId': publicId });
      if (referenced) {
        employee.referencePhotoCleanupPublicIds = (employee.referencePhotoCleanupPublicIds || []).filter((queued) => queued !== publicId);
        await employee.save();
        continue;
      }
      await storage.delete(publicId);
      employee.referencePhotoCleanupPublicIds = (employee.referencePhotoCleanupPublicIds || []).filter((queued) => queued !== publicId);
      await employee.save();
    } catch { /* keep failed Cloudinary deletes queued for a later retry */ }
  }
  return (employee.referencePhotoCleanupPublicIds || []).length;
}

async function reconcilePendingUploads(employee, storage, forcePublicId = null) {
  const pending = [...(employee.referencePhotoPendingUploads || [])];
  const staleBefore = Date.now() - 10 * 60 * 1000;
  for (const operation of pending) {
    if (!operation.publicId || (operation.publicId !== forcePublicId && new Date(operation.createdAt).getTime() > staleBefore)) continue;
    try {
      const referenced = await Employee.exists({ 'referencePhoto.publicId': operation.publicId });
      if (!referenced) await storage.delete(operation.publicId);
      employee.referencePhotoPendingUploads = (employee.referencePhotoPendingUploads || []).filter((item) => item.publicId !== operation.publicId);
      await employee.save();
    } catch { /* retain journal entry if provider or database is unavailable */ }
  }
  return (employee.referencePhotoPendingUploads || []).length;
}

export function createEmployeeRouter({ storage = referencePhotoStorage, imageProcessor = processReferencePhoto } = {}) {
const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxPhotoBytes, files: 1, fields: 0, parts: 1 },
  fileFilter(req, file, callback) {
    if (!acceptedMimeTypes.has(file.mimetype)) return callback(Object.assign(new Error('Only JPEG, PNG, or WebP images are accepted.'), { code: 'UNSUPPORTED_IMAGE_TYPE' }));
    callback(null, true);
  },
});
router.use(protect, requireOperationsAccount);

router.get('/', async (req, res, next) => {
  try {
    const employees = await Employee.find({ branchId: req.branchId }).select('id name referencePhoto createdAt updatedAt').sort({ createdAt: 1 });
    res.json({ success: true, employees: employees.map(({ id, name, referencePhoto }) => ({ id, name, hasReferencePhoto: hasReferencePhoto(referencePhoto), referencePhotoProvider: referencePhoto?.publicId ? 'cloudinary' : referencePhoto?.key ? 'legacy-s3' : null })) });
  } catch (error) { next(error); }
});

router.post('/', async (req, res, next) => {
  try {
    if (hasOwnershipOverride(req.body)) return res.status(400).json({ success: false, error: 'Branch and owner are assigned by the server.' });
    const { id, name } = req.body;
    if (typeof id !== 'string' || typeof name !== 'string' || !id.trim() || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Employee ID and Name are required.' });
    }
    const cleanId = id.trim().toUpperCase();
    const employee = await Employee.create({ userId: req.account._id, branchId: req.branchId, id: cleanId, name: name.trim() });
    res.status(201).json({ success: true, employee: { id: employee.id, name: employee.name, hasReferencePhoto: hasReferencePhoto(employee.referencePhoto), referencePhotoProvider: employee.referencePhoto?.publicId ? 'cloudinary' : employee.referencePhoto?.key ? 'legacy-s3' : null } });
  } catch (error) {
    if (error.code === 11000) return duplicateResponse(res, req.body.id?.trim()?.toUpperCase());
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ branchId: req.branchId, id: req.params.id.trim().toUpperCase() }).select('id name referencePhoto');
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found.' });
    res.json({ success: true, employee: { id: employee.id, name: employee.name, hasReferencePhoto: hasReferencePhoto(employee.referencePhoto), referencePhotoProvider: employee.referencePhoto?.publicId ? 'cloudinary' : employee.referencePhoto?.key ? 'legacy-s3' : null } });
  } catch (error) { next(error); }
});

router.put('/:id', async (req, res, next) => {
  try {
    if (hasOwnershipOverride(req.body)) return res.status(400).json({ success: false, error: 'Branch and owner are assigned by the server.' });
    const { id, name } = req.body;
    if (typeof id !== 'string' || typeof name !== 'string' || !id.trim() || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Employee ID and Name are required.' });
    }
    const oldId = req.params.id.trim().toUpperCase();
    const employee = await Employee.findOne({ branchId: req.branchId, id: oldId });
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found.' });
    employee.id = id.trim().toUpperCase();
    employee.name = name.trim();
    await employee.save();
    res.json({ success: true, employee: { id: employee.id, name: employee.name, hasReferencePhoto: hasReferencePhoto(employee.referencePhoto), referencePhotoProvider: employee.referencePhoto?.publicId ? 'cloudinary' : employee.referencePhoto?.key ? 'legacy-s3' : null } });
  } catch (error) {
    if (error.code === 11000) return duplicateResponse(res, req.body.id?.trim()?.toUpperCase());
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const targetId = req.params.id.trim().toUpperCase();
    const employee = await findEmployee(req.branchId, targetId);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found.' });
    if (isLegacyS3Photo(employee.referencePhoto)) {
      return res.status(409).json({ success: false, error: 'This employee has a legacy S3 photo. Migrate or remove it through the previous storage provider before deleting the employee.' });
    }
    await reconcilePendingUploads(employee, storage);
    if ((employee.referencePhotoPendingUploads || []).length) {
      return res.status(503).json({ success: false, error: 'A photo operation is still pending. Retry employee deletion later.' });
    }
    if (employee.referencePhoto?.publicId) {
      const oldPublicId = employee.referencePhoto.publicId;
      employee.referencePhoto = { key: null, publicId: null, assetId: null, deliveryType: null, contentType: null, size: null, width: null, height: null, updatedAt: null };
      employee.referencePhotoCleanupPublicIds = [...(employee.referencePhotoCleanupPublicIds || []), oldPublicId];
      await employee.save();
    }
    const cleanupPending = await cleanupPendingPublicIds(employee, storage);
    if (cleanupPending) {
      return res.status(503).json({ success: false, error: 'Employee photo removal is queued. Retry employee deletion after storage is available.' });
    }
    const result = await Employee.findOneAndDelete({ branchId: req.branchId, id: targetId });
    if (!result) return res.status(404).json({ success: false, error: 'Employee not found.' });
    res.json({ success: true, message: `Employee "${targetId}" deleted successfully.` });
  } catch (error) { next(error); }
});

// Reference images never use a client-supplied branch, URL, object key, or filename.
router.post('/:id/reference-photo', (req, res, next) => {
  upload.single('photo')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ success: false, error: `Image exceeds the ${Math.floor(maxPhotoBytes / 1024 / 1024)} MB upload limit.` });
    if (error.code === 'UNSUPPORTED_IMAGE_TYPE') return res.status(415).json({ success: false, error: error.message });
    next(error);
  });
}, async (req, res, next) => {
  let plannedPublicId;
  let employeeForCleanup;
  try {
    if (!req.file) return res.status(400).json({ success: false, error: 'Select a reference photo to upload.' });
    const employee = await findEmployee(req.branchId, req.params.id);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found.' });
    employeeForCleanup = employee;
    if (isLegacyS3Photo(employee.referencePhoto)) return res.status(409).json({ success: false, error: 'This employee has a legacy S3 photo. Migrate it before using Cloudinary photo actions.' });

    await cleanupPendingPublicIds(employee, storage);
    await reconcilePendingUploads(employee, storage);

    const normalized = await imageProcessor(req.file.buffer);
    plannedPublicId = `presence-check/reference-photos/${randomUUID()}`;
    employee.referencePhotoPendingUploads = [...(employee.referencePhotoPendingUploads || []), { publicId: plannedPublicId, createdAt: new Date() }];
    await employee.save();
    const uploaded = await storage.put(plannedPublicId, normalized.buffer, normalized.contentType);
    if (!uploaded?.assetId || uploaded.publicId !== plannedPublicId || uploaded.deliveryType !== 'authenticated') {
      throw Object.assign(new Error('Photo provider did not confirm authenticated delivery.'), { code: 'PHOTO_PROVIDER_UNAVAILABLE' });
    }
    const oldPublicId = employee.referencePhoto?.publicId;
    employee.referencePhoto = {
      key: null,
      publicId: uploaded.publicId,
      assetId: uploaded.assetId,
      deliveryType: uploaded.deliveryType,
      contentType: normalized.contentType,
      size: normalized.buffer.length,
      width: normalized.width,
      height: normalized.height,
      updatedAt: new Date(),
    };
    if (oldPublicId) employee.referencePhotoCleanupPublicIds = [...(employee.referencePhotoCleanupPublicIds || []), oldPublicId];
    // Persist the new reference while the pre-upload journal still exists. If this save
    // fails, the stale journal can safely determine whether cleanup is needed.
    await employee.save();
    employee.referencePhotoPendingUploads = (employee.referencePhotoPendingUploads || []).filter((item) => item.publicId !== plannedPublicId);
    let journalPending = false;
    try { await employee.save(); } catch { journalPending = true; }
    const cleanupPending = await cleanupPendingPublicIds(employee, storage);
    if (!journalPending) await reconcilePendingUploads(employee, storage);
    res.json({ success: true, hasReferencePhoto: true, cleanupPending: cleanupPending + (journalPending ? 1 : 0) });
  } catch (error) {
    if (plannedPublicId && employeeForCleanup) {
      try { await reconcilePendingUploads(employeeForCleanup, storage, plannedPublicId); } catch { /* the persisted journal is retained for a later retry */ }
    }
    if (error instanceof InvalidReferencePhotoError) return res.status(415).json({ success: false, error: error.message });
    if (error.code === 'PHOTO_STORAGE_NOT_CONFIGURED') return res.status(503).json({ success: false, error: 'Cloudinary reference-photo storage is not configured on the backend.' });
    if (error.code === 'PHOTO_PROVIDER_UNAVAILABLE') return res.status(503).json({ success: false, error: 'Cloudinary photo storage is temporarily unavailable. Existing photo data was preserved.' });
    next(error);
  }
});

router.get('/:id/reference-photo', async (req, res, next) => {
  try {
    const employee = await findEmployee(req.branchId, req.params.id);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found.' });
    if (isLegacyS3Photo(employee.referencePhoto)) return res.status(409).json({ success: false, error: 'This reference photo is stored by the previous S3 provider and needs migration.' });
    if (!employee.referencePhoto?.publicId) return res.status(404).json({ success: false, error: 'No reference photo is registered.' });
    const image = await storage.get(employee.referencePhoto.publicId);
    res.set({ 'Content-Type': 'image/webp', 'Content-Length': String(image.length), 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline; filename="employee-reference.webp"' });
    res.send(image);
  } catch (error) {
    if (error.code === 'PHOTO_STORAGE_NOT_CONFIGURED') return res.status(503).json({ success: false, error: 'Cloudinary reference-photo storage is not configured on the backend.' });
    if (error.code === 'PHOTO_PROVIDER_UNAVAILABLE') return res.status(503).json({ success: false, error: 'Cloudinary photo storage is temporarily unavailable.' });
    next(error);
  }
});

router.delete('/:id/reference-photo', async (req, res, next) => {
  try {
    const employee = await findEmployee(req.branchId, req.params.id);
    if (!employee) return res.status(404).json({ success: false, error: 'Employee not found.' });
    if (isLegacyS3Photo(employee.referencePhoto)) return res.status(409).json({ success: false, error: 'This reference photo is stored by the previous S3 provider and needs migration.' });
    await reconcilePendingUploads(employee, storage);
    const oldPublicId = employee.referencePhoto?.publicId;
    if (!oldPublicId) {
      const cleanupPending = await cleanupPendingPublicIds(employee, storage);
      return res.json({ success: true, hasReferencePhoto: false, cleanupPending });
    }
    employee.referencePhoto = { key: null, publicId: null, assetId: null, deliveryType: null, contentType: null, size: null, width: null, height: null, updatedAt: null };
    employee.referencePhotoCleanupPublicIds = [...(employee.referencePhotoCleanupPublicIds || []), oldPublicId];
    await employee.save();
    const cleanupPending = await cleanupPendingPublicIds(employee, storage);
    res.json({ success: true, hasReferencePhoto: false, cleanupPending });
  } catch (error) {
    next(error);
  }
});

// Kept for compatibility. All upserts are scoped to the authenticated branch;
// browser caches are never used as proof of branch ownership.
router.post('/sync', async (req, res, next) => {
  try {
    const { employees } = req.body;
    if (hasOwnershipOverride(req.body) || !Array.isArray(employees)) {
      return res.status(400).json({ success: false, error: 'Invalid employee sync request.' });
    }
    const cleanEmployees = [];
    for (const employee of employees) {
      if (!employee || hasOwnershipOverride(employee) || typeof employee.id !== 'string' || typeof employee.name !== 'string' || !employee.id.trim() || !employee.name.trim()) {
        return res.status(400).json({ success: false, error: 'Branch and owner are server-managed; each employee needs an ID and name.' });
      }
      cleanEmployees.push({ id: employee.id.trim().toUpperCase(), name: employee.name.trim() });
    }
    for (const employee of cleanEmployees) {
      await Employee.findOneAndUpdate(
        { branchId: req.branchId, id: employee.id },
        { $setOnInsert: { ...employee, userId: req.account._id, branchId: req.branchId } },
        { upsert: true, new: true, runValidators: true },
      );
    }
    const currentEmployees = await Employee.find({ branchId: req.branchId }).select('id name').sort({ createdAt: 1 });
    res.json({ success: true, employees: currentEmployees.map(({ id, name }) => ({ id, name })) });
  } catch (error) {
    if (error.code === 11000) return duplicateResponse(res, '');
    next(error);
  }
});

return router;
}

export default createEmployeeRouter();
