'use client';
import { useEffect, useState } from 'react';
import { getStats, getActiveSessions, Stats, Session } from '@/lib/api';
import {
  ParkingCircle, Car, CalendarClock, TrendingUp,
  Clock, RefreshCw, Zap, ArrowUpRight
} from 'lucide-react';

function StatCard({
  icon: Icon, label, value, sub, gradient, iconColor, accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  gradient: string;
  iconColor: string;
  accent: string;
}) {
  return (
    <div className="card stat-card fade-in" style={{ padding: '1.5rem' }}>
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
        <div style={{
          width: '2.75rem', height: '2.75rem', borderRadius: '0.875rem',
          background: gradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 4px 16px ${iconColor}33`,
        }}>
          <Icon size={20} color={iconColor} />
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.25rem',
          fontSize: '0.7rem', fontWeight: 600, color: iconColor,
          background: `${iconColor}15`, border: `1px solid ${iconColor}30`,
          borderRadius: '99px', padding: '0.2rem 0.55rem',
        }}>
          <ArrowUpRight size={11} />
          Live
        </div>
      </div>

      {/* Value */}
      <div>
        <p style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', marginBottom: '0.4rem' }}>
          {label}
        </p>
        <p style={{ fontSize: '2rem', fontWeight: 800, color: 'white', letterSpacing: '-0.03em', lineHeight: 1 }}>
          {value}
        </p>
        {sub && (
          <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.4rem' }}>
            {sub}
          </p>
        )}
      </div>

      {/* Bottom accent line */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px',
        background: gradient, borderRadius: '0 0 1.25rem 1.25rem', opacity: 0.6,
      }} />
    </div>
  );
}

function Skeleton({ h = 'h-32' }: { h?: string }) {
  return <div className={`skeleton ${h} rounded-2xl`} />;
}

function duration(entry: string) {
  const m = Math.floor((Date.now() - new Date(entry).getTime()) / 60000);
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLast] = useState(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const load = async (manual = false) => {
    if (manual) setRefreshing(true);
    try {
      const [s, a] = await Promise.all([getStats(), getActiveSessions()]);
      setStats(s);
      setSessions(a);
    } catch { /* show partial */ }
    finally {
      setLoading(false);
      setLast(new Date());
      if (manual) setTimeout(() => setRefreshing(false), 600);
    }
  };

  useEffect(() => {
    load();
    // Polling fallback — every 30 s (SSE handles instant updates below)
    const t = setInterval(load, 30000);

    // SSE — instant push from server when spots or gate change
    const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const es = new EventSource(`${BASE}/api/dashboard/live`);
    es.addEventListener('spots_updated', () => load());
    es.addEventListener('gate_event', () => load());
    es.onerror = () => es.close();

    return () => { clearInterval(t); es.close(); };
  }, []);

  const occupancy = stats ? Math.round((stats.occupiedSpots / stats.totalSpots) * 100) : 0;
  const occupancyGrad = occupancy > 85
    ? 'linear-gradient(90deg, #f43f5e, #f97316)'
    : occupancy > 60
      ? 'linear-gradient(90deg, #f59e0b, #10b981)'
      : 'linear-gradient(90deg, #6366f1, #10b981)';

  return (
    <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem', position: 'relative', zIndex: 1 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: '0.4rem' }}>
            <div style={{
              width: '8px', height: '8px', borderRadius: '50%',
              background: '#10b981', boxShadow: '0 0 8px #10b981',
            }} className="pulse-dot" />
            <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>
              Live Dashboard
            </span>
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', lineHeight: 1 }}>
            Overview
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.35rem' }}>
            Auto-refreshes every 15 seconds
          </p>
        </div>

        <button
          onClick={() => load(true)}
          id="refresh-btn"
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.6rem 1.1rem',
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '0.875rem',
            color: 'rgba(255,255,255,0.6)',
            cursor: 'pointer',
            fontSize: '0.8rem',
            fontWeight: 500,
            transition: 'all 0.2s',
            fontFamily: 'inherit',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLElement).style.color = 'white';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.18)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)';
            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)';
          }}
        >
          <RefreshCw size={14} style={{ transition: 'transform 0.6s', transform: refreshing ? 'rotate(360deg)' : 'rotate(0deg)' }} />
          {lastRefresh.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </button>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem' }}>
        {loading ? (
          [1, 2, 3, 4].map(i => <Skeleton key={i} />)
        ) : (
          <>
            <StatCard
              icon={ParkingCircle}
              label="Available Spots"
              value={stats?.availableSpots ?? '—'}
              sub={`of ${stats?.totalSpots ?? 0} total spots`}
              gradient="linear-gradient(135deg, #6366f120, #6366f108)"
              iconColor="#818cf8"
              accent="#6366f1"
            />
            <StatCard
              icon={Car}
              label="Active Sessions"
              value={stats?.occupiedSpots ?? '—'}
              sub={`${occupancy}% occupancy rate`}
              gradient="linear-gradient(135deg, #10b98120, #10b98108)"
              iconColor="#10b981"
              accent="#10b981"
            />
            <StatCard
              icon={CalendarClock}
              label="Reserved Spots"
              value={stats?.reservedSpots ?? '—'}
              sub="pending reservations"
              gradient="linear-gradient(135deg, #f59e0b20, #f59e0b08)"
              iconColor="#f59e0b"
              accent="#f59e0b"
            />
            <StatCard
              icon={TrendingUp}
              label="Revenue Today"
              value={`${(stats?.revenueToday ?? 0).toLocaleString()}`}
              sub="CFA · all completed sessions"
              gradient="linear-gradient(135deg, #ec489920, #ec489908)"
              iconColor="#ec4899"
              accent="#ec4899"
            />
          </>
        )}
      </div>

      {/* Occupancy + Active Sessions row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.8fr', gap: '1rem' }}>

        {/* Occupancy Panel */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div>
            <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: '0.25rem' }}>
              Parking Occupancy
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
              <span style={{ fontSize: '2.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.04em', lineHeight: 1 }}>
                {occupancy}
              </span>
              <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>%</span>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${occupancy}%`,
              borderRadius: '99px',
              background: occupancyGrad,
              transition: 'width 0.8s cubic-bezier(.4,0,.2,1)',
              boxShadow: occupancy > 85 ? '0 0 12px rgba(244,63,94,0.5)' : '0 0 12px rgba(99,102,241,0.4)',
            }} />
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {[
              { label: 'Available', count: stats?.availableSpots ?? 0, color: '#10b981' },
              { label: 'Occupied', count: stats?.occupiedSpots ?? 0, color: '#f43f5e' },
              { label: 'Reserved', count: stats?.reservedSpots ?? 0, color: '#f59e0b' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: item.color, boxShadow: `0 0 6px ${item.color}80` }} />
                  <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}>{item.label}</span>
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'white' }}>{item.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Live Sessions Table */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
              <div style={{
                width: '8px', height: '8px', borderRadius: '50%',
                background: '#10b981', boxShadow: '0 0 8px #10b981',
              }} className="pulse-dot" />
              <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white' }}>Active Sessions</h2>
            </div>
            <span className="badge badge-green">{sessions.length} live</span>
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '3rem', borderRadius: '0.75rem' }} />)}
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 0', color: 'rgba(255,255,255,0.2)' }}>
              <Car size={32} style={{ margin: '0 auto 0.75rem', opacity: 0.3 }} />
              <p style={{ fontSize: '0.85rem' }}>No active sessions right now</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    {['Plate', 'Entry Time', 'Duration', 'Status'].map(h => (
                      <th key={h} style={{ paddingBottom: '0.75rem', paddingRight: '1rem', textAlign: 'left', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(s => (
                    <tr key={s.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                      <td style={{ padding: '0.85rem 1rem 0.85rem 0', fontFamily: "'JetBrains Mono', monospace", fontWeight: 600, color: '#818cf8', fontSize: '0.85rem' }}>
                        {s.plateNumber}
                      </td>
                      <td style={{ padding: '0.85rem 1rem 0.85rem 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>
                        {new Date(s.entryTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td style={{ padding: '0.85rem 1rem 0.85rem 0', color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          <Clock size={12} style={{ opacity: 0.5 }} />
                          {duration(s.entryTime)}
                        </div>
                      </td>
                      <td style={{ padding: '0.85rem 0' }}>
                        <span className="badge badge-green">Active</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Bottom info strip */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '1.5rem',
        padding: '0.875rem 1.25rem',
        background: 'rgba(255,255,255,0.02)',
        border: '1px solid rgba(255,255,255,0.05)',
        borderRadius: '0.875rem',
      }}>
        <Zap size={14} color="rgba(255,255,255,0.3)" />
        <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>
          Rate: <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>500 CFA / hour</span>
        </span>
        <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.08)' }} />
        <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>
          Total capacity: <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>{stats?.totalSpots ?? '—'} spots</span>
        </span>
        <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.08)' }} />
        <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>
          Last updated: <span style={{ color: 'rgba(255,255,255,0.5)', fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem' }}>{lastRefresh.toLocaleTimeString()}</span>
        </span>
      </div>
    </div>
  );
}
