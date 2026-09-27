import express from 'express';
import { Session } from '../models/Session.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

/**
 * @route   GET /api/sessions
 * @desc    Get all daily annotation sessions for user
 */
router.get('/', async (req, res) => {
  try {
    const sessions = await Session.find({ userId: req.user.id }).sort({ date: -1 });
    const sessionMap = {};
    sessions.forEach((s) => {
      sessionMap[s.date] = {
        date: s.date,
        placedEmployees: s.placedEmployees,
        annotations: s.annotations,
        imageMeta: s.imageMeta,
        updatedAt: s.updatedAt,
      };
    });
    res.json({ success: true, sessions: sessionMap });
  } catch (error) {
    console.error('Fetch sessions error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch sessions.' });
  }
});

/**
 * @route   POST /api/sessions/:date
 * @desc    Save or update a daily annotation session
 */
router.post('/:date', async (req, res) => {
  try {
    const { date } = req.params;
    const { placedEmployees, annotations, imageMeta } = req.body;

    const session = await Session.findOneAndUpdate(
      { userId: req.user.id, date },
      {
        placedEmployees: placedEmployees || [],
        annotations: annotations || [],
        imageMeta: imageMeta || { name: 'group-photo.jpg', hasImage: false },
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      session: {
        date: session.date,
        placedEmployees: session.placedEmployees,
        annotations: session.annotations,
        imageMeta: session.imageMeta,
        updatedAt: session.updatedAt,
      },
    });
  } catch (error) {
    console.error('Save session error:', error);
    res.status(500).json({ success: false, error: 'Failed to save session.' });
  }
});

export default router;
