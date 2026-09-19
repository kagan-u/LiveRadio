import { spawn, ChildProcess } from 'child_process';

const ICECAST_HOST = process.env.ICECAST_HOST || 'localhost';
const ICECAST_PORT = parseInt(process.env.ICECAST_PORT || '8000');
const ICECAST_PASSWORD = process.env.ICECAST_SOURCE_PASSWORD || process.env.ICECAST_PASSWORD || 'hackme';

interface StreamSession {
  broadcastId: string;
  ffmpeg: ChildProcess;
  startedAt: Date;
}

const activeSessions = new Map<string, StreamSession>();

export function startAudioIngest(broadcastId: string): { success: boolean; error?: string } {
  if (activeSessions.has(broadcastId)) {
    return { success: false, error: 'Already streaming' };
  }

  const icecastUrl = `http://${ICECAST_HOST}:${ICECAST_PORT}/live`;

  const ffmpeg = spawn('ffmpeg', [
    '-i', 'pipe:0',
    '-f', 'mp3',
    '-codec:a', 'libmp3lame',
    '-b:a', '192k',
    '-ar', '44100',
    '-ac', '2',
    '-content_type', 'audio/mpeg',
    '-ice_name', `RadioLive-${broadcastId}`,
    '-ice_description', 'RadioLive Internet Radio',
    '-ice_genre', 'radio',
    icecastUrl,
  ], {
    env: {
      ...process.env,
      LIBSHOUT_ICECAST_SOURCE_PASSWORD: ICECAST_PASSWORD,
    },
  });

  ffmpeg.stderr?.on('data', (data: Buffer) => {
    const msg = data.toString();
    if (msg.includes('Error') || msg.includes('error')) {
      console.error(`[FFmpeg:${broadcastId}]`, msg.trim());
    }
  });

  ffmpeg.on('error', (err) => {
    console.error(`[FFmpeg:${broadcastId}] spawn error:`, err.message);
    activeSessions.delete(broadcastId);
  });

  ffmpeg.on('close', (code) => {
    console.log(`[FFmpeg:${broadcastId}] exited with code ${code}`);
    activeSessions.delete(broadcastId);
  });

  activeSessions.set(broadcastId, {
    broadcastId,
    ffmpeg,
    startedAt: new Date(),
  });

  console.log(`[AudioIngest] Started for broadcast ${broadcastId}`);
  return { success: true };
}

export function writeAudioChunk(broadcastId: string, chunk: Buffer): boolean {
  const session = activeSessions.get(broadcastId);
  if (!session || !session.ffmpeg.stdin || session.ffmpeg.stdin.destroyed) {
    return false;
  }
  session.ffmpeg.stdin.write(chunk);
  return true;
}

export function stopAudioIngest(broadcastId: string): boolean {
  const session = activeSessions.get(broadcastId);
  if (!session) return false;

  session.ffmpeg.stdin?.end();
  session.ffmpeg.kill('SIGTERM');

  setTimeout(() => {
    if (!session.ffmpeg.killed) {
      session.ffmpeg.kill('SIGKILL');
    }
  }, 5000);

  activeSessions.delete(broadcastId);
  console.log(`[AudioIngest] Stopped for broadcast ${broadcastId}`);
  return true;
}

export function getActiveIngests(): string[] {
  return Array.from(activeSessions.keys());
}
