import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { User } from '../models/User.js';
import { AuditLog } from '../models/AuditLog.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';

export const userRouter = Router();

userRouter.use(authenticateToken);

const createUserSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  role: z.enum(['admin', 'responder', 'viewer']),
  phone: z.string().optional(),
  title: z.string().optional(),
  password: z.string().min(6).optional().default('StatusForge123!'),
});

const updateUserSchema = z.object({
  role: z.enum(['admin', 'responder', 'viewer']).optional(),
  phone: z.string().optional(),
  title: z.string().optional(),
  name: z.string().min(2).optional(),
});

// GET /api/v1/users - List users in current organization
userRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const users = await User.find({ organizationId: req.organizationId })
    .select('-passwordHash')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: users,
  });
});

// POST /api/v1/users - Admin adds a new user to the organization
userRouter.post('/', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const validated = createUserSchema.parse(req.body);

  const existing = await User.findOne({ email: validated.email.toLowerCase().trim() });
  if (existing) {
    res.status(409).json({
      success: false,
      error: {
        code: 'USER_EXISTS',
        message: `A user with email '${validated.email}' already exists.`,
      },
    });
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(validated.password, salt);

  const newUser = await User.create({
    organizationId: req.organizationId,
    name: validated.name.trim(),
    email: validated.email.toLowerCase().trim(),
    passwordHash,
    role: validated.role,
    phone: validated.phone?.trim() || '',
    title: validated.title?.trim() || '',
  });

  // Log to AuditLog
  await AuditLog.create({
    organizationId: req.organizationId,
    actorUserId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'CREATE_USER',
    resourceType: 'User',
    resourceId: newUser._id.toString(),
    ipAddress: req.ip || '127.0.0.1',
    metadata: {
      email: newUser.email,
      role: newUser.role,
      name: newUser.name,
    },
    timestamp: new Date(),
  });

  const userSafe = {
    _id: newUser._id,
    organizationId: newUser.organizationId,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    phone: newUser.phone,
    title: newUser.title,
    createdAt: newUser.createdAt,
    updatedAt: newUser.updatedAt,
  };

  res.status(201).json({
    success: true,
    data: userSafe,
  });
});

// PATCH /api/v1/users/:id - Change role or profile
userRouter.patch('/:id', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const validated = updateUserSchema.parse(req.body);
  const targetId = req.params.id;

  const targetUser = await User.findOne({ _id: targetId, organizationId: req.organizationId });
  if (!targetUser) {
    res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found in this organization.',
      },
    });
    return;
  }

  // Prevent demoting the last admin
  if (targetUser.role === 'admin' && validated.role && validated.role !== 'admin') {
    const adminCount = await User.countDocuments({
      organizationId: req.organizationId,
      role: 'admin',
    });
    if (adminCount <= 1) {
      res.status(400).json({
        success: false,
        error: {
          code: 'LAST_ADMIN_PROTECTED',
          message: 'Cannot demote the only administrator in this organization.',
        },
      });
      return;
    }
  }

  if (validated.role) targetUser.role = validated.role;
  if (validated.phone !== undefined) targetUser.phone = validated.phone;
  if (validated.title !== undefined) targetUser.title = validated.title;
  if (validated.name !== undefined) targetUser.name = validated.name;

  await targetUser.save();

  // Audit Log
  await AuditLog.create({
    organizationId: req.organizationId,
    actorUserId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'UPDATE_USER',
    resourceType: 'User',
    resourceId: targetUser._id.toString(),
    ipAddress: req.ip || '127.0.0.1',
    metadata: validated,
    timestamp: new Date(),
  });

  res.json({
    success: true,
    data: {
      _id: targetUser._id,
      organizationId: targetUser.organizationId,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      phone: targetUser.phone,
      title: targetUser.title,
      updatedAt: targetUser.updatedAt,
    },
  });
});

// DELETE /api/v1/users/:id - Admin deletes a user
userRouter.delete('/:id', requireRole('admin'), async (req: Request, res: Response): Promise<void> => {
  const targetId = req.params.id;

  const targetUser = await User.findOne({ _id: targetId, organizationId: req.organizationId });
  if (!targetUser) {
    res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'User not found in this organization.',
      },
    });
    return;
  }

  if (targetUser.role === 'admin') {
    const adminCount = await User.countDocuments({
      organizationId: req.organizationId,
      role: 'admin',
    });
    if (adminCount <= 1) {
      res.status(400).json({
        success: false,
        error: {
          code: 'LAST_ADMIN_PROTECTED',
          message: 'Cannot remove the last administrator in this organization.',
        },
      });
      return;
    }
  }

  await User.deleteOne({ _id: targetId, organizationId: req.organizationId });

  await AuditLog.create({
    organizationId: req.organizationId,
    actorUserId: req.user!._id,
    actorName: req.user!.name,
    actorRole: req.user!.role,
    action: 'DELETE_USER',
    resourceType: 'User',
    resourceId: targetId,
    ipAddress: req.ip || '127.0.0.1',
    metadata: { email: targetUser.email, name: targetUser.name },
    timestamp: new Date(),
  });

  res.json({
    success: true,
    message: 'User successfully removed.',
  });
});
