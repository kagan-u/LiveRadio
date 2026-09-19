'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Navbar from '@/components/Navbar';

function EqBar({ delay }: { delay: number }) {
  const h = 8 + Math.random() * 20;
  return (
    <div
      className="freq-bar eq-bar"
      style={{ '--eq-height': `${h}px`, '--eq-delay': `${delay}s`, height: '4px' } as any}
    />
  );
}

export default function LandingPage() {
  const [activeBroadcast, setActiveBroadcast] = useState<any>(null);
  const [recentBroadcasts, setRecentBroadcasts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    api('/api/broadcasts/active').then((r) => setActiveBroadcast(r.data)).catch(() => {});
    api('/api/broadcasts/recent?limit=5').then((r) => setRecentBroadcasts(r.data || [])).catch(() => {});
    api('/api/broadcasts/stats').then((r) => setStats(r.data)).catch(() => {});
  }, []);

  return (
    <div className="min-h-screen noise-overlay">
      <Navbar />

      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0">
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-[120px]" />
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-accent/20 to-transparent" />
        </div>

        <div className="relative z-10 text-center px-4 max-w-3xl mx-auto">
          {/* Radio Icon with EQ */}
          <div className="flex items-end justify-center gap-1 mb-8">
            {[0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6].map((d) => (
              <EqBar key={d} delay={d} />
            ))}
          </div>

          <h1 className="text-6xl md:text-8xl font-black tracking-tighter mb-3">
            <span className="text-white">Listen</span>
            <span className="text-accent">.</span>
          </h1>
          <p className="text-xl md:text-2xl font-light text-white/40 mb-2 tracking-tight">
            Together.
          </p>
          <p className="text-sm text-white/25 mb-10 max-w-md mx-auto font-light">
            One live stream. Everyone hears the same thing. No delays. No compromises.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Link
              href="/listen"
              className="btn-radio btn-radio-primary px-8 py-3 text-sm font-bold tracking-wide"
            >
              <span className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                LISTEN LIVE
              </span>
            </Link>
            <Link
              href="/broadcast"
              className="btn-radio btn-radio-ghost px-8 py-3 text-sm font-bold tracking-wide"
            >
              <span className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="2" />
                  <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
                </svg>
                GO ON AIR
              </span>
            </Link>
          </div>

          {activeBroadcast && (
            <Link href="/listen" className="mt-12 inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-surface-2/60 border border-accent/15 hover:border-accent/30 transition-all group cursor-pointer">
              <div className="live-dot" />
              <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors">
                ON AIR
              </span>
              <span className="text-xs font-semibold text-accent">
                {activeBroadcast.title}
              </span>
              <span className="text-[10px] text-white/30">
                {activeBroadcast.listener_count || activeBroadcast.listenerCount || 0} listening
              </span>
            </Link>
          )}
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 px-4 border-t border-white/[0.03]">
        <div className="max-w-4xl mx-auto grid grid-cols-3 gap-8 text-center">
          <div>
            <div className="text-4xl font-black text-white mb-1">
              {stats?.totalBroadcasts || 0}
            </div>
            <div className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-medium">Broadcasts</div>
          </div>
          <div>
            <div className="text-4xl font-black text-accent mb-1">
              {stats?.peakListeners || 0}
            </div>
            <div className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-medium">Peak Listeners</div>
          </div>
          <div>
            <div className="text-4xl font-black text-white mb-1">
              {Math.floor((stats?.totalDuration || 0) / 3600)}h
            </div>
            <div className="text-[10px] text-white/30 uppercase tracking-[0.2em] font-medium">Airtime</div>
          </div>
        </div>
      </section>

      {/* Recent Broadcasts */}
      {recentBroadcasts.length > 0 && (
        <section className="py-16 px-4 border-t border-white/[0.03]">
          <div className="max-w-4xl mx-auto">
            <h2 className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-6">Recent Broadcasts</h2>
            <div className="space-y-1">
              {recentBroadcasts.map((b: any) => (
                <div key={b.id} className="track-item flex items-center justify-between p-3 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-surface-3 flex items-center justify-center">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-accent/50">
                        <path d="M3 18V6a9 9 0 0 1 18 0v12" />
                        <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white/80">{b.title}</p>
                      <p className="text-[11px] text-white/30">{b.broadcaster_name}</p>
                    </div>
                  </div>
                  <div className="text-[11px] text-white/20">
                    {b.peak_listeners || b.peakListeners || 0} peak
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="py-6 px-4 border-t border-white/[0.03]">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-accent/20 flex items-center justify-center">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
            </div>
            <p className="text-[10px] text-white/20 uppercase tracking-widest">RadioLive</p>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/kagan-u/LiveRadio" target="_blank" rel="noopener noreferrer" className="text-[10px] text-white/20 hover:text-accent transition-colors uppercase tracking-widest">
              GitHub
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
