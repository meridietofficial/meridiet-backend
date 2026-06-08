export const up = `
  ALTER TABLE appointments
    ADD COLUMN agora_channel_name    VARCHAR(100)                                    DEFAULT NULL      AFTER session_type,
    ADD COLUMN agora_resource_id     VARCHAR(255)                                    DEFAULT NULL      AFTER agora_channel_name,
    ADD COLUMN agora_recording_sid   VARCHAR(100)                                    DEFAULT NULL      AFTER agora_resource_id,
    ADD COLUMN agora_recording_uid   VARCHAR(20)                                     DEFAULT NULL      AFTER agora_recording_sid,
    ADD COLUMN video_call_status     ENUM('not_started','ongoing','ended') NOT NULL  DEFAULT 'not_started' AFTER agora_recording_uid,
    ADD COLUMN recording_url         TEXT                                            DEFAULT NULL      AFTER video_call_status,
    ADD COLUMN call_started_at       DATETIME                                        DEFAULT NULL      AFTER recording_url,
    ADD COLUMN call_ended_at         DATETIME                                        DEFAULT NULL      AFTER call_started_at,
    ADD COLUMN call_duration_seconds INT                                             DEFAULT NULL      AFTER call_ended_at;
`;

export const down = `
  ALTER TABLE appointments
    DROP COLUMN agora_channel_name,
    DROP COLUMN agora_resource_id,
    DROP COLUMN agora_recording_sid,
    DROP COLUMN agora_recording_uid,
    DROP COLUMN video_call_status,
    DROP COLUMN recording_url,
    DROP COLUMN call_started_at,
    DROP COLUMN call_ended_at,
    DROP COLUMN call_duration_seconds;
`;
