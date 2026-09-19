'use client';

import { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/Navbar';

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      router.push('/');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface-0 noise-overlay">
      <Navbar />
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="w-full max-w-sm">
          <div className="bg-surface-1 rounded-2xl p-6 border border-white/[0.04]">
            <div className="text-center mb-6">
              <h1 className="text-xl font-bold mb-1">Welcome Back</h1>
              <p className="text-xs text-white/25">Sign in to your account</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-1.5 font-medium">Email</label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required
                  className="w-full px-3 py-2.5 bg-surface-2 border border-white/5 rounded-xl text-sm text-white placeholder:text-white/15" />
              </div>
              <div>
                <label className="block text-[10px] text-white/30 uppercase tracking-widest mb-1.5 font-medium">Password</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required
                  className="w-full px-3 py-2.5 bg-surface-2 border border-white/5 rounded-xl text-sm text-white placeholder:text-white/15" />
              </div>
              {error && (
                <div className="px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-xs text-red-400">{error}</p>
                </div>
              )}
              <button type="submit" disabled={loading}
                className="btn-radio btn-radio-primary w-full py-2.5 text-sm font-bold disabled:opacity-50">
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
            <p className="text-xs text-white/20 text-center mt-4">
              New here? <Link href="/auth/register" className="text-accent hover:text-accent-hover transition-colors font-medium">Create account</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
