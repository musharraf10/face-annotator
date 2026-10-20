import { Readable } from 'node:stream';
import { v2 as cloudinary } from 'cloudinary';

const ASSET_NAMESPACE = 'presence-check/reference-photos/';
const DOWNLOAD_MAX_BYTES = 5 * 1024 * 1024;

function configure(sdk) {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    const error = new Error('Cloudinary reference-photo storage is not configured.');
    error.code = 'PHOTO_STORAGE_NOT_CONFIGURED';
    throw error;
  }
  sdk.config({ cloud_name: CLOUDINARY_CLOUD_NAME, api_key: CLOUDINARY_API_KEY, api_secret: CLOUDINARY_API_SECRET, secure: true });
  return CLOUDINARY_CLOUD_NAME;
}

function providerError() {
  const error = new Error('Cloudinary photo storage is temporarily unavailable.');
  error.code = 'PHOTO_PROVIDER_UNAVAILABLE';
  return error;
}

function assertManagedPublicId(publicId) {
  if (typeof publicId !== 'string' || !publicId.startsWith(ASSET_NAMESPACE)) throw providerError();
}

function uploadBuffer(sdk, body, publicId) {
  return new Promise((resolve, reject) => {
    const stream = sdk.uploader.upload_stream({
      resource_type: 'image',
      type: 'authenticated',
      public_id: publicId,
      overwrite: false,
      use_filename: false,
      unique_filename: false,
      invalidate: false,
    }, (error, result) => error ? reject(error) : resolve(result));
    Readable.from([body]).pipe(stream);
  });
}

export function createCloudinaryPhotoStorage({ sdk = cloudinary, fetchImpl = globalThis.fetch } = {}) {
  return {
    async put(publicId, body) {
      configure(sdk);
      assertManagedPublicId(publicId);
      try {
        const result = await uploadBuffer(sdk, body, publicId);
        if (!result?.asset_id || !result?.public_id || result.type !== 'authenticated') throw providerError();
        return { assetId: result.asset_id, publicId: result.public_id, deliveryType: result.type };
      } catch {
        throw providerError();
      }
    },

    async get(publicId) {
      const cloudName = configure(sdk);
      assertManagedPublicId(publicId);
      try {
        const temporaryUrl = sdk.utils.private_download_url(publicId, 'webp', {
          resource_type: 'image',
          type: 'authenticated',
          expires_at: Math.floor(Date.now() / 1000) + 60,
          secure: true,
        });
        const parsed = new URL(temporaryUrl);
        const allowedHosts = new Set(['api.cloudinary.com', 'api-eu.cloudinary.com', 'api-ap.cloudinary.com']);
        if (parsed.protocol !== 'https:' || !allowedHosts.has(parsed.hostname) || !parsed.pathname.startsWith(`/v1_1/${cloudName}/image/download`)) throw providerError();
        const response = await fetchImpl(parsed, { redirect: 'follow', signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw providerError();
        const contentLength = Number(response.headers.get('content-length') || 0);
        if (contentLength > DOWNLOAD_MAX_BYTES) throw providerError();
        const bytes = Buffer.from(await response.arrayBuffer());
        if (!bytes.length || bytes.length > DOWNLOAD_MAX_BYTES) throw providerError();
        return bytes;
      } catch {
        throw providerError();
      }
    },

    async delete(publicId) {
      configure(sdk);
      assertManagedPublicId(publicId);
      try {
        const result = await sdk.uploader.destroy(publicId, {
          resource_type: 'image',
          type: 'authenticated',
          invalidate: true,
        });
        if (!['ok', 'not found'].includes(result?.result)) throw providerError();
      } catch {
        throw providerError();
      }
    },
  };
}

export const referencePhotoStorage = createCloudinaryPhotoStorage();
