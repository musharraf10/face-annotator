import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { createCloudinaryPhotoStorage } from '../src/services/referencePhotoStorage.js';

const integrationEnabled = process.env.CLOUDINARY_INTEGRATION_TEST === 'true'
  && Boolean(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

test('Cloudinary denies unsigned original and derived authenticated asset delivery', { skip: !integrationEnabled && 'Set CLOUDINARY_INTEGRATION_TEST=true and Cloudinary credentials to run this provider integration test.' }, async () => {
  const storage = createCloudinaryPhotoStorage();
  const publicId = `presence-check/reference-photos/integration-${randomUUID()}`;
  const bytes = await sharp({ create: { width: 64, height: 64, channels: 3, background: { r: 12, g: 80, b: 160 } } }).webp().toBuffer();
  let uploaded = false;
  try {
    const asset = await storage.put(publicId, bytes, 'image/webp');
    uploaded = true;
    assert.equal(asset.publicId, publicId);
    assert.equal(asset.deliveryType, 'authenticated');

    const originalUrl = cloudinary.url(publicId, { resource_type: 'image', type: 'authenticated', format: 'webp', secure: true });
    const derivedUrl = cloudinary.url(publicId, { resource_type: 'image', type: 'authenticated', format: 'webp', secure: true, transformation: [{ width: 32, height: 32, crop: 'fill' }] });
    for (const url of [originalUrl, derivedUrl]) {
      const response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
      assert.equal(response.ok, false, 'unsigned authenticated asset URL must be denied');
    }
  } finally {
    if (uploaded) await storage.delete(publicId);
  }
});
