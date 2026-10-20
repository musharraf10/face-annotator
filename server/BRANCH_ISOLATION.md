# Branch isolation operations

## Provisioning

Set `MONGODB_URI` and a random `JWT_SECRET` (at least 32 characters) in the backend secret store. For the initial administrator, set `ADMIN_BOOTSTRAP_EMAIL`, `ADMIN_BOOTSTRAP_PASSWORD` (at least 14 characters), and optionally `ADMIN_BOOTSTRAP_NAME`. Startup creates that administrator or promotes an existing **unassigned** account with that email, replacing its password with the trusted environment value. Public registration for the reserved bootstrap email is rejected. Do not use an Operations Employee account for bootstrap. After setup, remove **both** bootstrap email and password to stop startup provisioning while retaining the administrator account; store the credentials securely for a controlled reset if needed. An assigned Operations Employee account cannot be promoted by bootstrap.

The backend accepts browser origins listed in `CORS_ORIGINS` as a comma-separated list. Set the exact Netlify production origin and any approved preview origins; local Vite development defaults to `http://localhost:5173`.

All `/api/admin` endpoints require a JWT for a database account whose role is `admin`. The minimal API supports branch creation, listing unassigned accounts, assigning or replacing the single Operations Employee account, listing unassigned employee records, and explicitly assigning selected legacy employee records. A newly created branch starts inactive and becomes active as part of the Operations Employee assignment transaction. The branch and user assignment is transactional; MongoDB must run as a replica set (MongoDB Atlas does). Public registration always creates an `unassigned` account, even if the request includes a role or branch ID.

Typical administrator sequence:

1. Create an unassigned account through the existing public registration page, or use an existing account.
2. `POST /api/admin/branches` with `{ "name": "...", "code": "..." }`.
3. `GET /api/admin/unassigned-accounts` to obtain an account ID.
4. `POST /api/admin/branches/:branchId/operations-account` with `{ "userId": "..." }`.
5. Review `GET /api/admin/legacy-employees` and use `POST /api/admin/legacy-employees/assign` with an explicit branch ID and selected Mongo employee document IDs. Assignments with destination branch ID collisions are rejected.
6. Review historical annotation data, if needed, through `GET /api/admin/legacy-sessions`. Assign explicitly selected session document IDs with `POST /api/admin/legacy-sessions/assign`; dates that already have a session in the destination branch are rejected.

After assignment, the Operations Employee should sign in again to refresh their branch state. Existing browser-only employees are never uploaded from local storage; re-register those records after reviewing them. Branch-assigned historical sessions load their saved annotations from MongoDB, but the original group-photo pixels are browser-only in the current architecture and may need to be re-uploaded.

After assignment, the Operations Employee should sign in again to refresh their branch claims. Existing browser-only employees are never uploaded from local storage; re-register those records after reviewing them. Branch-assigned historical sessions load their saved annotations from MongoDB, but the original group-photo pixels are browser-only in the current architecture and may need to be re-uploaded.

Branch status is controlled by `PATCH /api/admin/branches/:branchId/status` with `{ "active": false }` to deactivate or `{ "active": true }` to reactivate. Reactivation requires the branch's one Operations Employee account to remain valid.

Replacing the operator uses `PUT /api/admin/branches/:branchId/operations-account` with the new unassigned account's ID. The prior operator is returned to the unassigned state. Ordinary profile and employee requests cannot change account branch assignments.

## Database migration and rollback

The migration script is explicit and is **not** run by server startup. Never run it against production until a current backup has completed and been verified. Example backup procedure:

```sh
mongodump --uri "$MONGODB_URI" --archive=presence-before-branch-isolation.archive.gz --gzip
```

Run the staged, repeatable migration from the `server` directory after setting the intended `MONGODB_URI`:

```sh
npm run migrate:branch-isolation
```

It fills only missing branch fields with `null`, marks users lacking an explicit role as unassigned, creates unique single-branch account, employee, and session indexes, and removes the former user-scoped employee/session indexes after the new indexes are in place. It never assigns legacy records. If its preflight detects duplicate assigned employee IDs, multiple account assignments, or orphan branch references, it stops before changing records. Existing employee documents and their original `userId` values are preserved. Existing sessions are also left with `branchId: null` and are not available through the branch-scoped session API until an administrator explicitly reviews and assigns selected session records.

For rollback, stop the backend and restore the verified pre-migration archive into a separate database first to confirm it. Then restore the production database using the documented MongoDB restore procedure. Do not roll back by deleting employee or session documents. If only erroneous explicit assignments need reversal, use the `EmployeeAssignmentAudit` records to identify exactly which records to return to `branchId: null`, and perform that reviewed operation with the backend stopped and a fresh backup in place.

The application does not connect to or migrate production data automatically. Deployments must run the migration as a separately authorized release step before assigning branches or operators.
