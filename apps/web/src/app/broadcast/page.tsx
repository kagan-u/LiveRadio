'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSocket } from '@/hooks/useSocket';
import Navbar from '@/components/Navbar';
import { useRouter } from 'next/navigation';

interface QueueItem {
  id: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: string;
  videoId: string;
  addedBy: string;
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

  // DJ Panel State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [currentTrack, setCurrentTrack] = useState<QueueItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(75);
  const [nowPlayingMeta, setNowPlayingMeta] = useState({ artist: '', title: '', album: '' });

  // Audio controls
  const [micEnabled, setMicEnabled] = useState(false);
  const [crossfade, setCrossfade] = useState(50);

  const { connected, updateMetadata, socket, joinBroadcast, leaveBroadcast } = useSocket();

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
    const h = (data: { count: number }) => setListenerCount(data.count);
    socket.on('listener_count', h);
    return () => { socket.off('listener_count', h); };
  }, [socket, broadcast?.id]);

  // YouTube search (uses Invidious API as proxy - no API key needed)
  const searchYouTube = useCallback(async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://vid.puffyan.us/api/v1/search?q=${encodeURIComponent(searchQuery)}&type=video&sort_by=relevance`);
      const data = await res.json();
      setSearchResults(data.slice(0, 10).map((v: any) => ({
        id: v.videoId,
        title: v.title,
        artist: v.author,
        thumbnail: v.videoThumbnails?.[0]?.url || '',
        duration: formatDuration(v.lengthSeconds),
        videoId: v.videoId,
      })));
    } catch {
      // Fallback: try another instance
      try {
        const res = await fetch(`https://invidious.fdn.fr/api/v1/search?q=${encodeURIComponent(searchQuery)}&type=video&sort_by=relevance`);
        const data = await res.json();
        setSearchResults(data.slice(0, 10).map((v: any) => ({
          id: v.videoId,
          title: v.title,
          artist: v.author,
          thumbnail: v.videoThumbnails?.[0]?.url || '',
          duration: formatDuration(v.lengthSeconds),
          videoId: v.videoId,
        })));
      } catch {
        setSearchResults([]);
      }
    }
    setSearching(false);
  }, [searchQuery]);

  const addToQueue = useCallback((track: any) => {
    const item: QueueItem = { ...track, addedBy: user?.username || 'DJ' };
    setQueue((prev) => [...prev, item]);
  }, [user]);

  const playNext = useCallback(() => {
    setQueue((prev) => {
      const next = prev[0];
      if (next) {
        setCurrentTrack(next);
        setIsPlaying(true);
        setNowPlayingMeta({ artist: next.artist, title: next.title, album: '' });
        if (broadcast?.id) {
          updateMetadata(broadcast.id, next.artist, next.title);
        }
        return prev.slice(1);
      }
      setIsPlaying(false);
      setCurrentTrack(null);
      return prev;
    });
  }, [broadcast?.id, updateMetadata]);

  const removeFromQueue = useCallback((index: number) => {
    setQueue((prev) => prev.filter((_, i) => i !== index));
  }, []);

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
    } catch (err: any) {
      setError(err.message || 'Failed');
      setStatus('idle');
    }
  }, [title]);

  const endBroadcast = useCallback(async () => {
    if (!broadcast?.id) return;
    setStatus('ending');
    try {
      await api(`/api/broadcasts/${broadcast.id}/end`, { method: 'POST', token: getToken()! });
      leaveBroadcast(broadcast.id);
      setBroadcast(null);
      setStatus('idle');
      setListenerCount(0);
      setStreamKey('');
      setCurrentTrack(null);
      setQueue([]);
    } catch (err: any) {
      setError(err.message);
      setStatus('live');
    }
  }, [broadcast?.id]);

  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-surface-0 noise-overlay">
      <Navbar />

      <div className="pt-12 p-4 max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="flex items-end gap-0.5">
              {[12, 18, 8, 15, 10].map((h, i) => (
                <div key={i} className={`freq-bar eq-bar ${status === 'live' ? '' : 'opacity-20'}`}
                  suppressHydrationWarning
                  style={{ '--eq-height': `${h}px`, '--eq-delay': `${i * 0.1}s`, height: '3px' } as any} />
              ))}
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                <span className="text-white/60">DJ</span> <span className="text-accent">Panel</span>
              </h1>
              <p className="text-[10px] text-white/25 uppercase tracking-[0.15em]">{user.username}&apos;s broadcast studio</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {status === 'live' && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-2 border border-accent/10">
                <div className="live-dot" />
                <span className="text-[10px] text-accent font-semibold uppercase tracking-wider">Live</span>
                <span className="text-[10px] text-white/30">{listenerCount} listeners</span>
              </div>
            )}
          </div>
        </div>

        {status === 'idle' || status === 'starting' || (status as string) === 'ending' ? (
          /* START SCREEN */
          <div className="max-w-md mx-auto mt-20">
            <div className="bg-surface-1 rounded-2xl border border-white/[0.04] p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-accent/10 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2">
                  <circle cx="12" cy="12" r="2" />
                  <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-1">Go On Air</h2>
              <p className="text-xs text-white/30 mb-6">Set up your broadcast and start streaming</p>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Show name..."
                className="w-full px-4 py-3 bg-surface-2 border border-white/5 rounded-xl text-sm text-white placeholder:text-white/20 mb-4 text-center"
              />
              {error && <p className="text-xs text-red-400 mb-3">{error}</p>}
              <button onClick={startBroadcast} disabled={!title.trim() || status === 'starting'}
                className="btn-radio btn-radio-primary w-full py-3 text-sm font-bold disabled:opacity-30">
                {status === 'starting' ? 'STARTING...' : 'START BROADCAST'}
              </button>
            </div>
          </div>
        ) : (
          /* DJ PANEL - LIVE */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* LEFT: Now Playing + Controls */}
            <div className="lg:col-span-2 space-y-4">

              {/* Now Playing Card */}
              <div className="bg-surface-1 rounded-2xl border border-white/[0.04] overflow-hidden">
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="live-dot" />
                    <span className="text-[10px] text-accent font-bold uppercase tracking-widest">Now Playing</span>
                  </div>

                  {currentTrack ? (
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
                        <p className="text-[10px] text-white/20 mt-1">{currentTrack.duration}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-white/10 mx-auto mb-2">
                        <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                      </svg>
                      <p className="text-xs text-white/20">No track playing. Add tracks to queue.</p>
                    </div>
                  )}
                </div>

                {/* Transport Controls */}
                <div className="px-5 pb-4 border-t border-white/[0.03] pt-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={playNext}
                        className="w-10 h-10 rounded-full bg-accent hover:bg-accent-hover flex items-center justify-center transition-all shadow-glow-sm">
                        {isPlaying ? (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                        )}
                      </button>
                      <button onClick={() => { setIsPlaying(false); setCurrentTrack(null); }}
                        className="w-8 h-8 rounded-full bg-surface-3 hover:bg-surface-4 flex items-center justify-center transition-colors">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="white/50"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                      </button>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Mic Toggle */}
                      <button onClick={() => setMicEnabled(!micEnabled)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wider transition-all ${
                          micEnabled ? 'bg-accent/20 text-accent border border-accent/30' : 'bg-surface-3 text-white/30 border border-white/5'
                        }`}>
                        {micEnabled ? 'MIC ON' : 'MIC OFF'}
                      </button>

                      {/* Volume */}
                      <div className="flex items-center gap-2">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/30">
                          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                        </svg>
                        <input type="range" min="0" max="100" value={volume}
                          onChange={(e) => setVolume(Number(e.target.value))}
                          className="w-20" />
                        <span className="text-[10px] text-white/20 w-6 text-right">{volume}</span>
                      </div>
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
                  <span className="text-[10px] text-white/40 uppercase tracking-widest font-medium">Search Music</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && searchYouTube()}
                    placeholder="Search YouTube..."
                    className="flex-1 px-3 py-2.5 bg-surface-2 border border-white/5 rounded-xl text-sm text-white placeholder:text-white/20"
                  />
                  <button onClick={searchYouTube} disabled={searching}
                    className="btn-radio btn-radio-primary px-4 py-2.5 text-xs font-bold">
                    {searching ? '...' : 'SEARCH'}
                  </button>
                </div>

                {/* Results */}
                {searchResults.length > 0 && (
                  <div className="mt-3 space-y-1 max-h-80 overflow-y-auto">
                    {searchResults.map((track) => (
                      <div key={track.id} className="track-item flex items-center gap-3 p-2 rounded-lg cursor-pointer group"
                        onClick={() => addToQueue(track)}>
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
                        <div className="w-6 h-6 rounded bg-accent/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Broadcast Info */}
              <div className="bg-surface-1 rounded-2xl border border-white/[0.04] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-white/30 mb-1">Stream Key</p>
                    <p className="text-[11px] font-mono text-white/50">{streamKey}</p>
                  </div>
                  <button onClick={() => navigator.clipboard.writeText(streamKey)}
                    className="btn-radio btn-radio-ghost px-3 py-1.5 text-[10px] font-semibold">
                    COPY
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4">
                  <div className="text-center p-2 rounded-lg bg-surface-2">
                    <p className="text-lg font-bold text-accent">{listenerCount}</p>
                    <p className="text-[9px] text-white/20 uppercase tracking-wider">Listeners</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-surface-2">
                    <p className="text-lg font-bold">192</p>
                    <p className="text-[9px] text-white/20 uppercase tracking-wider">kbps</p>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-surface-2">
                    <p className="text-lg font-bold">{queue.length}</p>
                    <p className="text-[9px] text-white/20 uppercase tracking-wider">In Queue</p>
                  </div>
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
                    <p className="text-[11px] text-white/15">Queue is empty</p>
                    <p className="text-[10px] text-white/10 mt-1">Search and add tracks</p>
                  </div>
                ) : (
                  <div className="max-h-[500px] overflow-y-auto">
                    {queue.map((item, i) => (
                      <div key={`${item.id}-${i}`} className="track-item flex items-center gap-3 px-4 py-2.5">
                        <span className="text-[10px] text-white/15 w-4 text-right">{i + 1}</span>
                        <div className="w-10 h-7 rounded bg-surface-3 overflow-hidden flex-shrink-0">
                          {item.thumbnail ? (
                            <img src={item.thumbnail} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full" />
                          )}
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
                      className="btn-radio btn-radio-primary w-full py-2 text-[11px] font-bold">
                      PLAY NEXT
                    </button>
                  </div>
                )}
              </div>

              {/* Crossfade */}
              <div className="bg-surface-1 rounded-2xl border border-white/[0.04] p-4">
                <p className="text-[10px] text-white/30 uppercase tracking-widest font-medium mb-3">Crossfade</p>
                <input type="range" min="0" max="100" value={crossfade}
                  onChange={(e) => setCrossfade(Number(e.target.value))} className="w-full" />
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-white/15">0s</span>
                  <span className="text-[9px] text-white/15">{crossfade / 10}s</span>
                  <span className="text-[9px] text-white/15">10s</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
