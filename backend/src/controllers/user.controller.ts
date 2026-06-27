import { Response } from 'express';
import { PrismaClient, Role, AuditAction } from '@prisma/client';
import { AuthRequest } from '../middlewares/auth';
import { audit } from '../services/audit.service';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Helper to generate a secure random temporary password
const generateTempPassword = (): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let pass = '';
  for (let i = 0; i < 12; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
};

// GET /api/users - List users with filters, sorting, and pagination
export const getUsers = async (req: AuthRequest, res: Response) => {
  try {
    const { 
      search = '', 
      role, 
      status, 
      department, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      page = '1',
      limit = '10'
    } = req.query;

    const pageNumber = parseInt(page as string, 10);
    const limitNumber = parseInt(limit as string, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Build Prisma query filters
    const whereClause: any = {};

    // Search query matches first name, last name, email, or employee ID
    if (search) {
      whereClause.OR = [
        { firstName: { contains: search as string, mode: 'insensitive' } },
        { lastName: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { employeeId: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    if (role) {
      whereClause.role = role as Role;
    }

    if (status) {
      whereClause.status = status as string;
    }

    if (department) {
      whereClause.department = department as string;
    }

    // Get total count for pagination
    const totalUsers = await prisma.user.count({ where: whereClause });

    // Fetch users
    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        department: true,
        designation: true,
        role: true,
        status: true,
        storageLimit: true,
        profileImage: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        isActive: true
      },
      orderBy: {
        [sortBy as string]: sortOrder === 'desc' ? 'desc' : 'asc'
      },
      skip,
      take: limitNumber
    });

    return res.json({
      users,
      pagination: {
        total: totalUsers,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(totalUsers / limitNumber)
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to list users' });
  }
};

// GET /api/users/:id - Get detailed user profile & dashboard activity logs
export const getUserById = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        employeeId: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        department: true,
        designation: true,
        role: true,
        status: true,
        storageLimit: true,
        profileImage: true,
        lastLogin: true,
        createdAt: true,
        updatedAt: true,
        isActive: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Fetch user statistics
    const totalFilesCount = await prisma.file.count({
      where: { ownerId: id, status: 'ACTIVE' }
    });

    const recoveryRequestsCount = await prisma.recoveryRequest.count({
      where: { requestedById: id }
    });

    const spaceUsedSum = await prisma.file.aggregate({
      where: { ownerId: id, status: 'ACTIVE' },
      _sum: { size: true }
    });

    const recentAuditLogs = await prisma.auditLog.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    const filesUploaded = await prisma.file.findMany({
      where: { ownerId: id, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        size: true,
        mimeType: true,
        createdAt: true
      }
    });

    const recoveryRequests = await prisma.recoveryRequest.findMany({
      where: { requestedById: id },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    return res.json({
      user,
      stats: {
        filesCount: totalFilesCount,
        recoveryCount: recoveryRequestsCount,
        storageUsedBytes: spaceUsedSum._sum.size || 0,
        recentLogs: recentAuditLogs,
        filesList: filesUploaded,
        recoveryList: recoveryRequests
      }
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to fetch user details' });
  }
};

// POST /api/users - Create new employee account
export const createUser = async (req: AuthRequest, res: Response) => {
  const {
    firstName,
    lastName,
    employeeId,
    email,
    phone,
    department,
    designation,
    role,
    status = 'ACTIVE',
    storageLimit = 5120, // default 5GB in MB
    password,
    generatePassword = false
  } = req.body;

  const adminId = req.user?.id;

  if (!email || !adminId) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // 1. Email check
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({ error: 'An employee with this email already exists' });
    }

    // 2. Generate or validate Employee ID
    let finalEmpId = employeeId;
    if (!finalEmpId) {
      const userCount = await prisma.user.count();
      finalEmpId = `EMP-${10000 + userCount + 1}`;
    } else {
      const existingEmpId = await prisma.user.findUnique({ where: { employeeId: finalEmpId } });
      if (existingEmpId) {
        return res.status(400).json({ error: 'Duplicate Employee ID matches an existing record' });
      }
    }

    // 3. Password handling
    let rawPassword = password;
    if (generatePassword || !rawPassword) {
      rawPassword = generateTempPassword();
    } else {
      // Validate strength
      if (rawPassword.length < 8) {
        return res.status(400).json({ error: 'Password must be at least 8 characters long' });
      }
    }

    const hashed = await bcrypt.hash(rawPassword, 10);

    // 4. Create record
    const user = await prisma.user.create({
      data: {
        email,
        password: hashed,
        role: role === 'ADMIN' ? Role.ADMIN : Role.EMPLOYEE,
        employeeId: finalEmpId,
        firstName,
        lastName,
        phone,
        department,
        designation,
        status,
        isActive: status === 'ACTIVE',
        storageLimit: parseInt(storageLimit as string, 10) || 5120
      }
    });

    // 5. Audit Log
    await audit.logAction(
      adminId,
      'ADMIN_ACTION',
      `Admin created user account for employee ${user.email} (ID: ${user.employeeId})`,
      req.ip
    );

    return res.status(201).json({
      message: 'Employee account provisioned successfully',
      user: {
        id: user.id,
        email: user.email,
        employeeId: user.employeeId,
        role: user.role,
        status: user.status
      },
      temporaryPassword: generatePassword || !password ? rawPassword : null
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to create user' });
  }
};

// PUT /api/users/:id - Edit user profile
export const updateUser = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const {
    firstName,
    lastName,
    employeeId,
    phone,
    department,
    designation,
    role,
    status,
    storageLimit
  } = req.body;

  const adminId = req.user?.id;

  if (!adminId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Prevent administrators suspending/demoting themselves
    if (user.id === adminId) {
      if (status === 'INACTIVE' || role === 'EMPLOYEE') {
        return res.status(400).json({ error: 'Action denied. You cannot suspend or demote your own administrator profile.' });
      }
    }

    // Validate Employee ID if changed
    if (employeeId && employeeId !== user.employeeId) {
      const duplicateEmpId = await prisma.user.findUnique({ where: { employeeId } });
      if (duplicateEmpId) {
        return res.status(400).json({ error: 'Duplicate Employee ID matches an existing record' });
      }
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        firstName,
        lastName,
        employeeId,
        phone,
        department,
        designation,
        role: role ? (role === 'ADMIN' ? Role.ADMIN : Role.EMPLOYEE) : undefined,
        status,
        isActive: status ? (status === 'ACTIVE') : undefined,
        storageLimit: storageLimit ? parseInt(storageLimit as string, 10) : undefined
      }
    });

    await audit.logAction(
      adminId,
      'ADMIN_ACTION',
      `Admin updated profile properties for employee ${updated.email}`,
      req.ip
    );

    return res.json({
      message: 'Employee profile updated successfully',
      user: updated
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to update user' });
  }
};

// DELETE /api/users/:id - Delete employee record permanently
export const deleteUser = async (req: AuthRequest, res: Response) => {
  const { id } = req.params;
  const adminId = req.user?.id;

  if (!adminId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.id === adminId) {
      return res.status(400).json({ error: 'Action denied. You cannot delete your own profile.' });
    }

    await prisma.user.delete({ where: { id } });

    await audit.logAction(
      adminId,
      'ADMIN_ACTION',
      `Admin permanently deleted employee record ${user.email} (ID: ${user.employeeId})`,
      req.ip
    );

    return res.json({ message: 'User record purged from active registers successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to delete user' });
  }
};

// PATCH /api/users/status - Toggle status
export const changeUserStatus = async (req: AuthRequest, res: Response) => {
  const { userId, status } = req.body;
  const adminId = req.user?.id;

  if (!userId || !status || !adminId) {
    return res.status(400).json({ error: 'User ID and status are required' });
  }

  try {
    if (userId === adminId) {
      return res.status(400).json({ error: 'You cannot change your own status' });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        status,
        isActive: status === 'ACTIVE'
      }
    });

    await audit.logAction(
      adminId,
      'ADMIN_ACTION',
      `Admin toggled status of employee ${updated.email} to ${status}`,
      req.ip
    );

    return res.json({ message: 'User status updated successfully', user: updated });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to toggle status' });
  }
};

// PATCH /api/users/reset-password - Generate temporary password
export const resetPassword = async (req: AuthRequest, res: Response) => {
  const { userId } = req.body;
  const adminId = req.user?.id;

  if (!userId || !adminId) {
    return res.status(400).json({ error: 'User ID is required' });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const rawPassword = generateTempPassword();
    const hashed = await bcrypt.hash(rawPassword, 10);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashed }
    });

    await audit.logAction(
      adminId,
      'ADMIN_ACTION',
      `Admin generated temporary password reset for user ${user.email}`,
      req.ip
    );

    return res.json({
      message: 'Temporary password reset complete',
      temporaryPassword: rawPassword
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to reset password' });
  }
};
