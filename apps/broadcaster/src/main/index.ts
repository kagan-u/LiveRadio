import { app, BrowserWindow, ipcMain, desktopCapturer, systemPreferences } from 'electron';
import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';

let mainWindow: BrowserWindow | null = null;
let ffmpegProcess: ChildProcess | null = null;
let isStreaming = false;

interface StreamConfig {
  streamKey: string;
  serverUrl: string;
  mountPoint: string;
  bitrate: number;
  audioDevice?: string;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 720,
    resizable: false,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0a0a0a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  mainWindow.on('closed', () => {
    stopStreaming();
    mainWindow = null;
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  stopStreaming();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Get available audio devices
ipcMain.handle('get-audio-devices', async () => {
  if (process.platform === 'darwin') {
    // macOS: Use system_profiler to list audio devices
    return getMacAudioDevices();
  } else if (process.platform === 'win32') {
    return getWindowsAudioDevices();
  } else {
    return getLinuxAudioDevices();
  }
});

async function getMacAudioDevices(): Promise<{ id: string; name: string; type: string }[]> {
  const devices = [
    { id: 'system', name: 'System Audio (requires BlackHole)', type: 'loopback' },
  ];

  try {
    const { execSync } = await import('child_process');
    const output = execSync('system_profiler SPAudioDataType 2>/dev/null || true', { encoding: 'utf-8' });
    const lines = output.split('\n');
    for (const line of lines) {
      const match = line.match(/^\s+(.+):\s*$/);
      if (match && match[1] && !match[1].includes('Associated')) {
        devices.push({ id: match[1], name: match[1], type: 'input' });
      }
    }
  } catch {}

  return devices;
}

async function getWindowsAudioDevices(): Promise<{ id: string; name: string; type: string }[]> {
  return [
    { id: 'stereo-mix', name: 'Stereo Mix (system audio)', type: 'loopback' },
    { id: 'microphone', name: 'Microphone', type: 'input' },
  ];
}

async function getLinuxAudioDevices(): Promise<{ id: string; name: string; type: string }[]> {
  const devices = [
    { id: 'pulse', name: 'PulseAudio Default', type: 'loopback' },
    { id: 'alsa', name: 'ALSA Default', type: 'input' },
  ];

  try {
    const { execSync } = await import('child_process');
    const output = execSync('pactl list sources short 2>/dev/null || true', { encoding: 'utf-8' });
    const lines = output.split('\n').filter(Boolean);
    for (const line of lines) {
      const parts = line.split('\t');
      if (parts.length >= 2) {
        devices.push({ id: parts[1], name: parts[1], type: 'input' });
      }
    }
  } catch {}

  return devices;
}

// Start streaming
ipcMain.handle('start-stream', async (event, config: StreamConfig) => {
  if (isStreaming) return { success: false, error: 'Already streaming' };

  const ffmpegPath = await findFFmpeg();
  if (!ffmpegPath) {
    return { success: false, error: 'FFmpeg not found. Install FFmpeg first.' };
  }

  const args = buildFFmpegArgs(config);

  try {
    ffmpegProcess = spawn(ffmpegPath, args, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stderrOutput = '';

    ffmpegProcess.stderr?.on('data', (data: Buffer) => {
      stderrOutput += data.toString();
      const progress = parseFFmpegProgress(data.toString());
      if (progress && mainWindow) {
        mainWindow.webContents.send('stream-progress', progress);
      }
    });

    ffmpegProcess.on('error', (err) => {
      isStreaming = false;
      if (mainWindow) {
        mainWindow.webContents.send('stream-error', err.message);
      }
    });

    ffmpegProcess.on('exit', (code) => {
      isStreaming = false;
      if (mainWindow) {
        mainWindow.webContents.send('stream-stopped', { code });
      }
    });

    isStreaming = true;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Stop streaming
ipcMain.handle('stop-stream', async () => {
  stopStreaming();
  return { success: true };
});

// Get stream status
ipcMain.handle('get-stream-status', () => {
  return {
    isStreaming,
    pid: ffmpegProcess?.pid,
  };
});

function stopStreaming() {
  if (ffmpegProcess) {
    ffmpegProcess.kill('SIGTERM');
    ffmpegProcess = null;
  }
  isStreaming = false;
}

function findFFmpeg(): Promise<string | null> {
  return new Promise((resolve) => {
    const { exec } = await import('child_process');
    exec('which ffmpeg 2>/dev/null || where ffmpeg 2>nul', (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve(null);
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

function buildFFmpegArgs(config: StreamConfig): string[] {
  const args: string[] = [];

  // Input
  if (process.platform === 'darwin') {
    args.push('-f', 'coreaudio');
    args.push('-i', config.audioDevice || ':BlackHole 2ch');
  } else if (process.platform === 'win32') {
    args.push('-f', 'dshow');
    args.push('-i', `audio=${config.audioDevice || 'Stereo Mix'}`);
  } else {
    args.push('-f', 'pulse');
    args.push('-i', config.audioDevice || 'default');
  }

  // Output encoding
  args.push('-f', 'mp3');
  args.push('-b:a', `${config.bitrate}k`);
  args.push('-content_type', 'audio/mpeg');

  // Low latency
  args.push('-flush_packets', '1');

  // Output
  args.push(`${config.serverUrl}${config.mountPoint}`);

  return args;
}

function parseFFmpegProgress(output: string): any {
  const timeMatch = output.match(/time=(\d{2}):(\d{2}):(\d{2})/);
  const bitrateMatch = output.match(/bitrate=\s*(\d+\.?\d*)kbits\/s/);

  if (timeMatch) {
    return {
      time: `${timeMatch[1]}:${timeMatch[2]}:${timeMatch[3]}`,
      bitrate: bitrateMatch ? parseFloat(bitrateMatch[1]) : 0,
    };
  }
  return null;
}
