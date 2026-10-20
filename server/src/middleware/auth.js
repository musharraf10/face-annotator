import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { Branch } from '../models/Branch.js';

function getJwtSecret() {
  return process.env.JWT_SECRET;
}

export function protect(req, res, next) {
  try {
    let token = null;

    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'Not authorized to access this resource. Please log in.',
      });
    }

    const secret = getJwtSecret();
    if (!secret) {
      return res.status(503).json({ success: false, error: 'Authentication is not configured.' });
    }
    const decoded = jwt.verify(token, secret);
    req.user = decoded; // Contains id, email, name
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Session expired or invalid token. Please log in again.',
    });
  }
}

export async function requireOperationsAccount(req, res, next) {
  try {
    const account = await User.findById(req.user.id);
    if (!account || account.role !== 'operations' || !account.branchId) {
      return res.status(403).json({ success: false, code: 'BRANCH_ASSIGNMENT_REQUIRED', error: 'This account is not assigned to an active branch.' });
    }
    const branch = await Branch.findOne({
      _id: account.branchId,
      active: true,
      operationsUserId: account._id,
    });
    if (!branch) {
      return res.status(403).json({ success: false, code: 'BRANCH_ASSIGNMENT_REQUIRED', error: 'This account is not assigned to an active branch.' });
    }
    req.account = account;
    req.branch = branch;
    req.branchId = branch._id;
    next();
  } catch (error) {
    next(error);
  }
}

export async function requireAdministrator(req, res, next) {
  try {
    const account = await User.findById(req.user.id);
    if (!account || account.role !== 'admin') {
      return res.status(403).json({ success: false, error: 'Administrator access required.' });
    }
    req.account = account;
    next();
  } catch (error) {
    next(error);
  }
}
