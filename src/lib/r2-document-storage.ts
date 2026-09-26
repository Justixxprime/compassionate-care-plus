// Private R2 adapter for synthetic demo documents. The bucket is never public;
// callers must complete the existing document authorization checks first.
import "server-only";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getR2StorageConfig } from "@/lib/document-storage-config";

function client() {
  const config = getR2StorageConfig();
  if (!config) return null;
  return {
    config,
    s3: new S3Client({
      region: "auto",
      endpoint: config.endpoint,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    }),
  };
}

export function r2Enabled() {
  return getR2StorageConfig() !== null;
}

export async function putDemoDocument(key: string, bytes: Uint8Array, contentType: string) {
  const ready = client();
  if (!ready) return false;
  await ready.s3.send(new PutObjectCommand({
    Bucket: ready.config.bucketName, Key: key, Body: bytes, ContentType: contentType,
  }));
  return true;
}

export async function getDemoDocument(key: string): Promise<Uint8Array | null> {
  const ready = client();
  if (!ready) return null;
  const object = await ready.s3.send(new GetObjectCommand({ Bucket: ready.config.bucketName, Key: key }));
  return object.Body ? new Uint8Array(await object.Body.transformToByteArray()) : null;
}
