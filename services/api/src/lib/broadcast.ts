import { query, queryOne } from './db';
import { v4 as uuidv4 } from 'uuid';

const BROADCAST_COLUMNS = `
  b.id, b.broadcaster_id as "broadcasterId", b.title, b.description,
  b.is_live as "isLive", b.started_at as "startedAt", b.ended_at as "endedAt",
  b.listener_count as "listenerCount", b.peak_listeners as "peakListeners",
  b.stream_key as "streamKey", b.mount_point as "mountPoint",
  b.bitrate, b.genre, b.website_url as "websiteUrl",
  b.created_at as "createdAt", b.updated_at as "updatedAt",
  u.username as "broadcaster_name"
`;

export async function createBroadcast(broadcasterId: string, title: string, description?: string): Promise<any> {
  const streamKey = uuidv4().replace(/-/g, '');
  const mountPoint = `/live`;

  const broadcasts = await query(
    `INSERT INTO broadcasts (broadcaster_id, title, description, stream_key, mount_point, is_live, bitrate)
     VALUES ($1, $2, $3, $4, $5, true, 192)
     RETURNING id, broadcaster_id as "broadcasterId", title, description,
       is_live as "isLive", started_at as "startedAt", ended_at as "endedAt",
       listener_count as "listenerCount", peak_listeners as "peakListeners",
       stream_key as "streamKey", mount_point as "mountPoint",
       bitrate, created_at as "createdAt", updated_at as "updatedAt"`,
    [broadcasterId, title, description || '', streamKey, mountPoint]
  );
  return broadcasts[0];
}

export async function endBroadcast(id: string): Promise<any | null> {
  return queryOne(
    `UPDATE broadcasts SET is_live = false, ended_at = NOW(), updated_at = NOW()
     WHERE id = $1
     RETURNING id, broadcaster_id as "broadcasterId", title, description,
       is_live as "isLive", started_at as "startedAt", ended_at as "endedAt",
       listener_count as "listenerCount", peak_listeners as "peakListeners",
       stream_key as "streamKey", mount_point as "mountPoint",
       bitrate, created_at as "createdAt", updated_at as "updatedAt"`,
    [id]
  );
}

export async function getActiveBroadcast(): Promise<any | null> {
  return queryOne(
    `SELECT ${BROADCAST_COLUMNS}
     FROM broadcasts b
     JOIN users u ON b.broadcaster_id = u.id
     WHERE b.is_live = true
     ORDER BY b.started_at DESC LIMIT 1`
  );
}

export async function getBroadcast(id: string): Promise<any | null> {
  return queryOne(
    `SELECT ${BROADCAST_COLUMNS}
     FROM broadcasts b
     JOIN users u ON b.broadcaster_id = u.id
     WHERE b.id = $1`,
    [id]
  );
}

export async function getRecentBroadcasts(limit: number = 10): Promise<any[]> {
  return query(
    `SELECT ${BROADCAST_COLUMNS}
     FROM broadcasts b
     JOIN users u ON b.broadcaster_id = u.id
     WHERE b.is_live = false
     ORDER BY b.ended_at DESC LIMIT $1`,
    [limit]
  );
}

export async function getBroadcastHistory(limit: number = 50, offset: number = 0): Promise<any[]> {
  return query(
    `SELECT ${BROADCAST_COLUMNS}
     FROM broadcasts b
     JOIN users u ON b.broadcaster_id = u.id
     ORDER BY b.created_at DESC LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
}

export async function updateBroadcastListeners(id: string, count: number, peak: number): Promise<void> {
  await query(
    `UPDATE broadcasts SET listener_count = $2, peak_listeners = GREATEST(peak_listeners, $3), updated_at = NOW()
     WHERE id = $1`,
    [id, count, peak]
  );
}

export async function getBroadcastStats(): Promise<{
  totalBroadcasts: number;
  totalListeners: number;
  peakListeners: number;
  averageListeners: number;
  totalDuration: number;
}> {
  const stats = await queryOne<{
    total_broadcasts: string;
    total_listeners: string;
    peak_listeners: string;
    avg_listeners: string;
    total_duration: string;
  }>(
    `SELECT
       COUNT(*) as total_broadcasts,
       COALESCE(SUM(b.listener_count), 0) as total_listeners,
       COALESCE(MAX(b.peak_listeners), 0) as peak_listeners,
       COALESCE(AVG(b.listener_count), 0) as avg_listeners,
       COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(ended_at, NOW()) - started_at))), 0) as total_duration
     FROM broadcasts b`
  );

  return {
    totalBroadcasts: parseInt(stats?.total_broadcasts || '0'),
    totalListeners: parseInt(stats?.total_listeners || '0'),
    peakListeners: parseInt(stats?.peak_listeners || '0'),
    averageListeners: parseFloat(stats?.avg_listeners || '0'),
    totalDuration: parseFloat(stats?.total_duration || '0'),
  };
}
