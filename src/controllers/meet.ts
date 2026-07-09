import type { Request, Response } from 'express';
import { verifyMeetingToken } from '../utils/meetingToken';
import { findAppointmentById, setAgoraChannel } from '../models/Appointment';
import { generateRtcToken } from '../config/agora';
import { env } from '../config/env';
import { BRAND } from '../config/brand';

const errorPage = (message: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>MeriDiet — Meeting Error</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
           background: #111; color: #fff; display: flex; align-items: center;
           justify-content: center; height: 100vh; text-align: center; padding: 24px; }
    .logo { font-size: 22px; font-weight: 800; color: #1E8E3E; margin-bottom: 24px; }
    h2 { font-size: 20px; margin-bottom: 12px; }
    p  { font-size: 15px; color: #aaa; }
  </style>
</head>
<body>
  <div>
    <div class="logo">${BRAND.name}</div>
    <h2>Unable to join meeting</h2>
    <p>${message}</p>
  </div>
</body>
</html>`;

const meetingRoomPage = (opts: {
  appId: string;
  channel: string;
  token: string;
  uid: number;
  dietitianName: string;
  appointmentId: number;
  meetingToken: string;
  trackJoinUrl: string;
}) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>${BRAND.name} — Video Consultation</title>
  <script src="https://download.agora.io/sdk/release/AgoraRTC_N-4.22.0.js"></script>
  <style>
    *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f0f0f;
      color: #fff;
      height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      user-select: none;
    }

    /* ── Top bar ────────────────────────────────────────── */
    #topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 20px;
      background: rgba(0,0,0,0.6);
      backdrop-filter: blur(8px);
      z-index: 10;
      flex-shrink: 0;
    }
    .brand { font-size: 18px; font-weight: 800; color: #1E8E3E; letter-spacing: 0.3px; }
    #timer { font-size: 14px; color: #ccc; font-variant-numeric: tabular-nums; }

    /* ── Video stage ───────────────────────────────────── */
    #stage {
      flex: 1;
      position: relative;
      overflow: hidden;
      background: #1a1a1a;
    }

    /* Remote video — fills the stage */
    #remote-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    #remote-video video { width: 100% !important; height: 100% !important; object-fit: cover !important; }

    /* Waiting screen when no remote user yet */
    #waiting {
      position: absolute; inset: 0;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 16px; color: #888;
    }
    #waiting .avatar {
      width: 88px; height: 88px; border-radius: 50%;
      background: #1E8E3E22; border: 3px solid #1E8E3E;
      display: flex; align-items: center; justify-content: center;
      font-size: 36px;
    }
    #waiting p { font-size: 15px; }
    .pulse { animation: pulse 1.8s ease-in-out infinite; }
    @keyframes pulse { 0%,100%{opacity:.4} 50%{opacity:1} }

    /* Local video — PiP */
    #local-video {
      position: absolute;
      bottom: 88px; right: 16px;
      width: 120px; height: 160px;
      border-radius: 14px;
      overflow: hidden;
      border: 2px solid rgba(255,255,255,0.15);
      background: #222;
      cursor: grab;
      z-index: 5;
      box-shadow: 0 4px 24px rgba(0,0,0,0.6);
    }
    #local-video video { width: 100% !important; height: 100% !important; object-fit: cover !important; transform: scaleX(-1); }

    /* Camera off placeholder */
    .cam-off {
      width: 100%; height: 100%;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      color: #666; gap: 8px; font-size: 12px;
    }
    .cam-off svg { opacity: 0.5; }

    /* ── Controls ──────────────────────────────────────── */
    #controls {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 16px 20px 24px;
      background: rgba(0,0,0,0.7);
      backdrop-filter: blur(8px);
      flex-shrink: 0;
    }

    .ctrl-btn {
      width: 56px; height: 56px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px;
      transition: all .18s;
      flex-shrink: 0;
    }
    .ctrl-btn:hover { transform: scale(1.08); }
    .ctrl-btn.active   { background: #2a2a2a; color: #fff; }
    .ctrl-btn.muted    { background: #444; color: #fff; }
    .ctrl-btn.end-call { background: #e53935; color: #fff; width: 64px; height: 64px; font-size: 24px; }
    .ctrl-btn.end-call:hover { background: #c62828; }

    /* ── Loading overlay ───────────────────────────────── */
    #loader {
      position: fixed; inset: 0;
      background: #0f0f0f;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 20px; z-index: 100;
      transition: opacity .4s;
    }
    #loader.hidden { opacity: 0; pointer-events: none; }
    .spinner {
      width: 48px; height: 48px;
      border: 3px solid #1E8E3E33;
      border-top-color: #1E8E3E;
      border-radius: 50%;
      animation: spin .8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    #loader p { color: #888; font-size: 14px; }

    /* ── Toast ─────────────────────────────────────────── */
    #toast {
      position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%) translateY(20px);
      background: rgba(30,30,30,.95); color: #fff;
      padding: 10px 20px; border-radius: 24px; font-size: 13px;
      opacity: 0; transition: all .3s; pointer-events: none; z-index: 50;
      white-space: nowrap;
    }
    #toast.show { opacity: 1; transform: translateX(-50%) translateY(0); }

    @media (max-width: 480px) {
      #local-video { width: 90px; height: 120px; bottom: 80px; right: 12px; }
      .ctrl-btn { width: 48px; height: 48px; font-size: 20px; }
      .ctrl-btn.end-call { width: 56px; height: 56px; }
    }
  </style>
</head>
<body>

<!-- Loading overlay -->
<div id="loader">
  <div style="font-size:24px;font-weight:800;color:#1E8E3E;">${BRAND.name}</div>
  <div class="spinner"></div>
  <p id="loader-text">Joining consultation…</p>
</div>

<!-- Top bar -->
<div id="topbar">
  <div class="brand">${BRAND.name}</div>
  <div id="timer">00:00</div>
</div>

<!-- Video stage -->
<div id="stage">
  <!-- Waiting for other party -->
  <div id="waiting">
    <div class="avatar pulse">👩‍⚕️</div>
    <p>Waiting for the other participant to join…</p>
  </div>

  <!-- Remote video fills stage -->
  <div id="remote-video"></div>

  <!-- Local PiP -->
  <div id="local-video">
    <div class="cam-off" id="cam-off-local">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
        <circle cx="9" cy="7" r="4"></circle>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
        <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
      </svg>
      <span>Camera off</span>
    </div>
  </div>
</div>

<!-- Controls -->
<div id="controls">
  <button class="ctrl-btn active" id="btn-mic" title="Mute / Unmute">🎤</button>
  <button class="ctrl-btn end-call" id="btn-end" title="End call">📵</button>
  <button class="ctrl-btn active" id="btn-cam" title="Camera on / off">📷</button>
</div>

<!-- Toast -->
<div id="toast" id="toast"></div>

<script>
(async () => {
  const APP_ID  = ${JSON.stringify(opts.appId)};
  const CHANNEL = ${JSON.stringify(opts.channel)};
  const TOKEN   = ${JSON.stringify(opts.token)};
  const UID     = ${opts.uid};

  let micMuted = false;
  let camMuted = false;
  let localAudioTrack, localVideoTrack;
  let callStartTs = null;
  let timerInterval = null;
  let remoteUserCount = 0;

  const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

  function showToast(msg, duration = 2500) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), duration);
  }

  function setLoaderText(text) {
    document.getElementById('loader-text').textContent = text;
  }

  function hideLoader() {
    document.getElementById('loader').classList.add('hidden');
  }

  function startTimer() {
    callStartTs = Date.now();
    timerInterval = setInterval(() => {
      const s = Math.floor((Date.now() - callStartTs) / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      document.getElementById('timer').textContent = mm + ':' + ss;
    }, 1000);
  }

  // ── Remote user events ──────────────────────────────────────────
  client.on('user-published', async (user, mediaType) => {
    await client.subscribe(user, mediaType);

    if (mediaType === 'video') {
      document.getElementById('waiting').style.display = 'none';
      const remoteContainer = document.getElementById('remote-video');
      user.videoTrack.play(remoteContainer);
    }
    if (mediaType === 'audio') {
      user.audioTrack.play();
    }

    remoteUserCount++;
    if (callStartTs === null) startTimer();
  });

  client.on('user-unpublished', (user, mediaType) => {
    if (mediaType === 'video') {
      // show waiting screen if no remote video left
      const hasVideo = client.remoteUsers.some(u => u.videoTrack);
      if (!hasVideo) document.getElementById('waiting').style.display = 'flex';
    }
  });

  client.on('user-left', (user) => {
    remoteUserCount = Math.max(0, remoteUserCount - 1);
    if (remoteUserCount === 0) {
      document.getElementById('waiting').style.display = 'flex';
    }
    showToast('The other person has left the call.');
  });

  // ── Join ────────────────────────────────────────────────────────
  try {
    setLoaderText('Joining consultation…');
    await client.join(APP_ID, CHANNEL, TOKEN, UID);

    setLoaderText('Starting camera & microphone…');
    [localAudioTrack, localVideoTrack] = await AgoraRTC.createMicrophoneAndCameraTracks(
      { encoderConfig: 'music_standard' },
      { encoderConfig: '480p_1', facingMode: 'user' },
    );

    // Play local video in PiP
    document.getElementById('cam-off-local').style.display = 'none';
    localVideoTrack.play('local-video');

    await client.publish([localAudioTrack, localVideoTrack]);

    hideLoader();
    showToast('You have joined the consultation ✓');

    // Track that this participant joined (fire-and-forget)
    fetch(${JSON.stringify(opts.trackJoinUrl)}, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ t: ${JSON.stringify(opts.meetingToken)} }),
    }).catch(() => null);
  } catch (err) {
    console.error('Agora join error:', err);
    setLoaderText('Could not join. Please check camera/microphone permissions and reload.');
  }

  // ── Controls (addEventListener — no inline onclick needed) ───────
  document.getElementById('btn-mic').addEventListener('click', async () => {
    if (!localAudioTrack) return;
    micMuted = !micMuted;
    await localAudioTrack.setMuted(micMuted);
    const btn = document.getElementById('btn-mic');
    btn.textContent = micMuted ? '🔇' : '🎤';
    btn.className   = 'ctrl-btn ' + (micMuted ? 'muted' : 'active');
    showToast(micMuted ? 'Microphone muted' : 'Microphone on');
  });

  document.getElementById('btn-cam').addEventListener('click', async () => {
    if (!localVideoTrack) return;
    camMuted = !camMuted;
    await localVideoTrack.setMuted(camMuted);
    const btn = document.getElementById('btn-cam');
    btn.textContent = camMuted ? '🙈' : '📷';
    btn.className   = 'ctrl-btn ' + (camMuted ? 'muted' : 'active');
    document.getElementById('cam-off-local').style.display = camMuted ? 'flex' : 'none';
    showToast(camMuted ? 'Camera off' : 'Camera on');
  });

  document.getElementById('btn-end').addEventListener('click', async () => {
    if (timerInterval) clearInterval(timerInterval);
    try {
      if (localAudioTrack) { localAudioTrack.stop(); localAudioTrack.close(); }
      if (localVideoTrack) { localVideoTrack.stop(); localVideoTrack.close(); }
      await client.leave();
    } catch (_) {}
    document.body.innerHTML = \`
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                  height:100dvh;gap:16px;text-align:center;padding:24px;background:#0f0f0f;">
        <div style="font-size:48px;">✅</div>
        <div style="font-size:24px;font-weight:800;color:#1E8E3E;">${BRAND.name}</div>
        <p style="font-size:16px;color:#ccc;">Your consultation has ended.</p>
        <p style="font-size:13px;color:#666;">You may close this tab.</p>
      </div>\`;
  });

  // Drag PiP
  const pip = document.getElementById('local-video');
  let dragging = false, ox = 0, oy = 0;
  pip.addEventListener('pointerdown', e => { dragging = true; ox = e.clientX - pip.offsetLeft; oy = e.clientY - pip.offsetTop; pip.setPointerCapture(e.pointerId); pip.style.cursor='grabbing'; });
  pip.addEventListener('pointermove', e => { if (!dragging) return; pip.style.left = (e.clientX - ox) + 'px'; pip.style.top = (e.clientY - oy) + 'px'; pip.style.right = 'auto'; pip.style.bottom = 'auto'; });
  pip.addEventListener('pointerup',   () => { dragging = false; pip.style.cursor = 'grab'; });
})();
</script>
</body>
</html>`;

// GET /meet/:appointmentId?t=<meetingToken>
export const meetingPage = async (req: Request, res: Response): Promise<void> => {
  const appointmentId = Number(req.params.appointmentId);
  const { t } = req.query as { t?: string };

  if (!t) {
    res.status(400).send(errorPage('Meeting link is missing a join token.'));
    return;
  }

  const payload = verifyMeetingToken(t);
  if (!payload || payload.appointmentId !== appointmentId) {
    res.status(401).send(errorPage('This meeting link is invalid or has expired.'));
    return;
  }

  const appointment = await findAppointmentById(appointmentId);
  if (!appointment) {
    res.status(404).send(errorPage('Appointment not found.'));
    return;
  }
  if (appointment.session_type !== 'video_call') {
    res.status(400).send(errorPage('This appointment is not a video call.'));
    return;
  }
  if (appointment.status === 'cancelled') {
    res.status(400).send(errorPage('This appointment has been cancelled.'));
    return;
  }
  if (appointment.status === 'pending') {
    res.status(400).send(errorPage('This appointment is awaiting confirmation. Please wait for your dietitian to confirm.'));
    return;
  }
  if (appointment.status === 'completed' || appointment.video_call_status === 'ended') {
    res.status(400).send(errorPage('This consultation has already ended.'));
    return;
  }

  const channelName = appointment.agora_channel_name || `meridiet_${appointmentId}`;

  // Persist the channel name so the dietitian's joinCall uses the same channel
  if (!appointment.agora_channel_name) {
    await setAgoraChannel(appointmentId, channelName).catch(() => null);
  }

  // Generate a fresh RTC token valid for 2 hours
  const rtcToken = generateRtcToken(channelName, payload.uid, 7200);

  // Fetch dietitian name for the waiting screen
  const { findDietitianById } = await import('../models/Dietitian');
  const dietitian = await findDietitianById(appointment.dietitian_id);
  const dietitianName = dietitian?.full_name ?? 'Your Dietitian';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(meetingRoomPage({
    appId: env.AGORA_APP_ID,
    channel: channelName,
    token: rtcToken,
    uid: payload.uid,
    dietitianName,
    appointmentId,
    meetingToken: t,
    trackJoinUrl: `${env.APP_BASE_URL}/api/v1/appointments/${appointmentId}/track-join`,
  }));
};
