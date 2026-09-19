'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { getToken } from '@/lib/api';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:4000';

export function useSocket(broadcastId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const token = getToken();
    const socket = io(WS_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('connect_error', (err) => {
      console.error('WebSocket connection error:', err.message);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const joinBroadcast = useCallback((id: string) => {
    socketRef.current?.emit('join_broadcast', id);
  }, []);

  const leaveBroadcast = useCallback((id: string) => {
    socketRef.current?.emit('leave_broadcast', id);
  }, []);

  const sendChat = useCallback((broadcastId: string, content: string) => {
    socketRef.current?.emit('chat_message', { broadcastId, content });
  }, []);

  const deleteMessage = useCallback((broadcastId: string, messageId: string) => {
    socketRef.current?.emit('delete_message', { broadcastId, messageId });
  }, []);

  const banUser = useCallback((broadcastId: string, userId: string) => {
    socketRef.current?.emit('ban_user', { broadcastId, userId });
  }, []);

  const updateMetadata = useCallback((broadcastId: string, artist: string, title: string, album?: string) => {
    socketRef.current?.emit('metadata_update', { broadcastId, artist, title, album });
  }, []);

  return {
    socket: socketRef.current,
    connected,
    joinBroadcast,
    leaveBroadcast,
    sendChat,
    deleteMessage,
    banUser,
    updateMetadata,
  };
}
