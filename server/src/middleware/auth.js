import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_face_annotator_key_2026';

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

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded; // Contains id, email, name
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Session expired or invalid token. Please log in again.',
    });
  }
}
