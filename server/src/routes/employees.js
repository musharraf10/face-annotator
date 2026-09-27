import express from 'express';
import { Employee } from '../models/Employee.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All employee routes are protected by user profile auth
router.use(protect);

/**
 * @route   GET /api/employees
 * @desc    Get all employees for the authenticated profile (initially empty for new users)
 */
router.get('/', async (req, res) => {
  try {
    const employees = await Employee.find({ userId: req.user.id })
      .select('id name createdAt updatedAt')
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      employees: employees.map((e) => ({ id: e.id, name: e.name })),
    });
  } catch (error) {
    console.error('Fetch employees error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employees.',
    });
  }
});

/**
 * @route   POST /api/employees
 * @desc    Add a new employee to user's profile
 */
router.post('/', async (req, res) => {
  try {
    const { id, name } = req.body;

    if (!id || !name) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID and Name are required.',
      });
    }

    const cleanId = id.trim().toUpperCase();
    const cleanName = name.trim();

    // Check if employee ID exists for this user profile
    const existing = await Employee.findOne({
      userId: req.user.id,
      id: cleanId,
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        error: `Employee ID "${cleanId}" already exists in your list.`,
      });
    }

    const employee = await Employee.create({
      userId: req.user.id,
      id: cleanId,
      name: cleanName,
    });

    res.status(201).json({
      success: true,
      employee: {
        id: employee.id,
        name: employee.name,
      },
    });
  } catch (error) {
    console.error('Add employee error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add employee.',
    });
  }
});

/**
 * @route   PUT /api/employees/:id
 * @desc    Update an employee
 */
router.put('/:id', async (req, res) => {
  try {
    const oldId = req.params.id.trim().toUpperCase();
    const { id: newId, name } = req.body;

    if (!newId || !name) {
      return res.status(400).json({
        success: false,
        error: 'Employee ID and Name are required.',
      });
    }

    const cleanNewId = newId.trim().toUpperCase();
    const cleanName = name.trim();

    const employee = await Employee.findOne({
      userId: req.user.id,
      id: oldId,
    });

    if (!employee) {
      return res.status(404).json({
        success: false,
        error: `Employee "${oldId}" not found in your list.`,
      });
    }

    if (cleanNewId !== oldId) {
      const duplicate = await Employee.findOne({
        userId: req.user.id,
        id: cleanNewId,
      });
      if (duplicate) {
        return res.status(400).json({
          success: false,
          error: `Employee ID "${cleanNewId}" is already in use.`,
        });
      }
    }

    employee.id = cleanNewId;
    employee.name = cleanName;
    await employee.save();

    res.json({
      success: true,
      employee: {
        id: employee.id,
        name: employee.name,
      },
    });
  } catch (error) {
    console.error('Update employee error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update employee.',
    });
  }
});

/**
 * @route   DELETE /api/employees/:id
 * @desc    Delete an employee
 */
router.delete('/:id', async (req, res) => {
  try {
    const targetId = req.params.id.trim().toUpperCase();

    const result = await Employee.findOneAndDelete({
      userId: req.user.id,
      id: targetId,
    });

    if (!result) {
      return res.status(404).json({
        success: false,
        error: `Employee "${targetId}" not found.`,
      });
    }

    res.json({
      success: true,
      message: `Employee "${targetId}" deleted successfully.`,
    });
  } catch (error) {
    console.error('Delete employee error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete employee.',
    });
  }
});

/**
 * @route   POST /api/employees/sync
 * @desc    Sync local employees from browser storage with MongoDB
 */
router.post('/sync', async (req, res) => {
  try {
    const { employees } = req.body;
    if (!Array.isArray(employees)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid employees array.',
      });
    }

    for (const emp of employees) {
      if (emp.id && emp.name) {
        await Employee.findOneAndUpdate(
          { userId: req.user.id, id: emp.id.trim().toUpperCase() },
          { name: emp.name.trim() },
          { upsert: true, new: true }
        );
      }
    }

    const currentEmployees = await Employee.find({ userId: req.user.id })
      .select('id name')
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      employees: currentEmployees.map((e) => ({ id: e.id, name: e.name })),
    });
  } catch (error) {
    console.error('Sync employees error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to sync employees.',
    });
  }
});

export default router;
