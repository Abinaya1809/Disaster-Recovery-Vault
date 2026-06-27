import { PrismaClient, AuditAction } from '@prisma/client';

const prisma = new PrismaClient();

class AuditService {
  /**
   * Logs a user action into the database audit log.
   */
  public async logAction(
    userId: string | null,
    action: AuditAction,
    details: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId,
          action,
          details,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        },
      });
      console.log(`[Audit] Action: ${action} | User: ${userId || 'SYSTEM'} | Details: ${details}`);
    } catch (err) {
      console.error('[Audit] Failed to write audit log entry to database:', err);
    }
  }
}

export const audit = new AuditService();
export default audit;
