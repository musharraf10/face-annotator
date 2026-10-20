# Employee reference photos

## Cloudinary storage

The backend uses the official Cloudinary Node.js SDK. New employee reference photos are uploaded as image assets with Cloudinary delivery type `authenticated`, never the default `upload` type. The API stores the Cloudinary asset ID and public ID in MongoDB; it does not return Cloudinary delivery URLs to the browser. Employee photo routes first require a valid JWT and Operations Employee branch authorization, then look up the employee within that branch.

Cloudinary authenticated assets require signed delivery and protect the original and derived versions. The backend creates a short-lived (60 second) private download URL only for its internal fetch, validates the destination as a Cloudinary API download endpoint, and returns the resulting bytes through the authenticated API with `Cache-Control: private, no-store` and `X-Content-Type-Options: nosniff`. The signed URL is never sent to the browser. See Cloudinary's [access control documentation](https://cloudinary.com/documentation/control_access_to_media), [private download API](https://cloudinary.com/documentation/image_upload_api_reference), and [delivery URL signatures](https://cloudinary.com/documentation/delivery_url_signatures).

## Render configuration

Set these values in the **Render backend** environment only. Never put Cloudinary credentials in Vite/Netlify variables or source control.

| Variable | Required | Description |
| --- | --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Yes | Cloudinary cloud name. |
| `CLOUDINARY_API_KEY` | Yes | Backend API key. |
| `CLOUDINARY_API_SECRET` | Yes | Backend secret; treat as a password. |
| `REFERENCE_PHOTO_MAX_BYTES` | No | Upload limit, default 5 MiB and capped at 10 MiB. |

No storage variable is needed in the frontend. Existing `VITE_API_URL` continues to point the frontend at Render. Cloudinary quotas and account capabilities vary by plan; check the account's current quota and authenticated-asset support before operational use. Provider failures are returned as a generic temporary-unavailable response and must not expose credentials or provider details.

## Validation and privacy

Uploads accept JPEG, PNG, or WebP according to the decoded image content. The API applies a multipart byte limit and image bounds. Sharp decodes, rotates by orientation, resizes within 1024 × 1024, and re-encodes as WebP, removing source EXIF metadata such as GPS. The original filename and client paths are discarded. The app performs no face recognition, embedding, or one-face validation in this phase.

Reference photos are biometric-related personal data. Before operational use, the organization must determine its lawful basis, provide employee notice or obtain consent where required, define retention and deletion rules, and honor applicable access/deletion requests. Limit access to authorized branch Operations Employees and service administrators.

## Replacement, deletion, and recovery

Replacement writes a new Cloudinary asset before changing MongoDB's current photo pointer. A MongoDB journal is stored before upload; stale journal entries are reconciled on later photo actions. The previous Cloudinary asset is queued for cleanup after the pointer changes. Cleanup checks whether an asset is still referenced before deletion. Failed cleanup IDs remain in `referencePhotoCleanupPublicIds` and are retried on later photo operations; this phase has no background worker. If a branch has no further photo activity, an administrator must review pending IDs or implement a separate cleanup job.

S3 fields are retained in the employee schema only for backward compatibility. `referencePhoto.key` and `referencePhotoCleanupKeys` are legacy S3 data and are never passed to Cloudinary. The workspace cannot inspect the deployed MongoDB or old S3 bucket. If deployed records contain S3 keys, photo actions (and employee deletion where it could orphan the photo) are blocked for those employees, and the UI labels them as legacy. Before deploying the provider change to such data, review and migrate each photo from the old provider with a verified mapping, or explicitly remove it using the old provider and an approved retention decision. Do not copy S3 keys into Cloudinary public IDs. No MongoDB schema migration is needed for employees without photos; production records with legacy keys require a reviewed migration plan.

## Verification boundary

Unit tests use a fake Cloudinary SDK and verify authenticated upload/deletion options, URL secrecy, and backend byte retrieval. The opt-in provider test checks that unsigned original and transformed delivery URLs are denied by a real Cloudinary account. It is skipped unless `CLOUDINARY_INTEGRATION_TEST=true` and all three credentials are set; running it uploads and deletes a temporary test asset. The real-account test was attempted from this workspace but could not resolve Cloudinary's API hostname, so live account privacy, quota, Render connectivity, and Netlify-to-Render deployment remain unverified. Before production use, set the Render environment values, run the provider integration test from a network that can reach Cloudinary, upload/retrieve/delete a test photo via the portal, and confirm the asset type is `authenticated` in the Cloudinary console. Remove obsolete S3 credentials and settings from Render after the migration is approved.
