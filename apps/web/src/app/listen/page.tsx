'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';
import Navbar from '@/components/Navbar';

export default function ListenPage() {
  const [broadcast, setBroadcast] = useState<any>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [listenerCount, setListenerCount] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [connStatus, setConnStatus] = useState<'connecting'|'connected'|'error'>('connecting');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [username, setUsername] = useState('');
  const [showChat, setShowChat] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { connected, joinBroadcast, leaveBroadcast, sendChat, socket } = useSocket();
  const STREAM_URL = process.env.NEXT_PUBLIC_STREAM_URL || 'http://localhost:4000/api/audio/stream';

  useEffect(() => {
    api('/api/broadcasts/active').then((r) => {
      if (r.data) {
        setBroadcast(r.data);
        setMetadata({ artist: r.data.artist || 'Unknown', title: r.data.title || 'Live Broadcast', album: r.data.album });
      }
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (broadcast?.id && connected) {
      joinBroadcast(broadcast.id);
      return () => leaveBroadcast(broadcast.id);
    }
  }, [broadcast?.id, connected]);

  useEffect(() => {
    if (!socket) return;
    const hC = (d: { count: number }) => setListenerCount(d.count);
    const hM = (d: any) => setMetadata(d);
    const hCh = (m: any) => setChatMessages((p) => [...p.slice(-100), m]);
    const hD = (d: { messageId: string }) => setChatMessages((p) => p.filter((m) => m.id !== d.messageId));
    socket.on('listener_count', hC);
    socket.on('metadata_changed', hM);
    socket.on('chat_message', hCh);
    socket.on('chat_deleted', hD);
    return () => { socket.off('listener_count', hC); socket.off('metadata_changed', hM); socket.off('chat_message', hCh); socket.off('chat_deleted', hD); };
  }, [socket]);

  const initAudio = useCallback(() => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    const audio = new Audio();
    audio.src = STREAM_URL;
    audio.crossOrigin = 'anonymous';
    audio.volume = muted ? 0 : volume;
    audio.addEventListener('playing', () => { setIsPlaying(true); setConnStatus('connected'); });
    audio.addEventListener('pause', () => setIsPlaying(false));
    audio.addEventListener('error', () => setConnStatus('error'));
    audio.addEventListener('waiting', () => setConnStatus('connecting'));
    audioRef.current = audio;
    audio.play().catch(() => setConnStatus('error'));
  }, [STREAM_URL, volume, muted]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) { initAudio(); return; }
    isPlaying ? audioRef.current.pause() : audioRef.current.play().catch(() => {});
  }, [isPlaying, initAudio]);

  const sendMsg = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !broadcast?.id || !username.trim()) return;
    sendChat(broadcast.id, chatInput.trim());
    setChatInput('');
  }, [chatInput, broadcast?.id, username]);

  return (
    <div className="min-h-screen bg-surface-0 noise-overlay">
      <Navbar />
      <div className="pt-12 min-h-screen flex">
        <div className="flex-1 flex items-center justify-center p-4">
          {!broadcast ? (
            <div className="text-center">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-surface-2 border border-white/[0.04] flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/10">
                  <path d="M3 18V6a9 9 0 0 1 18 0v12" />
                  <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                </svg>
              </div>
              <h2 className="text-lg font-bold mb-1">Off Air</h2>
              <p className="text-xs text-white/25">No active broadcast right now.</p>
            </div>
          ) : (
            <div className="w-full max-w-sm">
              <div className="bg-surface-1 rounded-3xl border border-white/[0.04] overflow-hidden shadow-glow-orange">
                <div className="flex items-center justify-center gap-2 pt-6 pb-2">
                  <div className="live-dot" />
                  <span className="text-[10px] font-bold text-accent uppercase tracking-[0.2em]">Live</span>
                </div>

                <div className="relative w-44 h-44 mx-auto my-4">
                  <div className="absolute inset-0 rounded-2xl bg-accent/5 blur-xl" />
                  <div className={`relative w-full h-full rounded-2xl bg-surface-3 border border-white/[0.04] flex items-center justify-center overflow-hidden ${isPlaying ? 'animate-spin-slow' : ''}`}
                    style={{ animationDuration: '8s' }}>
                    {metadata?.coverUrl ? (
                      <img src={metadata.coverUrl} alt="" className="w-full h-full object-cover rounded-2xl" />
                    ) : (
                      <>
                        <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent" />
                        <div className="relative">
                          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-accent/30">
                            <path d="M3 18V6a9 9 0 0 1 18 0v12" />
                            <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                          </svg>
                        </div>
                        <div className="absolute inset-4 border border-white/[0.03] rounded-xl" />
                        <div className="absolute inset-8 border border-white/[0.03] rounded-lg" />
                        <div className="absolute inset-12 border border-white/[0.03] rounded-md" />
                      </>
                    )}
                  </div>
                </div>

                <div className="text-center px-6 mb-4">
                  <p className="text-[11px] text-white/30 mb-1 truncate">{metadata?.artist || 'Unknown Artist'}</p>
                  <p className="text-lg font-bold truncate">{metadata?.title || 'Live Broadcast'}</p>
                </div>

                <div className="flex items-center justify-center mb-3">
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] ${
                    connStatus === 'connected' ? 'bg-green-500/10 text-green-400' :
                    connStatus === 'connecting' ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-red-500/10 text-red-400'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      connStatus === 'connected' ? 'bg-green-400' :
                      connStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' : 'bg-red-400'
                    }`} />
                    {connStatus === 'connected' ? 'Connected' : connStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
                  </div>
                </div>

                <div className="px-6 pb-2">
                  <div className="flex items-center justify-center gap-5">
                    <button onClick={() => setMuted(!muted)} className="p-2 rounded-lg hover:bg-surface-3 transition-colors">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={muted ? 'text-white/30' : 'text-white/50'}>
                        <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                        {!muted && <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />}
                        {muted && <><line x1="23" y1="9" x2="17" y2="15" /><line x1="17" y1="9" x2="23" y2="15" /></>}
                      </svg>
                    </button>
                    <button onClick={togglePlay}
                      className="w-14 h-14 rounded-full bg-accent hover:bg-accent-hover flex items-center justify-center transition-all shadow-glow-orange">
                      {isPlaying ? (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" /></svg>
                      ) : (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                      )}
                    </button>
                    <div className="w-8" />
                  </div>
                  <div className="flex items-center gap-2 mt-3 px-1">
                    <input type="range" min="0" max="1" step="0.01" value={muted ? 0 : volume}
                      onChange={(e) => { setVolume(parseFloat(e.target.value)); setMuted(false); if (audioRef.current) audioRef.current.volume = parseFloat(e.target.value); }}
                      className="flex-1" />
                  </div>
                </div>

                <div className="flex items-center justify-center gap-2 py-4 border-t border-white/[0.03] mt-2">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/20">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                  <span className="text-[11px] text-white/25">{listenerCount} listening</span>
                </div>
              </div>

              <button onClick={() => setShowChat(!showChat)}
                className="mt-4 w-full py-2 bg-surface-1 border border-white/[0.04] rounded-xl text-[11px] text-white/30 hover:text-accent hover:border-accent/10 transition-all">
                {showChat ? 'Hide Chat' : 'Open Chat'}
              </button>
            </div>
          )}
        </div>

        {showChat && (
          <div className="w-80 border-l border-white/[0.03] flex flex-col bg-surface-1">
            <div className="p-3 border-b border-white/[0.03]">
              <h3 className="text-[10px] text-accent uppercase tracking-[0.15em] font-semibold">Live Chat</h3>
            </div>
            {!username ? (
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <p className="text-[11px] text-white/20 mb-3">Pick a name to join</p>
                  <input type="text" placeholder="Username" maxLength={30}
                    className="w-full px-3 py-2 bg-surface-2 border border-white/5 rounded-xl text-sm text-white placeholder:text-white/15 mb-2 text-center"
                    onKeyDown={(e) => { if (e.key === 'Enter' && e.currentTarget.value.trim()) setUsername(e.currentTarget.value.trim()); }} />
                  <button onClick={() => {}}
                    className="btn-radio btn-radio-primary w-full py-2 text-xs font-bold mt-1">JOIN</button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {chatMessages.length === 0 && <p className="text-[11px] text-white/10 text-center mt-8">No messages yet.</p>}
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="animate-fade-in">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`text-[11px] font-semibold ${msg.isModerator ? 'text-accent' : 'text-white/50'}`}>{msg.username}</span>
                        <span className="text-[9px] text-white/15">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-sm text-white/60 break-words">{msg.content}</p>
                    </div>
                  ))}
                </div>
                <form onSubmit={sendMsg} className="p-3 border-t border-white/[0.03]">
                  <div className="flex gap-2">
                    <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Say something..." maxLength={500}
                      className="flex-1 px-3 py-2 bg-surface-2 border border-white/5 rounded-xl text-sm text-white placeholder:text-white/15" />
                    <button type="submit" disabled={!chatInput.trim()}
                      className="px-3 py-2 bg-accent hover:bg-accent-hover disabled:opacity-30 text-white text-xs rounded-xl font-bold transition-colors">Send</button>
                  </div>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
