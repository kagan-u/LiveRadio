'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSocket } from '@/hooks/useSocket';
import Navbar from '@/components/Navbar';
import { useRouter } from 'next/navigation';

export default function BroadcastPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [broadcast, setBroadcast] = useState<any>(null);
  const [title, setTitle] = useState('My Live Broadcast');
  const [metadata, setMetadata] = useState({ artist: '', title: '', album: '' });
  const [listenerCount, setListenerCount] = useState(0);
  const [status, setStatus] = useState<'idle' | 'starting' | 'live' | 'ending' | 'error'>('idle');
  const [error, setError] = useState('');
  const [streamKey, setStreamKey] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const { connected, updateMetadata, socket, joinBroadcast, leaveBroadcast } = useSocket();

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number>(0);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }
    if (user && !['broadcaster', 'admin'].includes(user.role)) {
      router.push('/');
      return;
    }

    api('/api/broadcasts/active', { token: getToken()! })
      .then((res) => {
        if (res.data) {
          setBroadcast(res.data);
          setStreamKey(res.data.stream_key);
          setStatus('live');
          if (res.data.id) joinBroadcast(res.data.id);
        }
      })
      .catch(() => {});
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!socket || !broadcast?.id) return;
    const handleListenerCount = (data: { count: number }) => setListenerCount(data.count);
    socket.on('listener_count', handleListenerCount);
    return () => { socket.off('listener_count', handleListenerCount); };
  }, [socket, broadcast?.id]);

  const monitorAudioLevel = useCallback((stream: MediaStream) => {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    audioContextRef.current = ctx;
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    const updateLevel = () => {
      analyser.getByteFrequencyData(dataArray);
      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setAudioLevel(avg / 255);
      animFrameRef.current = requestAnimationFrame(updateLevel);
    };
    updateLevel();
  }, []);

  const startBroadcast = useCallback(async () => {
    if (!title.trim()) {
      setError('Broadcast title is required');
      return;
    }

    setStatus('starting');
    setError('');

    try {
      const res = await api('/api/broadcasts', {
        method: 'POST',
        token: getToken()!,
        body: { title: title.trim() },
      });
      setBroadcast(res.data);
      setStreamKey(res.data.stream_key);
      setStatus('idle');
    } catch (err: any) {
      setError(err.message || 'Failed to start broadcast');
      setStatus('idle');
    }
  }, [title]);

  const startCapture = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: false,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
        } as any,
      });

      setMediaStream(stream);
      setIsRecording(true);
      monitorAudioLevel(stream);

      stream.getAudioTracks()[0].onended = () => {
        stopCapture();
      };
    } catch (err: any) {
      setError('Could not capture audio. Make sure to select a tab with audio.');
    }
  }, [monitorAudioLevel]);

  const stopCapture = useCallback(() => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((t) => t.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    cancelAnimationFrame(animFrameRef.current);
    setMediaStream(null);
    setIsRecording(false);
    setAudioLevel(0);
  }, [mediaStream]);

  const endBroadcast = useCallback(async () => {
    if (!broadcast?.id) return;
    setStatus('ending');
    stopCapture();

    try {
      await api(`/api/broadcasts/${broadcast.id}/end`, {
        method: 'POST',
        token: getToken()!,
      });
      leaveBroadcast(broadcast.id);
      setBroadcast(null);
      setStatus('idle');
      setListenerCount(0);
      setStreamKey('');
    } catch (err: any) {
      setError(err.message || 'Failed to end broadcast');
      setStatus('live');
    }
  }, [broadcast?.id, stopCapture]);

  const handleMetadataUpdate = useCallback(() => {
    if (!broadcast?.id || !metadata.artist || !metadata.title) return;
    updateMetadata(broadcast.id, metadata.artist, metadata.title, metadata.album);
  }, [broadcast?.id, metadata]);

  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-surface-0">
      <Navbar />

      <div className="pt-14 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-surface-1 rounded-2xl border border-white/5 overflow-hidden">
            {/* Header */}
            <div className="p-6 text-center border-b border-white/5">
              {(status as string) === 'live' || isRecording ? (
                <>
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <div className="live-dot" />
                    <span className="text-xs font-medium text-accent uppercase tracking-wider">Live</span>
                  </div>
                  <h2 className="text-xl font-semibold">{broadcast?.title}</h2>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-semibold mb-2">Web Broadcaster</h2>
                  <p className="text-xs text-muted">Capture browser tab audio and broadcast live</p>
                </>
              )}
            </div>

            <div className="p-6 space-y-4">
              {(status as string) === 'idle' || (status as string) === 'error' ? (
                <>
                  <div>
                    <label className="block text-xs text-muted mb-1.5">Broadcast Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-surface-2 border border-white/5 rounded-lg text-sm text-white"
                    />
                  </div>

                  {error && (
                    <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg">
                      <p className="text-xs text-red-400">{error}</p>
                    </div>
                  )}

                  <button
                    onClick={startBroadcast}
                    disabled={!title.trim()}
                    className="w-full py-3 bg-accent hover:bg-accent-hover disabled:opacity-30 text-white text-sm rounded-lg font-medium transition-all glow-red"
                  >
                    CREATE BROADCAST
                  </button>
                </>
              ) : (
                <>
                  {/* Audio Level */}
                  <div>
                    <label className="block text-xs text-muted mb-1.5">Audio Level</label>
                    <div className="h-2 bg-surface-2 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent transition-all duration-75"
                        style={{ width: `${audioLevel * 100}%` }}
                      />
                    </div>
                  </div>

                  {/* Capture Controls */}
                  {!isRecording ? (
                    <button
                      onClick={startCapture}
                      className="w-full py-3 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg font-medium transition-all glow-red"
                    >
                      START CAPTURING AUDIO
                    </button>
                  ) : (
                    <button
                      onClick={stopCapture}
                      className="w-full py-3 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-sm rounded-lg font-medium transition-all"
                    >
                      STOP CAPTURING
                    </button>
                  )}

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-surface-2">
                      <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Listeners</p>
                      <p className="text-xl font-bold">{listenerCount}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-surface-2">
                      <p className="text-[10px] text-muted uppercase tracking-wider mb-1">Bitrate</p>
                      <p className="text-xl font-bold">192 <span className="text-xs text-muted">kbps</span></p>
                    </div>
                  </div>

                  {/* Stream Key */}
                  <div>
                    <label className="block text-xs text-muted mb-1.5">Stream Key</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={streamKey}
                        readOnly
                        className="flex-1 px-3 py-2 bg-surface-0 border border-white/5 rounded-lg text-xs text-white/50 font-mono"
                      />
                      <button
                        onClick={() => navigator.clipboard.writeText(streamKey)}
                        className="px-3 py-2 bg-surface-2 hover:bg-surface-3 border border-white/5 rounded-lg text-xs text-white/70 transition-colors"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="space-y-2">
                    <label className="block text-xs text-muted mb-1.5">Now Playing</label>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Artist"
                        value={metadata.artist}
                        onChange={(e) => setMetadata({ ...metadata, artist: e.target.value })}
                        className="px-3 py-2 bg-surface-2 border border-white/5 rounded-lg text-sm text-white placeholder:text-muted/50"
                      />
                      <input
                        type="text"
                        placeholder="Song Title"
                        value={metadata.title}
                        onChange={(e) => setMetadata({ ...metadata, title: e.target.value })}
                        className="px-3 py-2 bg-surface-2 border border-white/5 rounded-lg text-sm text-white placeholder:text-muted/50"
                      />
                    </div>
                    <button
                      onClick={handleMetadataUpdate}
                      className="w-full py-2 bg-surface-2 hover:bg-surface-3 border border-white/5 text-xs text-white/70 rounded-lg transition-colors"
                    >
                      Update Metadata
                    </button>
                  </div>

                  {/* How to use */}
                  <div className="p-3 bg-surface-2 rounded-lg">
                    <p className="text-xs text-muted mb-2">How to broadcast:</p>
                    <ol className="text-[11px] text-white/60 space-y-1 list-decimal list-inside">
                      <li>Open your music source (Spotify, YouTube, etc.) in a browser tab</li>
                      <li>Click &quot;Start Capturing Audio&quot; above</li>
                      <li>Select the tab playing music in the browser prompt</li>
                      <li>Make sure &quot;Share tab audio&quot; is checked</li>
                      <li>Your audio is now being captured and streamed</li>
                    </ol>
                  </div>

                  {/* End Button */}
                  <button
                    onClick={endBroadcast}
                    disabled={(status as string) === 'ending'}
                    className="w-full py-3 bg-surface-2 hover:bg-surface-3 border border-white/5 text-sm text-white/70 rounded-lg font-medium transition-all"
                  >
                    {(status as string) === 'ending' ? 'ENDING...' : 'END BROADCAST'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
