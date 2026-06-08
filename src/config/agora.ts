import { RtcTokenBuilder, RtcRole } from 'agora-token';
import { env } from './env';

export const AGORA_RECORDING_UID = 99999; // fixed UID for the cloud-recording bot
export const CALL_MAX_SECONDS    = 1800;  // 30-minute hard limit via token expiry

// ── Token generation ─────────────────────────────────────────────────────────

export const generateRtcToken = (
  channelName: string,
  uid: number,
  expirySeconds = CALL_MAX_SECONDS,
): string => {
  const expiredTs = Math.floor(Date.now() / 1000) + expirySeconds;
  return RtcTokenBuilder.buildTokenWithUid(
    env.AGORA_APP_ID,
    env.AGORA_APP_CERTIFICATE,
    channelName,
    uid,
    RtcRole.PUBLISHER,
    expiredTs,
    expiredTs,
  );
};

// ── Cloud Recording REST helpers ──────────────────────────────────────────────

const apiBase = () =>
  `https://api.agora.io/v1/apps/${env.AGORA_APP_ID}/cloud_recording`;

const basicAuth = () =>
  `Basic ${Buffer.from(`${env.AGORA_CUSTOMER_ID}:${env.AGORA_CUSTOMER_SECRET}`).toString('base64')}`;

const agoraFetch = async <T>(url: string, method: string, body?: unknown): Promise<T> => {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', Authorization: basicAuth() },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Agora API error (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
};

export const agoraAcquire = async (channelName: string, uid: number): Promise<string> => {
  const data = await agoraFetch<{ resourceId: string }>(
    `${apiBase()}/acquire`,
    'POST',
    {
      cname: channelName,
      uid: String(uid),
      clientRequest: { resourceExpiredHour: 24, scene: 0 },
    },
  );
  return data.resourceId;
};

// AWS region name → Agora vendor region int
// https://docs.agora.io/en/cloud-recording/reference/rest-api/start#storageconfig
const S3_REGION_MAP: Record<string, number> = {
  'us-east-1': 0, 'us-east-2': 1, 'us-west-1': 2, 'us-west-2': 3,
  'ap-southeast-1': 4, 'ap-northeast-1': 5, 'ap-northeast-2': 6,
  'ap-south-1': 7,     // Mumbai — most likely for this project
  'eu-west-1': 8, 'eu-west-2': 9, 'eu-central-1': 10,
  'ca-central-1': 11, 'ap-southeast-2': 12, 'us-gov-west-1': 13,
};

export const agoraStartRecording = async (
  channelName: string,
  uid: number,
  resourceId: string,
  token: string,
): Promise<{ sid: string; resourceId: string }> => {
  return agoraFetch(
    `${apiBase()}/resourceid/${resourceId}/mode/mix/start`,
    'POST',
    {
      cname: channelName,
      uid: String(uid),
      clientRequest: {
        token,
        recordingConfig: {
          maxIdleTime: 30,       // stop recording 30s after channel is empty (handles user drop)
          maxRecordingHour: 1,   // Agora minimum; token expiry enforces the 30-min call limit
          streamTypes: 2,        // audio + video
          channelType: 0,        // communication mode
          videoStreamType: 0,    // high-quality stream
          transcodingConfig: {
            width: 640,
            height: 480,
            fps: 15,
            bitrate: 500,
            mixedVideoLayout: 1, // floating layout
          },
        },
        storageConfig: {
          vendor: 1,             // AWS S3
          region: S3_REGION_MAP[env.AWS_REGION] ?? 7,
          bucket: env.AWS_S3_BUCKET,
          accessKey: env.AWS_ACCESS_KEY_ID,
          secretKey: env.AWS_SECRET_ACCESS_KEY,
          fileNamePrefix: ['recordings'],
        },
      },
    },
  );
};

export interface AgoraStopResponse {
  serverResponse: {
    uploadingStatus?: string;
    fileList?: Array<{ filename: string; isPlayable: boolean; trackType: string }>;
  };
}

export const agoraStopRecording = async (
  channelName: string,
  uid: number,
  resourceId: string,
  sid: string,
): Promise<AgoraStopResponse['serverResponse']> => {
  const data = await agoraFetch<AgoraStopResponse>(
    `${apiBase()}/resourceid/${resourceId}/sid/${sid}/mode/mix/stop`,
    'POST',
    { cname: channelName, uid: String(uid), clientRequest: {} },
  );
  return data.serverResponse;
};
