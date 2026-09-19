import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query, queryOne } from './db';
import type { User, UserRole } from '@radiolive/shared';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret';
const JWT_EXPIRES_IN = '7d';

export interface TokenPayload {
  userId: string;
  role: UserRole;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function generateToken(user: { id: string; role: UserRole }): string {
  return jwt.sign({ userId: user.id, role: user.role }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload;
}

export async function createUser(data: {
  username: string;
  email: string;
  password: string;
  role?: UserRole;
}): Promise<User> {
  const { username, email, password, role = 'listener' } = data;
  const hashedPassword = await hashPassword(password);

  const users = await query<User>(
    `INSERT INTO users (username, email, password_hash, role)
     VALUES ($1, $2, $3, $4)
     RETURNING id, username, email, role, display_name, avatar_url, created_at, updated_at`,
    [username, email, hashedPassword, role]
  );
  return users[0];
}

export async function authenticateUser(email: string, password: string): Promise<User | null> {
  const user = await queryOne<User & { password_hash: string }>(
    `SELECT id, username, email, role, password_hash, display_name, avatar_url, created_at, updated_at
     FROM users WHERE email = $1`,
    [email]
  );

  if (!user) return null;

  const valid = await comparePassword(password, user.password_hash);
  if (!valid) return null;

  const { password_hash, ...userWithoutPassword } = user;
  return userWithoutPassword as User;
}

export async function getUserById(id: string): Promise<User | null> {
  return queryOne<User>(
    `SELECT id, username, email, role, display_name, avatar_url, created_at, updated_at
     FROM users WHERE id = $1`,
    [id]
  );
}

export async function getAllUsers(): Promise<User[]> {
  return query<User>(
    `SELECT id, username, email, role, display_name, avatar_url, created_at, updated_at
     FROM users ORDER BY created_at DESC`
  );
}

export async function updateUserRole(id: string, role: UserRole): Promise<User | null> {
  return queryOne<User>(
    `UPDATE users SET role = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING id, username, email, role, display_name, avatar_url, created_at, updated_at`,
    [id, role]
  );
}
