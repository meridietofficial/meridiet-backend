import { PutObjectCommand } from '@aws-sdk/client-s3';
import { s3Client, S3_BUCKET, S3_BASE_URL } from '../config/s3';

export const uploadBufferToS3 = async (
  buffer: Buffer,
  key: string,
  contentType: string,
): Promise<string> => {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  return `${S3_BASE_URL}/${key}`;
};
