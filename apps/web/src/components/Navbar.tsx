'use client';

import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useState } from 'react';

export default function Navbar() {
  const { user, logout, isAuthenticated } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-accent/10">
      <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center shadow-glow-sm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M3 18V6a9 9 0 0 1 18 0v12" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
            </div>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="font-bold text-sm tracking-tight text-white">RADIO</span>
            <span className="font-bold text-sm tracking-tight text-accent">LIVE</span>
          </div>
        </Link>

        <div className="flex items-center gap-1">
          <Link href="/listen" className="px-3 py-1.5 text-xs text-white/50 hover:text-accent transition-colors rounded-md hover:bg-surface-2">
            Listen
          </Link>

          {isAuthenticated && (user?.role === 'broadcaster' || user?.role === 'admin') && (
            <Link href="/broadcast" className="px-3 py-1.5 text-xs text-white/50 hover:text-accent transition-colors rounded-md hover:bg-surface-2">
              DJ Panel
            </Link>
          )}

          {isAuthenticated && user?.role === 'admin' && (
            <Link href="/admin" className="px-3 py-1.5 text-xs text-white/50 hover:text-accent transition-colors rounded-md hover:bg-surface-2">
              Admin
            </Link>
          )}

          {isAuthenticated ? (
            <div className="relative ml-1">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-2 px-2 py-1 text-xs text-white/60 hover:text-white transition-colors rounded-md hover:bg-surface-2"
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center text-[9px] font-bold text-white">
                  {user?.username?.[0]?.toUpperCase()}
                </div>
                <span className="hidden sm:inline">{user?.username}</span>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-44 bg-surface-2 border border-accent/10 rounded-lg overflow-hidden shadow-xl z-50">
                    <div className="px-3 py-2 border-b border-white/5">
                      <p className="text-[10px] text-accent uppercase tracking-widest font-medium">{user?.role}</p>
                    </div>
                    <button
                      onClick={() => { logout(); setMenuOpen(false); }}
                      className="w-full text-left px-3 py-2 text-xs text-white/60 hover:bg-surface-3 hover:text-accent transition-colors"
                    >
                      Sign Out
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Link
              href="/auth/login"
              className="ml-1 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs rounded-md font-semibold transition-all shadow-glow-sm"
            >
              Sign In
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
