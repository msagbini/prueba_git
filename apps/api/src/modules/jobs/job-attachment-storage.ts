import { randomUUID } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { UnsupportedMediaTypeException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import type { Request } from 'express';
import multer from 'multer';
import type { AuthenticatedRequest } from '../../common/types/authenticated-request';

/** Accepted job-attachment file types — photo evidence, not arbitrary file storage. */
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
/** Generous for a phone photo, small enough that a handful of uploads per job stays reasonable. */
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * Strips path separators and control characters from a user-supplied
 * filename before it ever touches the filesystem — the random UUID
 * prefix (see `filename` below) already guarantees uniqueness, this is
 * purely about not writing a path a client controls.
 * @param name the client-supplied original filename
 * @returns a filesystem-safe filename
 */
function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
}

/**
 * Builds the `multer` disk-storage config for job-attachment uploads,
 * rooted at `uploadsDir` with one subdirectory per organization —
 * matches the tenant isolation every other part of this app enforces,
 * even though these are plain files rather than database rows.
 * @param uploadsDir the configured base uploads directory (`UPLOADS_DIR`)
 * @returns multer options for `FileInterceptor('file', ...)`
 */
export function jobAttachmentMulterOptions(uploadsDir: string): MulterOptions {
  return {
    storage: multer.diskStorage({
      destination: (req, _file, callback) => {
        const organizationId = (req as AuthenticatedRequest).user?.org ?? 'unscoped';
        const dir = join(uploadsDir, organizationId);
        mkdirSync(dir, { recursive: true });
        callback(null, dir);
      },
      filename: (_req, file, callback) => {
        callback(null, `${randomUUID()}-${sanitizeFileName(file.originalname)}`);
      },
    }),
    limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES },
    fileFilter: (_req: Request, file, callback) => {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        callback(
          new UnsupportedMediaTypeException('Only JPEG, PNG, and WebP images are accepted.'),
          false,
        );
        return;
      }
      callback(null, true);
    },
  };
}
