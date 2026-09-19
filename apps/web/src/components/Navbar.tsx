'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useState } from 'react';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-accent flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <path d="M3 18V6a9 9 0 0 1 18 0v12" />
              <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
            </svg>
          </div>
          <span className="font-semibold text-sm tracking-tight">RadioLive</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link href="/listen" className="text-xs text-muted hover:text-white transition-colors">
            Listen
          </Link>

          {isAuthenticated && (user?.role === 'broadcaster' || user?.role === 'admin') && (
            <Link href="/broadcast" className="text-xs text-muted hover:text-white transition-colors">
              Broadcast
            </Link>
          )}

          {isAuthenticated && user?.role === 'admin' && (
            <Link href="/admin" className="text-xs text-muted hover:text-white transition-colors">
              Admin
            </Link>
          )}

          {isAuthenticated ? (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 text-xs text-white/70 hover:text-white transition-colors"
              >
                <div className="w-6 h-6 rounded-full bg-surface-3 flex items-center justify-center text-[10px] font-medium">
                  {user?.username?.[0]?.toUpperCase()}
                </div>
                {user?.username}
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-40 bg-surface-2 border border-white/5 rounded-lg overflow-hidden shadow-xl">
                  <div className="px-3 py-2 border-b border-white/5">
                    <p className="text-[10px] text-muted uppercase tracking-wider">{user?.role}</p>
                  </div>
                  <button
                    onClick={() => { logout(); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-2 text-xs text-white/70 hover:bg-surface-3 hover:text-white transition-colors"
                  >
                    Logout
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs rounded-md font-medium transition-colors"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
