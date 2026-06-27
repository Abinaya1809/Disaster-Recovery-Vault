import { Request, Response, NextFunction } from 'express';
import { monitor } from '../services/monitoring.service';

export interface AppError extends Error {
  status?: number;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.status || 500;
  const message = err.message || 'Internal Server Error';

  // Monitor the error using CloudWatch / local monitor service
  monitor.logError(message, {
    stack: err.stack,
    path: req.path,
    method: req.method,
    statusCode,
  });

  console.error(`[Error] ${req.method} ${req.path} - Status ${statusCode}: ${message}`);
  if (err.stack && process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  res.status(statusCode).json({
    error: message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};
