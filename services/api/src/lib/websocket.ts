import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { verifyToken, getUserById } from './auth';
import { getActiveBroadcast } from './broadcast';
import { sendMessage, isUserBanned, deleteMessage, banUser } from './chat';
import { query } from './db';

let io: Server;
const listenerCounts = new Map<string, Set<string>>();

export function initWebSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingInterval: 25000,
    pingTimeout: 60000,
  });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (token) {
      try {
        const payload = verifyToken(token);
        const user = await getUserById(payload.userId);
        if (user) {
          (socket as any).user = user;
        }
      } catch {}
    }
    next();
  });

  io.on('connection', (socket: Socket) => {
    const user = (socket as any).user;
    console.log(`Client connected: ${socket.id}${user ? ` (${user.username})` : ''}`);

    socket.on('join_broadcast', async (broadcastId: string) => {
      socket.join(`broadcast:${broadcastId}`);
      socket.data.broadcastId = broadcastId;

      if (!listenerCounts.has(broadcastId)) {
        listenerCounts.set(broadcastId, new Set());
      }
      listenerCounts.get(broadcastId)!.add(socket.id);

      const count = listenerCounts.get(broadcastId)!.size;
      io.to(`broadcast:${broadcastId}`).emit('listener_count', { count });

      if (user) {
        socket.to(`broadcast:${broadcastId}`).emit('user_joined', {
          userId: user.id,
          username: user.username,
          listenerCount: count,
        });
      }
    });

    socket.on('leave_broadcast', (broadcastId: string) => {
      handleLeaveBroadcast(socket, broadcastId);
    });

    socket.on('chat_message', async (data: { broadcastId: string; content: string }) => {
      if (!user) {
        socket.emit('error', { message: 'Authentication required for chat' });
        return;
      }

      const banned = await isUserBanned(data.broadcastId, user.id);
      if (banned) {
        socket.emit('error', { message: 'You are banned from this chat' });
        return;
      }

      const message = await sendMessage(
        data.broadcastId,
        user.id,
        user.username,
        data.content,
        ['moderator', 'admin'].includes(user.role)
      );

      if (message) {
        io.to(`broadcast:${data.broadcastId}`).emit('chat_message', message);
      } else {
        socket.emit('error', { message: 'Message rate limited or detected as spam' });
      }
    });

    socket.on('delete_message', async (data: { broadcastId: string; messageId: string }) => {
      if (!user || !['moderator', 'admin'].includes(user.role)) {
        return;
      }

      const deleted = await deleteMessage(data.messageId, user.id);
      if (deleted) {
        io.to(`broadcast:${data.broadcastId}`).emit('chat_deleted', { messageId: data.messageId });
      }
    });

    socket.on('ban_user', async (data: { broadcastId: string; userId: string }) => {
      if (!user || !['moderator', 'admin'].includes(user.role)) {
        return;
      }

      await banUser(data.broadcastId, data.userId);
      io.to(`broadcast:${data.broadcastId}`).emit('user_banned', { userId: data.userId });
    });

    socket.on('metadata_update', async (data: { broadcastId: string; artist: string; title: string; album?: string }) => {
      if (!user) return;

      await query(
        `INSERT INTO stream_metadata (broadcast_id, artist, title, album, updated_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (broadcast_id) DO UPDATE SET
           artist = EXCLUDED.artist, title = EXCLUDED.title, album = EXCLUDED.album, updated_at = NOW()`,
        [data.broadcastId, data.artist, data.title, data.album || '']
      ).catch(() => {});

      io.to(`broadcast:${data.broadcastId}`).emit('metadata_changed', {
        broadcaster: user.username,
        artist: data.artist,
        title: data.title,
        album: data.album,
        startedAt: new Date().toISOString(),
      });
    });

    socket.on('disconnect', () => {
      const broadcastId = socket.data.broadcastId;
      if (broadcastId) {
        handleLeaveBroadcast(socket, broadcastId);
      }
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

function handleLeaveBroadcast(socket: Socket, broadcastId: string) {
  socket.leave(`broadcast:${broadcastId}`);
  const listeners = listenerCounts.get(broadcastId);
  if (listeners) {
    listeners.delete(socket.id);
    const count = listeners.size;
    io.to(`broadcast:${broadcastId}`).emit('listener_count', { count });

    if (count === 0) {
      listenerCounts.delete(broadcastId);
    }
  }
}

export function getIO(): Server {
  return io;
}

export function broadcastStreamEvent(broadcastId: string, event: string, data: any) {
  if (io) {
    io.to(`broadcast:${broadcastId}`).emit(event, data);
  }
}

export function getListenerCount(broadcastId: string): number {
  return listenerCounts.get(broadcastId)?.size || 0;
}
