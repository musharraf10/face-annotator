import sharp from 'sharp';

export class InvalidReferencePhotoError extends Error {
  constructor(message = 'Upload a valid JPEG, PNG, or WebP image.') {
    super(message);
    this.name = 'InvalidReferencePhotoError';
  }
}

export async function processReferencePhoto(input) {
  if (!Buffer.isBuffer(input) || input.length === 0) throw new InvalidReferencePhotoError('The uploaded image is empty.');
  try {
    const image = sharp(input, { failOn: 'error', limitInputPixels: 25_000_000, sequentialRead: true });
    const metadata = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format)) throw new InvalidReferencePhotoError();
    if (!metadata.width || !metadata.height || metadata.width < 32 || metadata.height < 32 || metadata.width > 10_000 || metadata.height > 10_000) {
      throw new InvalidReferencePhotoError('Image dimensions are unsupported. Upload an image at least 32 × 32 pixels and no larger than 10,000 × 10,000 pixels.');
    }
    const { data, info } = await image.rotate().resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true }).webp({ quality: 86, effort: 4 }).toBuffer({ resolveWithObject: true });
    return { buffer: data, contentType: 'image/webp', width: info.width, height: info.height };
  } catch (error) {
    if (error instanceof InvalidReferencePhotoError) throw error;
    throw new InvalidReferencePhotoError('The image could not be decoded. Upload a non-corrupted JPEG, PNG, or WebP image.');
  }
}
