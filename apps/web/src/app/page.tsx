'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Navbar from '@/components/Navbar';

export default function LandingPage() {
  const [activeBroadcast, setActiveBroadcast] = useState<any>(null);
  const [recentBroadcasts, setRecentBroadcasts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api('/api/broadcasts/active').then((res) => setActiveBroadcast(res.data)).catch(() => {});
    api('/api/broadcasts/recent?limit=5').then((res) => setRecentBroadcasts(res.data || [])).catch(() => {});
    api('/api/broadcasts/stats').then((res) => setStats(res.data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-accent/3 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center glow-red">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
                <path d="M3 18V6a9 9 0 0 1 18 0v12" />
                <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
              </svg>
            </div>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-4">
            Listen Together.
          </h1>
          <p className="text-lg text-muted mb-10 max-w-lg mx-auto">
            One live stream. Everyone hears the same thing.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/listen"
              className="px-6 py-3 bg-accent hover:bg-accent-hover text-white text-sm rounded-lg font-medium transition-all glow-red"
            >
              LISTEN LIVE
            </Link>
            <Link
              href="/broadcast"
              className="px-6 py-3 bg-surface-2 hover:bg-surface-3 text-white text-sm rounded-lg font-medium border border-white/5 transition-all"
            >
              START BROADCAST
            </Link>
          </div>

          {activeBroadcast && (
            <div className="mt-12 inline-flex items-center gap-3 px-4 py-2 rounded-full bg-surface-2/50 border border-white/5">
              <div className="live-dot" />
              <span className="text-xs text-white/70">
                LIVE NOW: {activeBroadcast.title}
              </span>
              <span className="text-xs text-muted">
                {activeBroadcast.listener_count} listeners
              </span>
            </div>
          )}
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-3xl font-bold text-white mb-1">
              {stats?.totalBroadcasts || 0}
            </div>
            <div className="text-xs text-muted uppercase tracking-wider">Broadcasts</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1">
              {stats?.peakListeners || 0}
            </div>
            <div className="text-xs text-muted uppercase tracking-wider">Peak Listeners</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-white mb-1">
              {Math.floor((stats?.totalDuration || 0) / 3600)}h
            </div>
            <div className="text-xs text-muted uppercase tracking-wider">Total Airtime</div>
          </div>
        </div>
      </section>

      {/* Recent Broadcasts */}
      {recentBroadcasts.length > 0 && (
        <section className="py-16 px-4 border-t border-white/5">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-lg font-semibold mb-6">Recent Broadcasts</h2>
            <div className="space-y-2">
              {recentBroadcasts.map((b: any) => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-surface-1 hover:bg-surface-2 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted">
                        <path d="M3 18V6a9 9 0 0 1 18 0v12" />
                        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium">{b.title}</p>
                      <p className="text-xs text-muted">{b.broadcaster_name}</p>
                    </div>
                  </div>
                  <div className="text-xs text-muted">
                    {b.peak_listeners} peak listeners
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-white/5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <p className="text-xs text-muted">RadioLive - Open Source Internet Radio</p>
          <div className="flex items-center gap-4">
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="text-xs text-muted hover:text-white transition-colors">
              GitHub
            </a>
            <a href="/docs" className="text-xs text-muted hover:text-white transition-colors">
              Docs
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
