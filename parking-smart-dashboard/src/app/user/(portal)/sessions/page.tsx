'use client';
import { useEffect, useState } from 'react';
import { getSessionsByUser, Session } from '@/lib/api';
import { Car, Clock, CheckCircle, Activity, RefreshCw } from 'lucide-react';

function getUser() {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('ps_user');
    return raw ? JSON.parse(raw) : null;
}

function duration(entry: string, exit?: string) {
    const ms = (exit ? new Date(exit) : new Date()).getTime() - new Date(entry).getTime();
    const m = Math.floor(ms / 60000);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}
function fmt(d: string) { return new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }

export default function UserSessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        const user = getUser();
        if (!user) return;
        setLoading(true);
        try { setSessions(await getSessionsByUser(user.id)); }
        catch { }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const active = sessions.filter(s => s.status === 'active');
    const completed = sessions.filter(s => s.status === 'completed');

    return (
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem', position: 'relative', zIndex: 1 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>History</span>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginTop: '0.2rem' }}>My Sessions</h1>
                    <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.35rem' }}>Every time your car entered and exited the parking</p>
                </div>
                <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem' }}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {[
                    { label: 'Currently Parked', value: active.length, color: '#10b981', grad: 'rgba(16,185,129,0.12)', icon: Activity },
                    { label: 'Completed', value: completed.length, color: '#818cf8', grad: 'rgba(99,102,241,0.12)', icon: CheckCircle },
                    { label: 'Total', value: sessions.length, color: '#06b6d4', grad: 'rgba(6,182,212,0.12)', icon: Car },
                ].map(({ label, value, color, grad, icon: Icon }) => (
                    <div key={label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={18} color={color} />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>{label}</p>
                            <p style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Active sessions CTA */}
            {active.length > 0 && (
                <div style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.06))', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '1rem', padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981', flexShrink: 0 }} className="pulse-dot" />
                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                        Your vehicle is currently <strong style={{ color: '#6ee7b7' }}>parked</strong>. Session timer is running.
                    </p>
                </div>
            )}

            {/* Table */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1.25rem', overflow: 'hidden' }}>
                <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white' }}>Parking History</h2>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
                </div>

                {loading ? (
                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '3.5rem', borderRadius: '0.75rem' }} />)}
                    </div>
                ) : sessions.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'rgba(255,255,255,0.2)' }}>
                        <Car size={36} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                        <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>No sessions yet</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>Sessions appear here after your vehicle enters the parking lot</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    {['#', 'Plate', 'Entry', 'Exit', 'Duration', 'Status'].map((h, i) => (
                                        <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {sessions.map((s, idx) => (
                                    <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.2)', fontSize: '0.75rem', fontFamily: 'monospace' }}>{idx + 1}</td>
                                        <td style={{ padding: '1rem', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#818cf8' }}>{s.plateNumber}</td>
                                        <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{fmt(s.entryTime)}</td>
                                        <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                                            {s.exitTime ? fmt(s.exitTime) : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <Clock size={12} style={{ opacity: 0.4 }} />
                                                {duration(s.entryTime, s.exitTime)}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: s.status === 'active' ? '#10b981' : '#818cf8', background: s.status === 'active' ? 'rgba(16,185,129,0.12)' : 'rgba(99,102,241,0.12)', border: `1px solid ${s.status === 'active' ? 'rgba(16,185,129,0.25)' : 'rgba(99,102,241,0.25)'}`, borderRadius: '99px', padding: '0.2rem 0.65rem' }}>{s.status}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
