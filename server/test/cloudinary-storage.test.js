import test, { afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { createCloudinaryPhotoStorage } from '../src/services/referencePhotoStorage.js';

const envKeys = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];
const originalEnv = new Map(envKeys.map((key) => [key, process.env[key]]));

function configureTestEnv() {
  process.env.CLOUDINARY_CLOUD_NAME = 'test-cloud';
  process.env.CLOUDINARY_API_KEY = 'test-key';
  process.env.CLOUDINARY_API_SECRET = 'test-secret';
}

function fakeSdk() {
  const calls = { config: [], upload: [], destroy: [], download: [] };
  const sdk = {
    config: (value) => calls.config.push(value),
    uploader: {
      upload_stream(options, callback) {
        calls.upload.push(options);
        return new Writable({
          write(chunk, encoding, done) { done(); },
          final(done) {
            queueMicrotask(() => callback(null, { public_id: options.public_id, asset_id: 'asset-123', type: options.type, secure_url: 'https://public-url-must-not-escape' }));
            done();
          },
        });
      },
      async destroy(publicId, options) { calls.destroy.push({ publicId, options }); return { result: 'ok' }; },
    },
    utils: {
      private_download_url(publicId, format, options) {
        calls.download.push({ publicId, format, options });
        return 'https://api.cloudinary.com/v1_1/test-cloud/image/download?signature=temporary-secret';
      },
    },
  };
  return { sdk, calls };
}

afterEach(() => {
  for (const [key, value] of originalEnv) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

test('Cloudinary uploads always use authenticated delivery and return identifiers only', async () => {
  configureTestEnv();
  const { sdk, calls } = fakeSdk();
  const storage = createCloudinaryPhotoStorage({ sdk });
  const buffer = Buffer.from('normalized webp bytes');
  const result = await storage.put('presence-check/reference-photos/random-id', buffer, 'image/webp');
  assert.equal(calls.upload.length, 1);
  assert.equal(calls.upload[0].type, 'authenticated');
  assert.notEqual(calls.upload[0].type, 'upload');
  assert.equal(calls.upload[0].resource_type, 'image');
  assert.equal(calls.upload[0].overwrite, false);
  assert.equal(calls.upload[0].use_filename, false);
  assert.equal(calls.upload[0].public_id, 'presence-check/reference-photos/random-id');
  assert.deepEqual(result, { assetId: 'asset-123', publicId: 'presence-check/reference-photos/random-id', deliveryType: 'authenticated' });
  assert.equal(Object.hasOwn(result, 'secure_url'), false);
});

test('Cloudinary signed download URL is used internally and only image bytes are returned', async () => {
  configureTestEnv();
  const { sdk, calls } = fakeSdk();
  let requested;
  const storage = createCloudinaryPhotoStorage({ sdk, fetchImpl: async (url, options) => {
    requested = { url: String(url), options };
    return new Response(Buffer.from('private image bytes'), { status: 200, headers: { 'content-type': 'image/webp' } });
  } });
  const bytes = await storage.get('presence-check/reference-photos/random-id');
  assert.deepEqual(bytes, Buffer.from('private image bytes'));
  assert.equal(calls.download[0].options.type, 'authenticated');
  assert.equal(calls.download[0].options.resource_type, 'image');
  assert.ok(calls.download[0].options.expires_at <= Math.floor(Date.now() / 1000) + 60);
  assert.match(requested.url, /^https:\/\/api\.cloudinary\.com\//);
  assert.equal(requested.options.redirect, 'follow');
});

test('Cloudinary deletion explicitly uses the authenticated delivery type', async () => {
  configureTestEnv();
  const { sdk, calls } = fakeSdk();
  await createCloudinaryPhotoStorage({ sdk }).delete('presence-check/reference-photos/random-id');
  assert.deepEqual(calls.destroy[0], {
    publicId: 'presence-check/reference-photos/random-id',
    options: { resource_type: 'image', type: 'authenticated', invalidate: true },
  });
});

test('provider quota or API errors are sanitized', async () => {
  configureTestEnv();
  const { sdk } = fakeSdk();
  sdk.uploader.upload_stream = (options, callback) => {
    queueMicrotask(() => callback(Object.assign(new Error('private quota detail and secret'), { http_code: 420 })));
    return new Writable({ write(chunk, encoding, done) { done(); } });
  };
  await assert.rejects(
    () => createCloudinaryPhotoStorage({ sdk }).put('presence-check/reference-photos/random-id', Buffer.from('bytes'), 'image/webp'),
    (error) => error.code === 'PHOTO_PROVIDER_UNAVAILABLE' && !error.message.includes('secret'),
  );
});
