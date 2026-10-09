import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { z } from 'zod';
import { Organization } from '../models/Organization.js';
import { User } from '../models/User.js';
import { Service } from '../models/Service.js';
import { OnCallSchedule } from '../models/OnCallSchedule.js';
import { EscalationPolicy } from '../models/EscalationPolicy.js';
import { authenticateToken } from '../middleware/auth.js';
import { notificationService } from '../services/notification.service.js';

export const authRouter = Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const signupSchema = z.object({
  orgName: z.string().min(2, 'Organization name must be at least 2 characters'),
  orgSlug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric and dashes only').optional(),
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  plan: z.enum(['free', 'pro']).optional().default('pro'),
});

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

const demoSwitchSchema = z.object({
  targetUserId: z.string().optional(),
  targetRole: z.enum(['admin', 'responder', 'viewer']).optional(),
});

function generateToken(user: any): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32 || /replace|change.?me|example/i.test(secret)) {
    throw new Error('JWT_SECRET must be configured with a unique value of at least 32 characters.');
  }
  return jwt.sign(
    {
      userId: user._id.toString(),
      organizationId: user.organizationId.toString(),
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn: '7d' }
  );
}

function notifySuccessfulSignIn(user: { email: string; name: string }, provider: 'password' | 'Google'): void {
  void notificationService
    .sendSignInNotice({ to: user.email, name: user.name, provider })
    .then((sent) => {
      if (!sent) console.error(`[StatusForge Auth] Sign-in email notification could not be sent to ${user.email}.`);
    })
    .catch((error) => {
      console.error(`[StatusForge Auth] Sign-in email notification failed for ${user.email}:`, error);
    });
}

// POST /api/v1/auth/signup
authRouter.post('/signup', async (req: Request, res: Response): Promise<void> => {
  const validated = signupSchema.parse(req.body);

  const slug = validated.orgSlug
    ? validated.orgSlug.toLowerCase().trim()
    : validated.orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

  const existingOrg = await Organization.findOne({ slug });
  if (existingOrg) {
    res.status(409).json({
      success: false,
      error: {
        code: 'SLUG_IN_USE',
        message: `An organization with slug '${slug}' already exists. Please choose a different slug.`,
      },
    });
    return;
  }

  const existingUser = await User.findOne({ email: validated.email.toLowerCase().trim() });
  if (existingUser) {
    res.status(409).json({
      success: false,
      error: {
        code: 'EMAIL_IN_USE',
        message: `A user with email '${validated.email}' is already registered.`,
      },
    });
    return;
  }

  // 1. Create Organization
  const organization = await Organization.create({
    name: validated.orgName.trim(),
    slug,
    plan: validated.plan,
    timezone: 'UTC',
  });

  // 2. Create Admin User
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(validated.password, salt);

  const adminUser = await User.create({
    organizationId: organization._id,
    name: validated.name.trim(),
    email: validated.email.toLowerCase().trim(),
    passwordHash,
    role: 'admin',
    title: 'Platform Admin',
  });

  // 3. Automatically seed starter Service for this organization
  const starterService = await Service.create({
    organizationId: organization._id,
    name: 'Primary API Gateway',
    currentStatus: 'operational',
    description: 'High-availability reverse proxy and public API routing layer',
    webhookSecret: crypto.randomBytes(16).toString('hex'),
    uptimePercentage: 100.0,
  });

  // 4. Automatically seed starter OnCallSchedule
  await OnCallSchedule.create({
    organizationId: organization._id,
    serviceId: starterService._id,
    name: 'Primary Gateway On-Call Rotation',
    rotationMembers: [adminUser._id],
    rotationType: 'weekly',
    startDate: new Date(),
    timezone: 'UTC',
  });

  // 5. Automatically seed starter EscalationPolicy
  await EscalationPolicy.create({
    organizationId: organization._id,
    serviceId: starterService._id,
    name: 'Standard Escalation Chain',
    steps: [
      {
        order: 1,
        timeoutMinutes: 5,
        notifyUserId: adminUser._id,
        channel: 'email',
      },
      {
        order: 2,
        timeoutMinutes: 15,
        notifyUserId: adminUser._id,
        channel: 'email',
      },
    ],
    repeatCount: 1,
  });

  const token = generateToken(adminUser);

  const userSafe = {
    _id: adminUser._id,
    organizationId: adminUser.organizationId,
    name: adminUser.name,
    email: adminUser.email,
    role: adminUser.role,
    title: adminUser.title,
    createdAt: adminUser.createdAt,
  };

  notifySuccessfulSignIn(adminUser, 'password');

  res.status(201).json({
    success: true,
    data: {
      token,
      user: userSafe,
      organization,
    },
  });
});

// POST /api/v1/auth/login
authRouter.post('/login', async (req: Request, res: Response): Promise<void> => {
  const validated = loginSchema.parse(req.body);

  const user = await User.findOne({ email: validated.email.toLowerCase().trim() });
  if (!user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
    });
    return;
  }

  if (!user.passwordHash) {
    res.status(401).json({
      success: false,
      error: {
        code: 'NO_PASSWORD',
        message: 'This account uses Google Sign-In. Please sign in with Google.',
      },
    });
    return;
  }

  const isValidPassword = await bcrypt.compare(validated.password, user.passwordHash);
  if (!isValidPassword) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password.',
      },
    });
    return;
  }

  const organization = await Organization.findById(user.organizationId);
  if (!organization) {
    res.status(404).json({
      success: false,
      error: {
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Associated organization was not found.',
      },
    });
    return;
  }

  const token = generateToken(user);
  notifySuccessfulSignIn(user, 'password');

  const userSafe = {
    _id: user._id,
    organizationId: user.organizationId,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    title: user.title,
    createdAt: user.createdAt,
  };

  res.json({
    success: true,
    data: {
      token,
      user: userSafe,
      organization,
    },
  });
});

// POST /api/v1/auth/accept-invitation
authRouter.post('/accept-invitation', async (req: Request, res: Response): Promise<void> => {
  const parsed = z.object({
    token: z.string().min(1),
    password: z.string().min(8, 'Password must be at least 8 characters'),
  }).safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'A valid invitation token and password of at least 8 characters are required.' },
    });
    return;
  }

  const tokenHash = crypto.createHash('sha256').update(parsed.data.token).digest('hex');
  const user = await User.findOne({
    invitationTokenHash: tokenHash,
    invitationExpiresAt: { $gt: new Date() },
  }).select('+invitationTokenHash +invitationExpiresAt');

  if (!user) {
    res.status(400).json({
      success: false,
      error: { code: 'INVITATION_INVALID_OR_EXPIRED', message: 'This invitation is invalid or has expired. Ask your administrator to send a new invitation.' },
    });
    return;
  }

  const organization = await Organization.findById(user.organizationId);
  if (!organization) {
    res.status(404).json({
      success: false,
      error: { code: 'ORGANIZATION_NOT_FOUND', message: 'The invited organization no longer exists.' },
    });
    return;
  }

  user.passwordHash = await bcrypt.hash(parsed.data.password, await bcrypt.genSalt(10));
  user.invitationTokenHash = undefined;
  user.invitationExpiresAt = undefined;
  await user.save();

  const passwordChangedEmailSent = await notificationService.sendPasswordChangedNotice({
    to: user.email,
    name: user.name,
  });
  if (!passwordChangedEmailSent) {
    console.error(`[StatusForge Auth] Invitation password confirmation email could not be sent to ${user.email}.`);
  }

  const token = generateToken(user);
  notifySuccessfulSignIn(user, 'password');
  res.json({
    success: true,
    data: {
      token,
      user: {
        _id: user._id,
        organizationId: user.organizationId,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone,
        title: user.title,
      },
      organization,
    },
  });
});

// GET /api/v1/auth/me
authRouter.get('/me', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const organization = await Organization.findById(user.organizationId);

  const userSafe = {
    _id: user._id,
    organizationId: user.organizationId,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    title: user.title,
    createdAt: user.createdAt,
  };

  res.json({
    success: true,
    data: {
      user: userSafe,
      organization,
    },
  });
});

// POST /api/v1/auth/demo-switch (Switch active user or role for testing)
authRouter.post('/demo-switch', authenticateToken, async (req: Request, res: Response): Promise<void> => {
  const validated = demoSwitchSchema.parse(req.body);
  const orgId = req.organizationId!;

  let targetUser: any = null;

  if (validated.targetUserId) {
    targetUser = await User.findOne({ _id: validated.targetUserId, organizationId: orgId });
  } else if (validated.targetRole) {
    targetUser = await User.findOne({ organizationId: orgId, role: validated.targetRole });
  }

  if (!targetUser) {
    res.status(404).json({
      success: false,
      error: {
        code: 'USER_NOT_FOUND',
        message: 'Target user for demo switch was not found in this organization.',
      },
    });
    return;
  }

  const organization = await Organization.findById(orgId);
  const token = generateToken(targetUser);

  const userSafe = {
    _id: targetUser._id,
    organizationId: targetUser.organizationId,
    name: targetUser.name,
    email: targetUser.email,
    role: targetUser.role,
    phone: targetUser.phone,
    title: targetUser.title,
    createdAt: targetUser.createdAt,
  };

  res.json({
    success: true,
    data: {
      token,
      user: userSafe,
      organization,
    },
  });
});

// POST /api/v1/auth/forgot-password
authRouter.post('/forgot-password', async (req: Request, res: Response): Promise<void> => {
  const { email } = req.body;
  if (!email || typeof email !== 'string') {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_EMAIL', message: 'A valid email address is required.' },
    });
    return;
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() });
  if (user) {
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = new Date(Date.now() + 3600000); // 1 hour validity
    await user.save();
    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/auth?resetToken=${encodeURIComponent(resetToken)}`;
    const emailSent = await notificationService.sendPasswordReset({
      to: user.email,
      name: user.name,
      resetUrl,
    });
    if (!emailSent) {
      console.error(`[StatusForge Auth] Password reset email could not be sent to ${user.email}.`);
    }
  }

  res.json({
    success: true,
    message: 'If that email is registered, password reset instructions have been sent.',
  });
});

// POST /api/v1/auth/reset-password
authRouter.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  const { token, newPassword } = req.body;
  if (!token || !newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_INPUT', message: 'Token and a password of at least 6 characters are required.' },
    });
    return;
  }

  const user = await User.findOne({
    resetPasswordToken: crypto.createHash('sha256').update(token).digest('hex'),
    resetPasswordExpires: { $gt: new Date() },
  });

  if (!user) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_OR_EXPIRED_TOKEN',
        message: 'The password reset token is invalid or has expired. Please request a new one.',
      },
    });
    return;
  }

  const salt = await bcrypt.genSalt(10);
  user.passwordHash = await bcrypt.hash(newPassword, salt);
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  const notificationSent = await notificationService.sendPasswordChangedNotice({
    to: user.email,
    name: user.name,
  });
  if (!notificationSent) {
    console.error(`[StatusForge Auth] Password-change email could not be sent to ${user.email}.`);
  }

  res.json({
    success: true,
    message: 'Your password has been successfully reset. You may now sign in.',
  });
});

// POST /api/v1/auth/google
authRouter.post('/google', async (req: Request, res: Response): Promise<void> => {
  const credential = req.body?.credential;
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    res.status(503).json({
      success: false,
      error: { code: 'GOOGLE_SIGN_IN_NOT_CONFIGURED', message: 'Google sign-in is not configured on this server.' },
    });
    return;
  }
  if (typeof credential !== 'string' || credential.length === 0) {
    res.status(400).json({
      success: false,
      error: { code: 'GOOGLE_AUTH_FAILED', message: 'A Google identity credential is required.' },
    });
    return;
  }

  let googlePayload;
  try {
    const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: clientId });
    googlePayload = ticket.getPayload();
  } catch (error) {
    console.error('[StatusForge Auth] Google identity-token verification failed:', error);
    res.status(401).json({
      success: false,
      error: { code: 'GOOGLE_AUTH_FAILED', message: 'Google could not verify this sign-in. Please try again.' },
    });
    return;
  }

  if (!googlePayload?.email || !googlePayload.email_verified || !googlePayload.sub) {
    res.status(401).json({
      success: false,
      error: { code: 'GOOGLE_EMAIL_UNVERIFIED', message: 'Use a Google account with a verified email address.' },
    });
    return;
  }

  const email = googlePayload.email.toLowerCase().trim();
  const name = googlePayload.name || googlePayload.given_name || email.split('@')[0];
  const googleId = googlePayload.sub;
  const avatarUrl = googlePayload.picture || '';

  // Check if user already exists
  let user = await User.findOne({ email });
  let organization: any = null;

  if (user) {
    if (user.googleId && user.googleId !== googleId) {
      res.status(401).json({
        success: false,
        error: { code: 'GOOGLE_ACCOUNT_MISMATCH', message: 'This account is linked to a different Google identity.' },
      });
      return;
    }
    user.googleId = googleId;
    if (avatarUrl) user.avatarUrl = avatarUrl;
    user.invitationTokenHash = undefined;
    user.invitationExpiresAt = undefined;
    await user.save();
    organization = await Organization.findById(user.organizationId);
  } else {
    // New user signing in with Google -> automatically create organization and admin user
    const slugBase = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') || 'team';
    const slug = `${slugBase}-${crypto.randomBytes(3).toString('hex')}`;

    organization = await Organization.create({
      name: `${name}'s Team`,
      slug,
      plan: 'pro',
      timezone: 'UTC',
    });

    user = await User.create({
      organizationId: organization._id,
      name,
      email,
      role: 'admin',
      googleId,
      avatarUrl,
      title: 'Platform Lead',
    });

    // Seed starter service, schedule, and policy for the new Google user
    const starterService = await Service.create({
      organizationId: organization._id,
      name: 'Primary API Gateway',
      currentStatus: 'operational',
      description: 'High-availability public API entry point',
      webhookSecret: crypto.randomBytes(16).toString('hex'),
      uptimePercentage: 100.0,
    });

    await OnCallSchedule.create({
      organizationId: organization._id,
      serviceId: starterService._id,
      name: 'Primary Gateway On-Call Rotation',
      rotationMembers: [user._id],
      rotationType: 'weekly',
      startDate: new Date(),
      timezone: 'UTC',
    });

    await EscalationPolicy.create({
      organizationId: organization._id,
      serviceId: starterService._id,
      name: 'Standard Escalation Chain',
      steps: [
        {
          order: 1,
          timeoutMinutes: 5,
          notifyUserId: user._id,
          channel: 'email',
        },
        {
          order: 2,
          timeoutMinutes: 15,
          notifyUserId: user._id,
          channel: 'email',
        },
      ],
      repeatCount: 1,
    });
  }

  const token = generateToken(user);
  notifySuccessfulSignIn(user, 'Google');
  const userSafe = {
    _id: user._id,
    organizationId: user.organizationId,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone,
    title: user.title,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt,
  };

  res.json({
    success: true,
    data: {
      token,
      user: userSafe,
      organization,
    },
  });
});
