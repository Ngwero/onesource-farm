import { createServiceClient } from '@/lib/supabase/server';

function bucketName(): string {
  const configured = process.env.SUPABASE_STORAGE_BUCKET?.trim();
  if (configured) return configured;
  if (process.env.VERCEL) return 'ememo-files';
  throw new Error(
    'SUPABASE_STORAGE_BUCKET is not configured. Set it to ememo-files and run migration 015 in Supabase.'
  );
}

export async function supabaseStoreFile(
  relativePath: string,
  buffer: Buffer,
  mimeType: string
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(bucketName()).upload(relativePath, buffer, {
    contentType: mimeType,
    upsert: true,
  });
  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }
}

export async function supabaseReadFile(relativePath: string): Promise<Buffer> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.storage.from(bucketName()).download(relativePath);
  if (error || !data) {
    throw new Error(`Storage read failed: ${error?.message ?? 'not found'}`);
  }
  return Buffer.from(await data.arrayBuffer());
}

export async function supabaseDeleteFile(relativePath: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase.storage.from(bucketName()).remove([relativePath]);
  if (error) {
    throw new Error(`Storage delete failed: ${error.message}`);
  }
}
