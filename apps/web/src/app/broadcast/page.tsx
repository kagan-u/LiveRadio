'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSocket } from '@/hooks/useSocket';
import Navbar from '@/components/Navbar';
import { useRouter } from 'next/navigation';

export default function BroadcastPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [broadcast, setBroadcast] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'live' | 'ending'>('idle');
  const [error, setError] = useState('');
  const [streamKey, setStreamKey] = useState('');
  const [title, setTitle] = useState('My Radio Show');
  const [listenerCount, setListenerCount] = useState(0);

  // Audio Capture
  const [isStreaming, setIsStreaming] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const levelInterval = useRef<any>(null);

  const { connected, updateMetadata, socket, joinBroadcast, leaveBroadcast } = useSocket();

  // Auth
  useEffect(() => {
    if (!isAuthenticated) { router.push('/auth/login'); return; }
    if (user && !['broadcaster', 'admin'].includes(user.role)) { router.push('/'); return; }
    api('/api/broadcasts/active', { token: getToken()! })
      .then((res) => {
        if (res.data) {
          setBroadcast(res.data);
          setStreamKey(res.data.streamKey || res.data.stream_key);
          setStatus('live');
          if (res.data.id) joinBroadcast(res.data.id);
        }
      }).catch(() => {});
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (!socket || !broadcast?.id) return;
    const h = (d: { count: number }) => setListenerCount(d.count);
    socket.on('listener_count', h);
    return () => { socket.off('listener_count', h); };
  }, [socket, broadcast?.id]);

  // Start capturing tab audio
  const startCapture = useCallback(async () => {
    if (!broadcast?.id || !socket) return;

    try {
      socket.emit('start_audio_stream', { broadcastId: broadcast.id });

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
          logicalSurface: true,
          cursor: 'never',
        } as any,
        audio: {
          suppressLocalAudioPlayback: false,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
          channelCount: 2,
        } as any,
        preferCurrentTab: false,
        selfBrowserSurface: 'exclude',
        systemAudio: 'include',
        surfaceSwitching: 'include',
      } as any);

      // Video track'leri at, sadece ses lazım
      stream.getVideoTracks().forEach(t => t.stop());

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        setError('Ses yakalanamadi. "Ses paylasimi" kutusunu isaretle.');
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      stream.getAudioTracks().forEach(t => {
        t.onended = () => {
          setIsStreaming(false);
          socket.emit('stop_audio_stream', { broadcastId: broadcast.id });
        };
      });

      const audioStream = new MediaStream(audioTracks);
      mediaStreamRef.current = audioStream;

      // Audio level meter
      const ctx = new AudioContext();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(audioStream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      levelInterval.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(avg / 255);
      }, 100);

      // Record and send audio chunks
      const recorder = new MediaRecorder(audioStream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0 && socket.connected) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            if (base64) {
              socket.emit('audio_chunk', {
                broadcastId: broadcast.id,
                chunk: base64,
              });
            }
          };
          reader.readAsDataURL(e.data);
        }
      };

      recorder.start(1000);
      setIsStreaming(true);
      setError('');
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Izin reddedildi. "Ses paylasimi" kutusunu isaretle.');
      } else {
        setError('Ses yakalama basarisiz: ' + err.message);
      }
    }
  }, [broadcast?.id, socket]);

  const stopCapture = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();
    clearInterval(levelInterval.current);
    setAudioLevel(0);
    setIsStreaming(false);
    if (broadcast?.id && socket) {
      socket.emit('stop_audio_stream', { broadcastId: broadcast.id });
    }
  }, [broadcast?.id, socket]);

  // Broadcast lifecycle
  const startBroadcast = useCallback(async () => {
    if (!title.trim()) { setError('Baslik gerekli'); return; }
    setStatus('starting');
    setError('');
    try {
      const res = await api('/api/broadcasts', { method: 'POST', token: getToken()!, body: { title: title.trim() } });
      setBroadcast(res.data);
      setStreamKey(res.data.streamKey || res.data.stream_key);
      setStatus('live');
      joinBroadcast(res.data.id);
    } catch (err: any) { setError(err.message); setStatus('idle'); }
  }, [title]);

  const endBroadcast = useCallback(async () => {
    if (!broadcast?.id) return;
    stopCapture();
    setStatus('ending');
    try {
      await api(`/api/broadcasts/${broadcast.id}/end`, { method: 'POST', token: getToken()! });
      leaveBroadcast(broadcast.id);
      setBroadcast(null); setStatus('idle'); setListenerCount(0); setStreamKey('');
    } catch (err: any) { setError(err.message); setStatus('live'); }
  }, [broadcast?.id, stopCapture]);

  if (!isAuthenticated || !user) return null;

  // EQ bar heights from audio level
  const barH = (i: number) => Math.max(4, audioLevel * (10 + i * 6) * (isStreaming ? 1 : 0.15));

  return (
    <div className="min-h-screen bg-surface-0 noise-overlay">
      <Navbar />

      <div className="pt-12 p-4 max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="flex items-end gap-0.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="freq-bar" suppressHydrationWarning
                  style={{ height: `${barH(i)}px`, background: '#f97316', transition: 'height 0.1s' }} />
              ))}
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-white/60">DJ</span> <span className="text-accent">Panel</span>
              </h1>
              <p className="text-[10px] text-white/25 uppercase tracking-[0.15em]">{user.username}</p>
            </div>
          </div>
          {status === 'live' && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2 border border-accent/10">
              <div className="live-dot" />
              <span className="text-[10px] text-accent font-bold uppercase tracking-wider">Live</span>
              <span className="text-[10px] text-white/30">{listenerCount}</span>
            </div>
          )}
        </div>

        {status === 'idle' || status === 'starting' || (status as string) === 'ending' ? (
          <div className="max-w-md mx-auto mt-20">
            <div className="bg-surface-1 rounded-2xl border border-white/[0.04] p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-accent/10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
                  <circle cx="12" cy="12" r="2" />
                  <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-1">Yayina Basla</h2>
              <p className="text-xs text-white/30 mb-6">Muzigini dinleyicilere ulastir</p>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Yayin adi..." className="w-full px-4 py-3 bg-surface-2 border border-white/5 rounded-xl text-sm text-white placeholder:text-white/20 mb-4 text-center" />
              {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
              <button onClick={startBroadcast} disabled={!title.trim() || status === 'starting'}
                className="btn-radio btn-radio-primary w-full py-3 text-sm font-bold disabled:opacity-30">
                {status === 'starting' ? 'BASLATILIYOR...' : 'YAYINA BASLA'}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">

            {/* Live Status + Capture Control */}
            <div className="bg-surface-1 rounded-2xl border border-white/[0.04] p-6">
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-2 mb-3">
                  <div className="live-dot" />
                  <span className="text-xs text-accent font-bold uppercase tracking-widest">Yayinda</span>
                </div>
                <h2 className="text-xl font-bold">{broadcast?.title}</h2>
                <p className="text-[11px] text-white/25 mt-1">{listenerCount} dinleyici</p>
              </div>

              {/* Audio Level Visualizer */}
              <div className="flex items-end justify-center gap-1 h-16 mb-6">
                {Array.from({ length: 20 }).map((_, i) => {
                  const h = isStreaming
                    ? Math.max(4, audioLevel * (20 + Math.sin(i * 0.5) * 30) * (0.5 + Math.random() * 0.5))
                    : 4;
                  return (
                    <div key={i} suppressHydrationWarning
                      className="w-2 rounded-full transition-all duration-75"
                      style={{
                        height: `${h}px`,
                        background: isStreaming
                          ? `linear-gradient(to top, #f97316, ${audioLevel > 0.5 ? '#ef4444' : '#fb923c'})`
                          : 'rgba(255,255,255,0.05)',
                      }} />
                  );
                })}
              </div>

              {/* Capture Button */}
              <div className="text-center">
                {!isStreaming ? (
                  <button onClick={startCapture}
                    className="px-8 py-3 bg-accent hover:bg-accent-hover rounded-xl text-sm font-bold transition-all shadow-glow-sm">
                    Sesi Yakala (Sekme Sesini Paylas)
                  </button>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                      <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse" />
                      <span className="text-xs text-red-400 font-bold uppercase tracking-wider">Ses Canli Yayinda</span>
                    </div>
                    <button onClick={stopCapture}
                      className="px-6 py-2 bg-surface-2 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 text-xs text-white/40 hover:text-red-400 rounded-xl font-semibold transition-all">
                      Yayini Durdur
                    </button>
                  </div>
                )}
              </div>

              {error && <p className="text-xs text-red-400 text-center mt-3">{error}</p>}
            </div>

            {/* Instructions */}
            <div className="bg-surface-1 rounded-2xl border border-white/[0.04] p-4">
              <h3 className="text-[10px] text-accent uppercase tracking-widest font-semibold mb-3">Nasil calisir</h3>
              <ol className="space-y-2 text-[11px] text-white/30">
                <li className="flex items-start gap-2">
                  <span className="text-accent font-bold">1.</span>
                  <span>"Sesi Yakala" butonuna bas</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent font-bold">2.</span>
                  <span>Acanilan pencerede YouTube veya herhangi bir sekmeni sec, "Ses paylasimi" kutusunu isaretle</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-accent font-bold">3.</span>
                  <span>O sekmede muzigini oynat, sesi otomatik olarak dinleyicilere gider</span>
                </li>
              </ol>
            </div>

            {/* Stream Info */}
            <div className="bg-surface-1 rounded-2xl border border-white/[0.04] p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Stream Key</p>
                  <p className="text-[11px] font-mono text-white/50">{streamKey}</p>
                </div>
                <button onClick={() => navigator.clipboard.writeText(streamKey)}
                  className="btn-radio btn-radio-ghost px-3 py-1.5 text-[10px] font-bold">KOPYALA</button>
              </div>
              <div className="flex items-center gap-2 mb-3 text-[10px] text-white/20">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>
                Basladigindan beri: {broadcast?.started_at ? Math.floor((Date.now() - new Date(broadcast.started_at).getTime()) / 60000) : 0} dk
              </div>
              <button onClick={endBroadcast}
                className="w-full py-2.5 bg-surface-2 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 text-xs text-white/40 hover:text-red-400 rounded-xl font-semibold transition-all">
                YAYINI BITIR
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
