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
    if (!isAuthenticated || user?.role !== 'admin') {
      router.push('/');
      return;
    }

    const fetchData = async () => {
      try {
        const token = getToken()!;
        const [statsRes, usersRes, broadcastsRes] = await Promise.all([
          api('/api/admin/stats', { token }),
          api('/api/admin/users', { token }),
          api('/api/admin/broadcasts?limit=20', { token }),
        ]);
        setStats(statsRes.data);
        setUsers(usersRes.data);
        setBroadcasts(broadcastsRes.data);
      } catch (err) {
        console.error('Failed to fetch admin data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated, user]);

  if (!isAuthenticated || user?.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-surface-0">
      <Navbar />

      <div className="pt-14 p-6 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-xs text-muted mt-1">System overview and management</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Total Broadcasts" value={stats?.totalBroadcasts || 0} />
              <StatCard label="Peak Listeners" value={stats?.peakListeners || 0} />
              <StatCard label="Avg Listeners" value={Math.round(stats?.averageListeners || 0)} />
              <StatCard label="Total Airtime" value={`${Math.floor((stats?.totalDuration || 0) / 3600)}h`} />
            </div>

            {/* Server Stats */}
            {stats?.server && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface-1 rounded-xl p-4 border border-white/5">
                  <p className="text-xs text-muted uppercase tracking-wider mb-2">CPU Load</p>
                  <p className="text-2xl font-bold">{stats.server.cpu.toFixed(2)}</p>
                  <div className="mt-2 h-1 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${Math.min(stats.server.cpu * 25, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="bg-surface-1 rounded-xl p-4 border border-white/5">
                  <p className="text-xs text-muted uppercase tracking-wider mb-2">Memory</p>
                  <p className="text-2xl font-bold">{stats.server.memory.used} MB</p>
                  <div className="mt-2 h-1 bg-surface-3 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent transition-all"
                      style={{ width: `${stats.server.memory.percentage}%` }}
                    />
                  </div>
                </div>
                <div className="bg-surface-1 rounded-xl p-4 border border-white/5">
                  <p className="text-xs text-muted uppercase tracking-wider mb-2">Uptime</p>
                  <p className="text-2xl font-bold">
                    {Math.floor(stats.server.uptime / 3600)}h {Math.floor((stats.server.uptime % 3600) / 60)}m
                  </p>
                </div>
              </div>
            )}

            {/* Users */}
            <div className="bg-surface-1 rounded-xl border border-white/5">
              <div className="p-4 border-b border-white/5">
                <h2 className="text-sm font-medium">Users ({users.length})</h2>
              </div>
              <div className="divide-y divide-white/5">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-surface-3 flex items-center justify-center text-xs font-medium">
                        {u.username[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{u.username}</p>
                        <p className="text-xs text-muted">{u.email}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider ${
                      u.role === 'admin' ? 'bg-accent/20 text-accent' :
                      u.role === 'broadcaster' ? 'bg-blue-500/20 text-blue-400' :
                      u.role === 'moderator' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-surface-3 text-muted'
                    }`}>
                      {u.role}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Broadcast History */}
            <div className="bg-surface-1 rounded-xl border border-white/5">
              <div className="p-4 border-b border-white/5">
                <h2 className="text-sm font-medium">Broadcast History</h2>
              </div>
              <div className="divide-y divide-white/5">
                {broadcasts.length === 0 ? (
                  <div className="p-8 text-center">
                    <p className="text-sm text-muted">No broadcasts yet</p>
                  </div>
                ) : (
                  broadcasts.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${b.is_live ? 'bg-accent animate-pulse' : 'bg-muted/30'}`} />
                        <div>
                          <p className="text-sm font-medium">{b.title}</p>
                          <p className="text-xs text-muted">
                            {b.broadcaster_name} &middot; {new Date(b.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted">{b.peak_listeners} peak</p>
                        <p className="text-xs text-muted">
                          {b.started_at && new Date(b.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {b.ended_at && ` - ${new Date(b.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-surface-1 rounded-xl p-4 border border-white/5">
      <p className="text-[10px] text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}
