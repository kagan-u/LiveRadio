'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSocket } from '@/hooks/useSocket';
import Navbar from '@/components/Navbar';
import { useRouter } from 'next/navigation';

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface Track {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: string;
  videoId: string;
}

export default function BroadcastPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [broadcast, setBroadcast] = useState<any>(null);
  const [status, setStatus] = useState<'idle' | 'starting' | 'live' | 'ending'>('idle');
  const [error, setError] = useState('');
  const [streamKey, setStreamKey] = useState('');
  const [title, setTitle] = useState('My Radio Show');
  const [listenerCount, setListenerCount] = useState(0);

  // YouTube Player
  const playerRef = useRef<any>(null);
  const [playerReady, setPlayerReady] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const progressInterval = useRef<any>(null);

  // Search
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [searching, setSearching] = useState(false);

  // Queue
  const [queue, setQueue] = useState<Track[]>([]);

  // Audio Capture → Icecast
  const [isStreaming, setIsStreaming] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const { connected, updateMetadata, socket, joinBroadcast, leaveBroadcast } = useSocket();

  // Load YouTube IFrame API
  useEffect(() => {
    if (typeof window !== 'undefined' && !window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);

      window.onYouTubeIframeAPIReady = () => {
        initPlayer();
      };
    } else if (window.YT) {
      initPlayer();
    }
  }, []);

  function initPlayer() {
    const playerDiv = document.getElementById('youtube-player');
    if (!playerDiv) return;

    const player = new window.YT.Player('youtube-player', {
      height: '1',
      width: '1',
      playerVars: {
        autoplay: 0,
        controls: 0,
        disablekb: 1,
        fs: 0,
        iv_load_policy: 3,
        modestbranding: 1,
        rel: 0,
        showinfo: 0,
      },
      events: {
        onReady: () => {
          setPlayerReady(true);
          playerRef.current = player;
        },
        onStateChange: (e: any) => {
          if (e.data === window.YT.PlayerState.PLAYING) {
            setIsPlaying(true);
          } else if (e.data === window.YT.PlayerState.PAUSED) {
            setIsPlaying(false);
          } else if (e.data === window.YT.PlayerState.ENDED) {
            setIsPlaying(false);
            playNext();
          }
        },
      },
    });
  }

  // Progress tracker
  useEffect(() => {
    if (isPlaying && playerRef.current) {
      progressInterval.current = setInterval(() => {
        try {
          const p = playerRef.current.getCurrentTime();
          const d = playerRef.current.getDuration();
          setProgress(p);
          setDuration(d);
        } catch {}
      }, 500);
    }
    return () => clearInterval(progressInterval.current);
  }, [isPlaying]);

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

  // YouTube Search via Invidious
  const searchYouTube = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://vid.puffyan.us/api/v1/search?q=${encodeURIComponent(searchQuery)}&type=video&sort_by=relevance`);
      const data = await res.json();
      setSearchResults(data.slice(0, 15).map((v: any) => ({
        id: v.videoId,
        title: v.title,
        artist: v.author,
        thumbnail: v.videoThumbnails?.[0]?.url || '',
        duration: fmtDur(v.lengthSeconds),
        videoId: v.videoId,
      })));
    } catch {
      try {
        const res = await fetch(`https://invidious.fdn.fr/api/v1/search?q=${encodeURIComponent(searchQuery)}&type=video`);
        const data = await res.json();
        setSearchResults(data.slice(0, 15).map((v: any) => ({
          id: v.videoId, title: v.title, artist: v.author,
          thumbnail: v.videoThumbnails?.[0]?.url || '',
          duration: fmtDur(v.lengthSeconds), videoId: v.videoId,
        })));
      } catch { setSearchResults([]); }
    }
    setSearching(false);
  }, [searchQuery]);

  // Play a track
  const playTrack = useCallback((track: Track) => {
    if (!playerRef.current) return;
    setCurrentTrack(track);
    try {
      playerRef.current.loadVideoById(track.videoId);
      if (broadcast?.id) {
        updateMetadata(broadcast.id, track.artist, track.title);
      }
    } catch {}
  }, [broadcast?.id, updateMetadata]);

  const playNext = useCallback(() => {
    setQueue((prev) => {
      const next = prev[0];
      if (next) {
        playTrack(next);
        return prev.slice(1);
      }
      return prev;
    });
  }, [playTrack]);

  const addToQueue = useCallback((track: Track) => {
    setQueue((prev) => [...prev, track]);
  }, []);

  const removeFromQueue = useCallback((i: number) => {
    setQueue((prev) => prev.filter((_, idx) => idx !== i));
  }, []);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const startCapture = useCallback(async () => {
    if (!playerRef.current || !broadcast?.id || !socket) return;

    try {
      socket.emit('start_audio_stream', { broadcastId: broadcast.id });

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
          channelCount: 2,
        } as any,
      });

      stream.getVideoTracks().forEach(t => t.stop());

      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        setError('No audio captured. Make sure to check "Share tab audio" or "Share system audio".');
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      const audioStream = new MediaStream(audioTracks);
      mediaStreamRef.current = audioStream;

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

      recorder.onerror = () => setError('MediaRecorder error');

      recorder.start(1000);
      setIsStreaming(true);
      setError('');
    } catch (err: any) {
      if (err.name === 'NotAllowedError') {
        setError('Audio capture permission denied. Click "Share" and check audio sharing.');
      } else {
        setError('Audio capture failed: ' + err.message);
      }
    }
  }, [broadcast?.id, socket]);

  const stopCapture = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaStreamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();
    setIsStreaming(false);
    if (broadcast?.id && socket) {
      socket.emit('stop_audio_stream', { broadcastId: broadcast.id });
    }
  }, [broadcast?.id, socket]);

  // Broadcast lifecycle
  const startBroadcast = useCallback(async () => {
    if (!title.trim()) { setError('Title required'); return; }
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
      setCurrentTrack(null); setQueue([]);
    } catch (err: any) { setError(err.message); setStatus('live'); }
  }, [broadcast?.id, stopCapture]);

  if (!isAuthenticated || !user) return null;

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="min-h-screen bg-surface-0 noise-overlay">
      <Navbar />

      {/* Hidden YouTube Player */}
      <div id="youtube-player" className="fixed opacity-0 pointer-events-none" style={{ width: 1, height: 1 }} />

      <div className="pt-12 p-4 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-end gap-0.5">
              {[12, 18, 8, 15, 10].map((h, i) => (
                <div key={i} className={`freq-bar eq-bar ${status === 'live' && isPlaying ? '' : 'opacity-20'}`}
                  suppressHydrationWarning
                  style={{ '--eq-height': `${h}px`, '--eq-delay': `${i * 0.1}s`, height: '3px' } as any} />
              ))}
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-white/60">DJ</span> <span className="text-accent">Panel</span>
              </h1>
              <p className="text-[10px] text-white/25 uppercase tracking-[0.15em]">{user.username}&apos;s studio</p>
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
              <h2 className="text-xl font-bold mb-1">Go On Air</h2>
              <p className="text-xs text-white/30 mb-6">Your music, your station</p>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="Show name..." className="w-full px-4 py-3 bg-surface-2 border border-white/5 rounded-xl text-sm text-white placeholder:text-white/20 mb-4 text-center" />
              {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
              <button onClick={startBroadcast} disabled={!title.trim() || status === 'starting'}
                className="btn-radio btn-radio-primary w-full py-3 text-sm font-bold disabled:opacity-30">
                {status === 'starting' ? 'STARTING...' : 'START BROADCAST'}
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* LEFT: Now Playing + Search */}
            <div className="lg:col-span-2 space-y-4">

              {/* Now Playing */}
              <div className="bg-surface-1 rounded-2xl border border-white/[0.04] overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="live-dot" />
                      <span className="text-[10px] text-accent font-bold uppercase tracking-widest">Now Playing</span>
                    </div>
                    {!isStreaming ? (
                      <button onClick={startCapture} className="px-3 py-1 bg-accent/10 border border-accent/20 text-accent text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-accent/20 transition-colors">
                        Go Live
                      </button>
                    ) : (
                      <button onClick={stopCapture} className="px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-red-500/20 transition-colors">
                        Stop Live
                      </button>
                    )}
                  </div>

                  {currentTrack ? (
                    <>
                      <div className="flex items-center gap-4">
                        <div className="w-20 h-20 rounded-xl bg-surface-3 overflow-hidden flex-shrink-0">
                          {currentTrack.thumbnail ? (
                            <img src={currentTrack.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-accent/30">
                                <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-white/30 truncate">{currentTrack.artist}</p>
                          <p className="text-lg font-bold truncate">{currentTrack.title}</p>
                          <p className="text-[10px] text-white/20 mt-1">{fmtTime(progress)} / {fmtTime(duration)}</p>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="mt-3 h-1 bg-surface-3 rounded-full overflow-hidden cursor-pointer"
                        onClick={(e) => {
                          if (!playerRef.current) return;
                          const rect = e.currentTarget.getBoundingClientRect();
                          const pct = (e.clientX - rect.left) / rect.width;
                          playerRef.current.seekTo(pct * duration, true);
                        }}>
                        <div className="h-full bg-accent transition-all"
                          style={{ width: `${duration > 0 ? (progress / duration) * 100 : 0}%` }} />
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-white/10 mx-auto mb-2">
                        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                      </svg>
                      <p className="text-xs text-white/20">Search and play a track to start</p>
                    </div>
                  )}
                </div>

                {/* Controls */}
                <div className="px-5 pb-4 border-t border-white/[0.03] pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => playerRef.current?.playVideo()}
                        className="w-10 h-10 rounded-full bg-accent hover:bg-accent-hover flex items-center justify-center transition-all shadow-glow-sm">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      </button>
                      <button onClick={() => playerRef.current?.pauseVideo()}
                        className="w-8 h-8 rounded-full bg-surface-3 hover:bg-surface-4 flex items-center justify-center transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white/50"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                      </button>
                      <button onClick={playNext}
                        className="w-8 h-8 rounded-full bg-surface-3 hover:bg-surface-4 flex items-center justify-center transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white/50"><polygon points="5 4 15 12 5 20 5 4" /><line x1="19" y1="5" x2="19" y2="19" stroke="white/50" strokeWidth="2" /></svg>
                      </button>
                    </div>

                    <div className="flex items-center gap-2">
                      {isStreaming && (
                        <span className="flex items-center gap-1.5 px-2 py-1 bg-red-500/10 border border-red-500/20 rounded-lg text-[9px] text-red-400 font-bold uppercase tracking-wider">
                          <div className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse" />
                          BROADCASTING
                        </span>
                      )}
                      <span className="text-[10px] text-white/20">{listenerCount} listening</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* YouTube Search */}
              <div className="bg-surface-1 rounded-2xl border border-white/[0.04] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
                  </svg>
                  <span className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Search YouTube</span>
                </div>
                <div className="flex gap-2">
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchYouTube()}
                    placeholder="Search songs, artists..."
                    className="flex-1 px-3 py-2.5 bg-surface-2 border border-white/5 rounded-xl text-sm text-white placeholder:text-white/20" />
                  <button onClick={searchYouTube} disabled={searching}
                    className="btn-radio btn-radio-primary px-4 py-2.5 text-xs font-bold">
                    {searching ? '...' : 'SEARCH'}
                  </button>
                </div>

                {searchResults.length > 0 && (
                  <div className="mt-3 space-y-1 max-h-80 overflow-y-auto">
                    {searchResults.map((track) => (
                      <div key={track.id}
                        className="track-item flex items-center gap-3 p-2 rounded-lg cursor-pointer group"
                        onClick={() => playTrack(track)}>
                        <div className="w-12 h-8 rounded bg-surface-3 overflow-hidden flex-shrink-0">
                          {track.thumbnail ? (
                            <img src={track.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[8px] text-white/20">YT</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate text-white/70 group-hover:text-white transition-colors">{track.title}</p>
                          <p className="text-[10px] text-white/25 truncate">{track.artist}</p>
                        </div>
                        <span className="text-[10px] text-white/15">{track.duration}</span>
                        <button onClick={(e) => { e.stopPropagation(); addToQueue(track); }}
                          className="w-6 h-6 rounded bg-accent/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-accent/20">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Broadcast Info */}
              <div className="bg-surface-1 rounded-2xl border border-white/[0.04] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] text-white/30 uppercase tracking-widest mb-1">Stream Key</p>
                    <p className="text-[11px] font-mono text-white/50">{streamKey}</p>
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(streamKey)}
                    className="btn-radio btn-radio-ghost px-3 py-1.5 text-[10px] font-bold">COPY</button>
                </div>
                <button onClick={endBroadcast}
                  className="w-full mt-4 py-2.5 bg-surface-2 hover:bg-red-500/10 border border-white/5 hover:border-red-500/20 text-xs text-white/40 hover:text-red-400 rounded-xl font-semibold transition-all">
                  END BROADCAST
                </button>
              </div>
            </div>

            {/* RIGHT: Queue */}
            <div className="space-y-4">
              <div className="bg-surface-1 rounded-2xl border border-white/[0.04] overflow-hidden">
                <div className="px-4 py-3 border-b border-white/[0.03] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent">
                      <path d="M12 5v14M5 12h14" />
                    </svg>
                    <span className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Queue</span>
                  </div>
                  <span className="text-[10px] text-white/20">{queue.length} tracks</span>
                </div>

                {queue.length === 0 ? (
                  <div className="p-8 text-center">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-white/10 mx-auto mb-2">
                      <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                    </svg>
                    <p className="text-[11px] text-white/15">Queue empty</p>
                    <p className="text-[10px] text-white/10 mt-1">Search and add tracks</p>
                  </div>
                ) : (
                  <div className="max-h-[500px] overflow-y-auto">
                    {queue.map((item, i) => (
                      <div key={`${item.id}-${i}`} className="track-item flex items-center gap-3 px-4 py-2.5">
                        <span className="text-[10px] text-white/15 w-4 text-right">{i + 1}</span>
                        <div className="w-10 h-7 rounded bg-surface-3 overflow-hidden flex-shrink-0">
                          {item.thumbnail ? <img src={item.thumbnail} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-medium truncate text-white/60">{item.title}</p>
                          <p className="text-[9px] text-white/20 truncate">{item.artist}</p>
                        </div>
                        <span className="text-[9px] text-white/15">{item.duration}</span>
                        <button onClick={() => removeFromQueue(i)}
                          className="w-5 h-5 rounded flex items-center justify-center hover:bg-red-500/10 text-white/10 hover:text-red-400 transition-colors">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {queue.length > 0 && (
                  <div className="px-4 py-2 border-t border-white/[0.03]">
                    <button onClick={playNext}
                      className="btn-radio btn-radio-primary w-full py-2 text-[11px] font-bold">PLAY NEXT</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function fmtDur(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
