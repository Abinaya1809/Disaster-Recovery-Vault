import { Request, Response } from 'express';
import { PrismaClient, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/env';
import { audit } from '../services/audit.service';
import { sns } from '../services/sns.service';

const prisma = new PrismaClient();

// Helper to generate access & refresh tokens
const generateTokens = (user: { id: string; email: string; role: Role }) => {
  const payload = { id: user.id, email: user.email, role: user.role };
  const accessToken = jwt.sign(payload, config.JWT_SECRET, { expiresIn: config.JWT_ACCESS_EXPIRY as any });
  const refreshToken = jwt.sign(payload, config.JWT_REFRESH_SECRET, { expiresIn: config.JWT_REFRESH_EXPIRY as any });
  return { accessToken, refreshToken };
};

export const register = async (req: Request, res: Response) => {
  return res.status(403).json({ error: 'Public registration is disabled. Please contact your system administrator.' });
};

export const login = async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive || user.status !== 'ACTIVE') {
      return res.status(401).json({ error: 'Invalid credentials or inactive user' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      // Log failed attempt
      await audit.logAction(null, 'LOGIN', `Failed login attempt for email: ${email}`, req.ip, req.headers['user-agent']);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tokens = generateTokens(user);

    // Update lastLogin timestamp in database
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    await audit.logAction(user.id, 'LOGIN', `User ${user.email} logged in successfully`, req.ip, req.headers['user-agent']);

    // Check for suspicious login: simulated if from foreign IP or specific user agents
    const userAgent = req.headers['user-agent'] || '';
    if (userAgent.includes('curl') || userAgent.includes('Postman')) {
      await sns.sendNotification(
        user.id,
        'SECURITY_ALERT',
        'Suspicious login detected',
        `A login request for your account ${user.email} was sent from a developer CLI tool (${userAgent}). IP: ${req.ip}`
      );
    }

    return res.json({
      user: { id: user.id, email: user.email, role: user.role },
      ...tokens,
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Login failed' });
  }
};

export const refresh = async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as {
      id: string;
      email: string;
      role: Role;
    };

    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User is inactive or not found' });
    }

    const tokens = generateTokens(user);
    return res.json(tokens);
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired refresh token' });
  }
};

export const logout = async (req: Request, res: Response) => {
  // Client discards JWT, we log it.
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (token) {
    try {
      const decoded = jwt.decode(token) as { id: string; email: string };
      if (decoded) {
        await audit.logAction(decoded.id, 'LOGOUT', `User ${decoded.email} logged out`, req.ip, req.headers['user-agent']);
      }
    } catch (err) {
      // Suppress decoder errors
    }
  }

  return res.json({ message: 'Logged out successfully' });
};

export const forgotPassword = async (req: Request, res: Response) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      // Simulate sending recovery token or email (Free Tier AWS SNS email notification)
      await sns.sendNotification(
        user.id,
        'SECURITY_ALERT',
        'Password Reset Requested',
        `A password reset has been requested for account ${user.email}. If you did not make this request, please change your password immediately.`
      );
    }
    // Return standard success to prevent email enumeration
    return res.json({ message: 'If the email exists, a password reset link has been dispatched.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Forgot password flow failed' });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const passwordVal = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: passwordVal },
    });

    await audit.logAction(user.id, 'ADMIN_ACTION', `Reset password for user: ${user.email}`, req.ip, req.headers['user-agent']);
    
    await sns.sendNotification(
      user.id,
      'SECURITY_ALERT',
      'Password Changed',
      `Your password has been successfully reset. If you didn't initiate this change, contact your system administrator.`
    );

    return res.json({ message: 'Password has been reset successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Password reset failed' });
  }
};

export const getNotifications = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(410).json({ error: 'Unauthorized' });

  try {
    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
    return res.json(notifications);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch notifications' });
  }
};

export const markNotificationsRead = async (req: any, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return res.json({ message: 'All notifications marked as read' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to mark notifications' });
  }
};

