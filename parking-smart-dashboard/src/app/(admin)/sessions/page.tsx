'use client';
import { useEffect, useState } from 'react';
import { getActiveSessions, getSessionHistory, deleteSession, Session } from '@/lib/api';
import { RefreshCw, Car, Clock, CheckCircle, Activity, Trash2 } from 'lucide-react';

type Tab = 'active' | 'history';

function duration(entry: string, exit?: string) {
    const ms = (exit ? new Date(exit) : new Date()).getTime() - new Date(entry).getTime();
    const m = Math.floor(ms / 60000);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export default function SessionsPage() {
    const [tab, setTab] = useState<Tab>('active');
    const [active, setActive] = useState<Session[]>([]);
    const [history, setHistory] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const [a, h] = await Promise.all([getActiveSessions(), getSessionHistory()]);
            setActive(a); setHistory(h);
        } catch { }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const handleDelete = async (id: string, status: string) => {
        const msg = status === 'active'
            ? 'This is an ACTIVE session. Deleting it will force-close the live parking record. Continue?'
            : 'Delete this session record? This cannot be undone.';
        if (!confirm(msg)) return;
        setDeleting(id);
        try {
            await deleteSession(id);
            await load();
        } catch (e) {
            alert('Failed to delete session');
        } finally {
            setDeleting(null);
        }
    };

    const rows = tab === 'active' ? active : history;

    const th = (label: string) => (
        <th key={label} style={{ paddingBottom: '0.875rem', paddingRight: '1.25rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
            {label}
        </th>
    );

    return (
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem', position: 'relative', zIndex: 1 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>
                        Monitoring
                    </span>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginTop: '0.2rem' }}>
                        Sessions
                    </h1>
                    <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.35rem' }}>
                        Active and completed parking sessions
                    </p>
                </div>
                <button
                    onClick={load}
                    id="refresh-sessions"
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.6rem 1rem',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '0.75rem',
                        color: 'rgba(255,255,255,0.5)',
                        cursor: 'pointer',
                        fontSize: '0.8rem',
                        fontFamily: 'inherit',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
                >
                    <RefreshCw size={14} />
                    Refresh
                </button>
            </div>

            {/* Summary Pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {[
                    { icon: Activity, label: 'Active Now', value: active.length, color: '#10b981', grad: 'rgba(16,185,129,0.12)' },
                    { icon: CheckCircle, label: 'Completed', value: history.filter(s => s.status === 'completed').length, color: '#818cf8', grad: 'rgba(99,102,241,0.12)' },
                    { icon: Clock, label: 'Total Sessions', value: active.length + history.length, color: '#06b6d4', grad: 'rgba(6,182,212,0.12)' },
                ].map(({ icon: Icon, label, value, color, grad }) => (
                    <div key={label} className="card" style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1.1rem 1.25rem' }}>
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: grad, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={18} color={color} />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)' }}>{label}</p>
                            <p style={{ fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Tab Bar */}
            <div style={{ display: 'flex', gap: '0.375rem', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '0.875rem', padding: '0.25rem', width: 'fit-content' }}>
                {(['active', 'history'] as Tab[]).map(t => (
                    <button
                        key={t}
                        id={`tab-${t}`}
                        onClick={() => setTab(t)}
                        style={{
                            padding: '0.5rem 1.25rem',
                            borderRadius: '0.65rem',
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: '0.83rem',
                            fontWeight: tab === t ? 700 : 500,
                            transition: 'all 0.2s',
                            background: tab === t ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'transparent',
                            color: tab === t ? 'white' : 'rgba(255,255,255,0.4)',
                            boxShadow: tab === t ? '0 2px 10px rgba(99,102,241,0.35)' : 'none',
                        }}
                    >
                        {t === 'active' ? `Active (${active.length})` : `History (${history.length})`}
                    </button>
                ))}
            </div>

            {/* Table */}
            <div className="card" style={{ padding: '0' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white' }}>
                        {tab === 'active' ? 'Active Sessions' : 'Session History'}
                    </h2>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>{rows.length} records</span>
                </div>

                {loading ? (
                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {[1, 2, 3, 4].map(i => <div key={i} className="skeleton" style={{ height: '3.5rem', borderRadius: '0.75rem' }} />)}
                    </div>
                ) : rows.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'rgba(255,255,255,0.2)' }}>
                        <Car size={36} style={{ margin: '0 auto 1rem', opacity: 0.25 }} />
                        <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>No {tab} sessions</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>Sessions appear here when cars enter the parking</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    <th style={{ width: '2.5rem', paddingLeft: '1.5rem' }} />
                                    {['Plate Number', 'Entry Time', 'Exit Time', 'Duration', 'Status', ''].map(h => th(h))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((s, idx) => (
                                    <tr key={s.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ paddingLeft: '1.5rem', paddingRight: '0.5rem', color: 'rgba(255,255,255,0.2)', fontSize: '0.72rem', fontFamily: 'monospace' }}>
                                            {idx + 1}
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem 1rem 0', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#818cf8' }}>
                                            {s.plateNumber}
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem 1rem 0', color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem' }}>
                                            {new Date(s.entryTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem 1rem 0', color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem' }}>
                                            {s.exitTime
                                                ? new Date(s.exitTime).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                                                : <span style={{ color: 'rgba(255,255,255,0.2)' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem 1rem 0', color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                                <Clock size={12} style={{ opacity: 0.4 }} />
                                                {duration(s.entryTime, s.exitTime)}
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem 1.25rem 1rem 0' }}>
                                            <span className={`badge ${s.status === 'active' ? 'badge-green' : 'badge-blue'}`}>{s.status}</span>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem 1rem 0' }}>
                                            {(
                                                <button
                                                    onClick={() => handleDelete(s.id, s.status)}
                                                    disabled={deleting === s.id}
                                                    title="Delete session record"
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: '0.35rem',
                                                        padding: '0.35rem 0.7rem',
                                                        background: 'rgba(244,63,94,0.08)',
                                                        border: '1px solid rgba(244,63,94,0.2)',
                                                        borderRadius: '0.5rem',
                                                        color: '#f43f5e',
                                                        cursor: deleting === s.id ? 'not-allowed' : 'pointer',
                                                        fontFamily: 'inherit',
                                                        fontSize: '0.75rem',
                                                        fontWeight: 600,
                                                        opacity: deleting === s.id ? 0.5 : 1,
                                                        transition: 'all 0.2s',
                                                        whiteSpace: 'nowrap',
                                                    }}
                                                    onMouseEnter={e => {
                                                        if (deleting !== s.id) {
                                                            (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.18)';
                                                            (e.currentTarget as HTMLElement).style.borderColor = 'rgba(244,63,94,0.4)';
                                                        }
                                                    }}
                                                    onMouseLeave={e => {
                                                        (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.08)';
                                                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(244,63,94,0.2)';
                                                    }}
                                                >
                                                    <Trash2 size={12} />
                                                    {deleting === s.id ? '…' : 'Delete'}
                                                </button>
                                            )}
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
