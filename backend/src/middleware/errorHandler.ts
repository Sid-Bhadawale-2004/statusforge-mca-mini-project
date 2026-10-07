import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import mongoose from 'mongoose';

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('[StatusForge Error Handler]:', err);

  // Handle Zod validation errors
  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data.',
        details: err.issues.map((i) => ({
          field: i.path.join('.'),
          message: i.message,
        })),
      },
    });
    return;
  }

  // Handle Mongoose unique constraint violation
  if (err.code === 11000) {
    const fields = Object.keys(err.keyPattern || {});
    res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: `Resource already exists with conflicting unique field(s): ${fields.join(', ')}.`,
      },
    });
    return;
  }

  // Handle Mongoose CastError (e.g., invalid ObjectId)
  if (err instanceof mongoose.Error.CastError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'INVALID_ID',
        message: `Invalid identifier format for field '${err.path}'.`,
      },
    });
    return;
  }

  // Standard fallback
  const statusCode = err.statusCode || err.status || 500;
  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred while processing the request.',
    },
  });
}
