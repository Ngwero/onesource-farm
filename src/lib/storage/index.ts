import fs from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import {
  supabaseDeleteFile,
  supabaseReadFile,
  supabaseStoreFile,
} from './supabaseStorage';

const DEFAULT_STORAGE_BUCKET = 'ememo-files';

export function usesSupabaseStorage(): boolean {
  return Boolean(resolveStorageBucket());
}

function resolveStorageBucket(): string | undefined {
  const configured = process.env.SUPABASE_STORAGE_BUCKET?.trim();
  if (configured) return configured;
  if (process.env.VERCEL) return DEFAULT_STORAGE_BUCKET;
  return undefined;
}

function assertStorageAvailable(): void {
  if (process.env.VERCEL && !resolveStorageBucket()) {
    throw new Error(
      'File storage is not configured on Vercel. Set SUPABASE_STORAGE_BUCKET=ememo-files and run migration 015_ememo_storage_bucket.sql in Supabase.'
    );
  }
}

/** Scoped under project root so Next.js build tracing stays limited to uploads/. */
function resolveUploadPath(...segments: string[]): string {
  return path.join(process.cwd(), 'uploads', ...segments);
}

function getUploadRoot(): string {
  const configured = process.env.UPLOAD_DIR;
  if (!configured) return resolveUploadPath();
  if (path.isAbsolute(configured)) return configured;
  const normalized = configured.replace(/^\.\//, '').replace(/^uploads\/?/, '');
  return normalized ? resolveUploadPath(normalized) : resolveUploadPath();
}

function getCategoryDir(category: StorageCategory): string {
  const envMap: Record<StorageCategory, string | undefined> = {
    attachments: process.env.ATTACHMENTS_DIR,
    signatures: process.env.SIGNATURES_DIR,
    logos: process.env.LOGOS_DIR,
  };
  const configured = envMap[category];
  if (configured && path.isAbsolute(configured)) return configured;
  if (configured) {
    const rel = configured.replace(/^\.\//, '').replace(/^uploads\/?/, '');
    return rel ? resolveUploadPath(rel) : resolveUploadPath(category);
  }
  return resolveUploadPath(category);
}

export type StorageCategory = 'attachments' | 'signatures' | 'logos';

const ALLOWED_ATTACHMENT_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
];

const ALLOWED_SIGNATURE_TYPES = ['image/png', 'image/jpeg'];

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_SIGNATURE_SIZE = 2 * 1024 * 1024; // 2MB

export interface StoredFile {
  fileName: string;
  filePath: string;
  relativePath: string;
  fileSize: number;
  mimeType: string;
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function storeFile(
  category: StorageCategory,
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  subfolder?: string
): Promise<StoredFile> {
  const allowed =
    category === 'signatures' ? ALLOWED_SIGNATURE_TYPES : ALLOWED_ATTACHMENT_TYPES;
  const maxSize = category === 'signatures' ? MAX_SIGNATURE_SIZE : MAX_ATTACHMENT_SIZE;

  if (!allowed.includes(mimeType)) {
    throw new Error(`File type ${mimeType} is not allowed`);
  }
  if (buffer.length > maxSize) {
    throw new Error(`File exceeds maximum size of ${maxSize / 1024 / 1024}MB`);
  }

  assertStorageAvailable();

  const ext = path.extname(originalName) || '';
  const fileName = `${randomUUID()}${ext}`;

  if (usesSupabaseStorage()) {
    const relativePath = [category, subfolder, fileName].filter(Boolean).join('/');
    await supabaseStoreFile(relativePath, buffer, mimeType);
    return {
      fileName: originalName,
      filePath: relativePath,
      relativePath,
      fileSize: buffer.length,
      mimeType,
    };
  }

  const uploadRoot = getUploadRoot();
  const baseDir = getCategoryDir(category);
  const targetDir = subfolder ? path.join(baseDir, subfolder) : baseDir;
  await ensureDir(targetDir);

  const filePath = path.join(targetDir, fileName);
  const relativePath = path.relative(uploadRoot, filePath);
  await fs.writeFile(filePath, buffer);

  return {
    fileName: originalName,
    filePath,
    relativePath,
    fileSize: buffer.length,
    mimeType,
  };
}

export async function readFile(relativePath: string): Promise<Buffer> {
  assertStorageAvailable();
  const normalized = relativePath.replace(/\\/g, '/');
  if (usesSupabaseStorage()) {
    return supabaseReadFile(normalized);
  }
  const fullPath = path.join(getUploadRoot(), normalized);
  return fs.readFile(fullPath);
}

/** Read file when present; returns null if missing (e.g. stale DB path). */
export async function readFileOptional(relativePath: string): Promise<Buffer | null> {
  try {
    return await readFile(relativePath);
  } catch {
    return null;
  }
}

export async function deleteFile(relativePath: string): Promise<void> {
  const normalized = relativePath.replace(/\\/g, '/');
  if (usesSupabaseStorage()) {
    try {
      await supabaseDeleteFile(normalized);
    } catch {
      // File may not exist
    }
    return;
  }
  const fullPath = path.join(getUploadRoot(), normalized);
  try {
    await fs.unlink(fullPath);
  } catch {
    // File may not exist
  }
}

// Cloud storage adapter interface for future migration
export interface CloudStorageAdapter {
  upload(buffer: Buffer, key: string, mimeType: string): Promise<string>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

export class LocalStorageAdapter implements CloudStorageAdapter {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath ?? getUploadRoot();
  }

  async upload(buffer: Buffer, key: string, _mimeType: string): Promise<string> {
    const filePath = path.join(this.basePath, key);
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, buffer);
    return key;
  }

  async download(key: string): Promise<Buffer> {
    return fs.readFile(path.join(this.basePath, key));
  }

  async delete(key: string): Promise<void> {
    await deleteFile(key);
  }
}
