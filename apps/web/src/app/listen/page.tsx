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
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [username, setUsername] = useState('');
  const [chatConnected, setChatConnected] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const { connected, joinBroadcast, leaveBroadcast, sendChat, socket } = useSocket();

  const STREAM_URL = process.env.NEXT_PUBLIC_STREAM_URL || 'http://localhost:8000/live';

  // Fetch active broadcast
  useEffect(() => {
    api('/api/broadcasts/active')
      .then((res) => {
        if (res.data) {
          setBroadcast(res.data);
          setMetadata({
            artist: res.data.artist || 'Unknown',
            title: res.data.title || 'Live Broadcast',
            album: res.data.album,
          });
        }
      })
      .catch(() => {});
  }, []);

  // Join WebSocket room
  useEffect(() => {
    if (broadcast?.id && connected) {
      joinBroadcast(broadcast.id);
      setChatConnected(true);
      return () => leaveBroadcast(broadcast.id);
    }
  }, [broadcast?.id, connected]);

  // WebSocket listeners
  useEffect(() => {
    if (!socket) return;

    const handleListenerCount = (data: { count: number }) => {
      setListenerCount(data.count);
    };

    const handleMetadata = (data: any) => {
      setMetadata(data);
    };

    const handleChatMessage = (msg: any) => {
      setChatMessages((prev) => [...prev.slice(-100), msg]);
    };

    const handleChatDeleted = (data: { messageId: string }) => {
      setChatMessages((prev) => prev.filter((m) => m.id !== data.messageId));
    };

    socket.on('listener_count', handleListenerCount);
    socket.on('metadata_changed', handleMetadata);
    socket.on('chat_message', handleChatMessage);
    socket.on('chat_deleted', handleChatDeleted);

    return () => {
      socket.off('listener_count', handleListenerCount);
      socket.off('metadata_changed', handleMetadata);
      socket.off('chat_message', handleChatMessage);
      socket.off('chat_deleted', handleChatDeleted);
    };
  }, [socket]);

  // Audio player
  const initAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audio = new Audio();
    audio.src = STREAM_URL;
    audio.crossOrigin = 'anonymous';
    audio.volume = muted ? 0 : volume;

    audio.addEventListener('playing', () => {
      setIsPlaying(true);
      setConnectionStatus('connected');
    });

    audio.addEventListener('pause', () => {
      setIsPlaying(false);
    });

    audio.addEventListener('error', () => {
      setConnectionStatus('error');
    });

    audio.addEventListener('waiting', () => {
      setConnectionStatus('connecting');
    });

    audioRef.current = audio;
    audio.play().catch(() => {
      setConnectionStatus('error');
    });
  }, [STREAM_URL, volume, muted]);

  const togglePlay = useCallback(() => {
    if (!audioRef.current) {
      initAudio();
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(() => {});
    }
  }, [isPlaying, initAudio]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    setMuted(false);
    if (audioRef.current) {
      audioRef.current.volume = v;
    }
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const newMuted = !m;
      if (audioRef.current) {
        audioRef.current.volume = newMuted ? 0 : volume;
      }
      return newMuted;
    });
  }, [volume]);

  const handleSendChat = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !broadcast?.id || !username.trim()) return;
    sendChat(broadcast.id, chatInput.trim());
    setChatInput('');
  }, [chatInput, broadcast?.id, username]);

  if (!broadcast) {
    return (
      <div className="min-h-screen">
        <Navbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-surface-2 flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
                <path d="M3 18V6a9 9 0 0 1 18 0v12" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
            </div>
            <h2 className="text-lg font-medium mb-2">No Active Broadcast</h2>
            <p className="text-sm text-muted">Check back later or start your own broadcast.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="pt-14 min-h-screen flex">
        {/* Main Player */}
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-sm">
            <div className="bg-surface-1 rounded-2xl p-6 border border-white/5">
              {/* Live indicator */}
              <div className="flex items-center justify-center gap-2 mb-6">
                <div className="live-dot" />
                <span className="text-xs font-medium text-accent uppercase tracking-wider">Live</span>
              </div>

              {/* Album Art Placeholder */}
              <div className="w-48 h-48 mx-auto mb-6 rounded-xl bg-surface-2 flex items-center justify-center">
                {metadata?.coverUrl ? (
                  <img src={metadata.coverUrl} alt="Album Art" className="w-full h-full object-cover rounded-xl" />
                ) : (
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted/50">
                    <path d="M3 18V6a9 9 0 0 1 18 0v12" />
                    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                  </svg>
                )}
              </div>

              {/* Track Info */}
              <div className="text-center mb-6">
                <p className="text-sm text-muted mb-1">{metadata?.artist || 'Unknown Artist'}</p>
                <p className="text-lg font-semibold">{metadata?.title || 'Live Broadcast'}</p>
                {metadata?.album && (
                  <p className="text-xs text-muted mt-1">{metadata.album}</p>
                )}
              </div>

              {/* Connection Status */}
              <div className="flex items-center justify-center gap-4 mb-4">
                <div className={`flex items-center gap-1.5 text-xs ${
                  connectionStatus === 'connected' ? 'text-green-400' :
                  connectionStatus === 'connecting' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-400' :
                    connectionStatus === 'connecting' ? 'bg-yellow-400 animate-pulse' :
                    'bg-red-400'
                  }`} />
                  {connectionStatus === 'connected' ? 'Connected' :
                   connectionStatus === 'connecting' ? 'Connecting...' :
                   'Disconnected'}
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center justify-center gap-4 mb-4">
                <button
                  onClick={toggleMute}
                  className="p-2 rounded-lg hover:bg-surface-3 transition-colors"
                >
                  {muted ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <line x1="23" y1="9" x2="17" y2="15" />
                      <line x1="17" y1="9" x2="23" y2="15" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/70">
                      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                    </svg>
                  )}
                </button>

                <button
                  onClick={togglePlay}
                  className="w-12 h-12 rounded-full bg-accent hover:bg-accent-hover flex items-center justify-center transition-all glow-red"
                >
                  {isPlaying ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <rect x="6" y="4" width="4" height="16" />
                      <rect x="14" y="4" width="4" height="16" />
                    </svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  )}
                </button>

                <div className="w-9" />
              </div>

              {/* Volume */}
              <div className="flex items-center gap-2 px-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={muted ? 0 : volume}
                  onChange={handleVolumeChange}
                  className="flex-1 h-1 bg-surface-3 rounded-full appearance-none cursor-pointer
                    [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3
                    [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
                />
              </div>

              {/* Listener count */}
              <div className="flex items-center justify-center gap-2 mt-4">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                <span className="text-xs text-muted">{listenerCount} listeners</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chat Panel */}
        <div className="w-80 border-l border-white/5 flex flex-col bg-surface-1">
          <div className="p-3 border-b border-white/5">
            <h3 className="text-xs font-medium text-muted uppercase tracking-wider">Live Chat</h3>
          </div>

          {!username ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center">
                <p className="text-xs text-muted mb-3">Enter a username to chat</p>
                <input
                  type="text"
                  placeholder="Username"
                  maxLength={30}
                  className="w-full px-3 py-2 bg-surface-2 border border-white/5 rounded-lg text-sm text-white placeholder:text-muted/50 mb-2"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                      setUsername(e.currentTarget.value.trim());
                    }
                  }}
                />
                <button
                  onClick={(e) => {
                    const input = (e.target as HTMLElement).parentElement?.querySelector('input');
                    if (input?.value.trim()) setUsername(input.value.trim());
                  }}
                  className="w-full py-2 bg-accent hover:bg-accent-hover text-white text-xs rounded-lg font-medium transition-colors"
                >
                  Join Chat
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {chatMessages.length === 0 && (
                  <p className="text-xs text-muted text-center mt-8">No messages yet. Say hi!</p>
                )}
                {chatMessages.map((msg) => (
                  <div key={msg.id} className="animate-fade-in">
                    <div className="flex items-baseline gap-1.5">
                      <span className={`text-xs font-medium ${msg.isModerator ? 'text-accent' : 'text-white/80'}`}>
                        {msg.username}
                      </span>
                      <span className="text-[10px] text-muted/50">
                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-sm text-white/70 break-words">{msg.content}</p>
                  </div>
                ))}
              </div>

              {/* Input */}
              <form onSubmit={handleSendChat} className="p-3 border-t border-white/5">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Type a message..."
                    maxLength={500}
                    className="flex-1 px-3 py-2 bg-surface-2 border border-white/5 rounded-lg text-sm text-white placeholder:text-muted/50"
                  />
                  <button
                    type="submit"
                    disabled={!chatInput.trim()}
                    className="px-3 py-2 bg-accent hover:bg-accent-hover disabled:opacity-30 text-white text-xs rounded-lg font-medium transition-colors"
                  >
                    Send
                  </button>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
