'use client';

import { useEffect, useState } from 'react';
import { api, getToken } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Navbar from '@/components/Navbar';
import { useRouter } from 'next/navigation';

export default function AdminPage() {
  const { user, isAuthenticated } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [broadcasts, setBroadcasts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'admin') { router.push('/'); return; }
    const fetchData = async () => {
      try {
        const token = getToken()!;
        const [s, u, b] = await Promise.all([
          api('/api/admin/stats', { token }),
          api('/api/admin/users', { token }),
          api('/api/admin/broadcasts?limit=20', { token }),
        ]);
        setStats(s.data);
        setUsers(u.data);
        setBroadcasts(b.data);
      } catch {} finally { setLoading(false); }
    };
    fetchData();
    const i = setInterval(fetchData, 10000);
    return () => clearInterval(i);
  }, [isAuthenticated, user]);

  if (!isAuthenticated || user?.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-surface-0 noise-overlay">
      <Navbar />
      <div className="pt-12 p-4 max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-xl font-bold tracking-tight"><span className="text-white/60">Admin</span> <span className="text-accent">Dashboard</span></h1>
          <p className="text-[10px] text-white/25 uppercase tracking-[0.15em] mt-1">System overview</p>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Broadcasts', value: stats?.totalBroadcasts || 0 },
                { label: 'Peak Listeners', value: stats?.peakListeners || 0 },
                { label: 'Avg Listeners', value: Math.round(stats?.averageListeners || 0) },
                { label: 'Airtime', value: `${Math.floor((stats?.totalDuration || 0) / 3600)}h` },
              ].map((s) => (
                <div key={s.label} className="bg-surface-1 rounded-xl p-4 border border-white/[0.04]">
                  <p className="text-[9px] text-white/25 uppercase tracking-[0.15em] mb-1">{s.label}</p>
                  <p className="text-2xl font-black">{s.value}</p>
                </div>
              ))}
            </div>

            {stats?.server && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-surface-1 rounded-xl p-4 border border-white/[0.04]">
                  <p className="text-[9px] text-white/25 uppercase tracking-[0.15em] mb-2">CPU</p>
                  <p className="text-xl font-bold">{stats.server.cpu.toFixed(2)}</p>
                  <div className="mt-2 h-1 bg-surface-3 rounded-full overflow-hidden">
                    <div className="h-full bg-accent transition-all" style={{ width: `${Math.min(stats.server.cpu * 25, 100)}%` }} />
                  </div>
                </div>
                <div className="bg-surface-1 rounded-xl p-4 border border-white/[0.04]">
                  <p className="text-[9px] text-white/25 uppercase tracking-[0.15em] mb-2">Memory</p>
                  <p className="text-xl font-bold">{stats.server.memory.used} MB</p>
                  <div className="mt-2 h-1 bg-surface-3 rounded-full overflow-hidden">
                    <div className="h-full bg-accent transition-all" style={{ width: `${stats.server.memory.percentage}%` }} />
                  </div>
                </div>
                <div className="bg-surface-1 rounded-xl p-4 border border-white/[0.04]">
                  <p className="text-[9px] text-white/25 uppercase tracking-[0.15em] mb-2">Uptime</p>
                  <p className="text-xl font-bold">{Math.floor(stats.server.uptime / 3600)}h {Math.floor((stats.server.uptime % 3600) / 60)}m</p>
                </div>
              </div>
            )}

            <div className="bg-surface-1 rounded-xl border border-white/[0.04]">
              <div className="p-4 border-b border-white/[0.03]">
                <h2 className="text-xs font-bold uppercase tracking-wider">Users ({users.length})</h2>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent to-accent-dim flex items-center justify-center text-[10px] font-bold text-white">
                        {u.username[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{u.username}</p>
                        <p className="text-[10px] text-white/20">{u.email}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider ${
                      u.role === 'admin' ? 'bg-accent/20 text-accent' :
                      u.role === 'broadcaster' ? 'bg-blue-500/20 text-blue-400' :
                      'bg-surface-3 text-white/30'
                    }`}>{u.role}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-surface-1 rounded-xl border border-white/[0.04]">
              <div className="p-4 border-b border-white/[0.03]">
                <h2 className="text-xs font-bold uppercase tracking-wider">Broadcast History</h2>
              </div>
              <div className="divide-y divide-white/[0.03]">
                {broadcasts.length === 0 ? (
                  <div className="p-8 text-center"><p className="text-xs text-white/15">No broadcasts yet</p></div>
                ) : broadcasts.map((b) => (
                  <div key={b.id} className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${b.isLive ? 'bg-accent animate-pulse' : 'bg-white/10'}`} />
                      <div>
                        <p className="text-sm font-medium">{b.title}</p>
                        <p className="text-[10px] text-white/20">{b.broadcaster_name} · {new Date(b.createdAt || b.created_at).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <p className="text-[10px] text-white/15">{b.peakListeners || b.peak_listeners || 0} peak</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
