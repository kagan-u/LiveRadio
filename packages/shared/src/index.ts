export type UserRole = 'listener' | 'broadcaster' | 'moderator' | 'admin';

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  displayName?: string;
  avatarUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Broadcast {
  id: string;
  broadcasterId: string;
  title: string;
  description?: string;
  isLive: boolean;
  startedAt?: Date;
  endedAt?: Date;
  listenerCount: number;
  peakListeners: number;
  streamKey: string;
  mountPoint: string;
  bitrate: number;
  genre?: string;
  description_detail?: string;
  websiteUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface StreamMetadata {
  broadcaster: string;
  artist: string;
  title: string;
  album?: string;
  startedAt: string;
  coverUrl?: string;
}

export interface StreamStatus {
  isLive: boolean;
  listenerCount: number;
  peakListeners: number;
  uptime: number;
  bitrate: number;
  title: string;
  description?: string;
  startedAt?: string;
  metadata?: StreamMetadata;
}

export interface ChatMessage {
  id: string;
  broadcastId: string;
  userId: string;
  username: string;
  content: string;
  timestamp: Date;
  isModerator: boolean;
  isDeleted: boolean;
}

export interface BroadcastStats {
  totalBroadcasts: number;
  totalListeners: number;
  peakListeners: number;
  averageListeners: number;
  totalDuration: number;
}

export interface ServerStats {
  cpu: number;
  memory: number;
  uptime: number;
  activeConnections: number;
  streamStatus: StreamStatus;
}

// WebSocket events
export type WSEvent =
  | { type: 'broadcaster_connected'; broadcastId: string }
  | { type: 'broadcaster_disconnected'; broadcastId: string }
  | { type: 'stream_started'; broadcast: Broadcast }
  | { type: 'stream_stopped'; broadcastId: string }
  | { type: 'listener_joined'; listenerCount: number }
  | { type: 'listener_left'; listenerCount: number }
  | { type: 'listener_count'; count: number }
  | { type: 'metadata_changed'; metadata: StreamMetadata }
  | { type: 'stream_health'; status: 'good' | 'degraded' | 'poor' }
  | { type: 'chat_message'; message: ChatMessage }
  | { type: 'chat_deleted'; messageId: string }
  | { type: 'user_banned'; userId: string }
  | { type: 'server_stats'; stats: ServerStats };

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}
