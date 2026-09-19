import { query, queryOne } from './db';
import type { ChatMessage } from '@radiolive/shared';
import { v4 as uuidv4 } from 'uuid';

const RATE_LIMIT_WINDOW = 60000;
const MAX_MESSAGES_PER_WINDOW = 10;
const SPAM_PATTERNS = /(.)\1{5,}|https?:\/\/\S+/i;

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimits = new Map<string, RateLimitEntry>();

export function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(userId);

  if (!entry || now > entry.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= MAX_MESSAGES_PER_WINDOW) {
    return false;
  }

  entry.count++;
  return true;
}

export function isSpam(content: string): boolean {
  return SPAM_PATTERNS.test(content);
}

export async function sendMessage(
  broadcastId: string,
  userId: string,
  username: string,
  content: string,
  isModerator: boolean = false
): Promise<ChatMessage | null> {
  if (!checkRateLimit(userId)) return null;
  if (isSpam(content)) return null;
  if (content.length > 500) return null;

  const messages = await query<ChatMessage>(
    `INSERT INTO chat_messages (broadcast_id, user_id, username, content, is_moderator)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, broadcast_id as "broadcastId", user_id as "userId", username, content, timestamp, is_moderator as "isModerator", is_deleted as "isDeleted"`,
    [broadcastId, userId, username, content.slice(0, 500), isModerator]
  );
  return messages[0];
}

export async function getMessages(broadcastId: string, limit: number = 50): Promise<ChatMessage[]> {
  return query<ChatMessage>(
    `SELECT id, broadcast_id as "broadcastId", user_id as "userId", username, content, timestamp,
            is_moderator as "isModerator", is_deleted as "isDeleted"
     FROM chat_messages
     WHERE broadcast_id = $1 AND is_deleted = false
     ORDER BY timestamp DESC LIMIT $2`,
    [broadcastId, limit]
  );
}

export async function deleteMessage(messageId: string, userId: string): Promise<boolean> {
  const result = await query(
    `UPDATE chat_messages SET is_deleted = true
     WHERE id = $1 AND (user_id = $2 OR EXISTS (
       SELECT 1 FROM users WHERE id = $2 AND role IN ('moderator', 'admin')
     ))`,
    [messageId, userId]
  );
  return (result as any).rowCount > 0;
}

export async function banUser(broadcastId: string, targetUserId: string): Promise<boolean> {
  await query(
    `INSERT INTO chat_bans (broadcast_id, user_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [broadcastId, targetUserId]
  );
  return true;
}

export async function isUserBanned(broadcastId: string, userId: string): Promise<boolean> {
  const result = await queryOne<{ count: string }>(
    `SELECT COUNT(*) as count FROM chat_bans
     WHERE broadcast_id = $1 AND user_id = $2`,
    [broadcastId, userId]
  );
  return parseInt(result?.count || '0') > 0;
}
