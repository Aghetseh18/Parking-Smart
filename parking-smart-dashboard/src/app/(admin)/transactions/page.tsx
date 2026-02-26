'use client';
import { useEffect, useState } from 'react';
import { getTransactions, deleteTransaction, Transaction } from '@/lib/api';
import { RefreshCw, TrendingUp, DollarSign, Hash, ArrowUpRight, Trash2 } from 'lucide-react';

export default function TransactionsPage() {
    const [rows, setRows] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try { setRows(await getTransactions()); }
        catch { }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this transaction record? This cannot be undone.')) return;
        setDeleting(id);
        try {
            await deleteTransaction(id);
            await load();
        } catch {
            alert('Failed to delete transaction');
        } finally {
            setDeleting(null);
        }
    };

    const total = rows.reduce((s, t) => s + (t.amount ?? 0), 0);
    const today = rows.filter(t => new Date(t.createdAt).toDateString() === new Date().toDateString())
        .reduce((s, t) => s + (t.amount ?? 0), 0);
    const avgAmount = rows.length ? Math.round(total / rows.length) : 0;

    return (
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem', position: 'relative', zIndex: 1 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>Finance</span>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginTop: '0.2rem' }}>Transactions</h1>
                    <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.35rem' }}>Billing history for all completed sessions</p>
                </div>
                <button
                    onClick={load}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        padding: '0.6rem 1rem',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: '0.75rem', color: 'rgba(255,255,255,0.5)',
                        cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem',
                        transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
                >
                    <RefreshCw size={14} />
                    Refresh
                </button>
            </div>

            {/* Summary Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {[
                    {
                        label: 'Total Revenue', value: `${total.toLocaleString()}`, unit: 'CFA',
                        sub: 'All time · all sessions', icon: DollarSign, color: '#10b981',
                        grad: 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(16,185,129,0.08))',
                    },
                    {
                        label: "Today's Revenue", value: `${today.toLocaleString()}`, unit: 'CFA',
                        sub: new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }),
                        icon: TrendingUp, color: '#818cf8',
                        grad: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.08))',
                    },
                    {
                        label: 'Total Transactions', value: rows.length.toString(), unit: 'records',
                        sub: `Avg ${avgAmount.toLocaleString()} CFA / session`, icon: Hash, color: '#ec4899',
                        grad: 'linear-gradient(135deg, rgba(236,72,153,0.2), rgba(236,72,153,0.08))',
                    },
                ].map(c => (
                    <div key={c.label} className="card stat-card" style={{ position: 'relative', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                            <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.875rem', background: c.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${c.color}25` }}>
                                <c.icon size={20} color={c.color} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.7rem', fontWeight: 600, color: c.color, background: `${c.color}15`, border: `1px solid ${c.color}30`, borderRadius: '99px', padding: '0.2rem 0.55rem' }}>
                                <ArrowUpRight size={11} />
                                Live
                            </div>
                        </div>
                        <p style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', marginBottom: '0.4rem' }}>{c.label}</p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.4rem' }}>
                            <span style={{ fontSize: '1.9rem', fontWeight: 800, color: 'white', letterSpacing: '-0.03em', lineHeight: 1 }}>{c.value}</span>
                            <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>{c.unit}</span>
                        </div>
                        <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)', marginTop: '0.4rem' }}>{c.sub}</p>
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: c.grad, borderRadius: '0 0 1.25rem 1.25rem', opacity: 0.7 }} />
                    </div>
                ))}
            </div>

            {/* Table */}
            <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white' }}>Transaction History</h2>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>{rows.length} records</span>
                </div>

                {loading ? (
                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton" style={{ height: '3.5rem', borderRadius: '0.75rem' }} />)}
                    </div>
                ) : rows.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'rgba(255,255,255,0.2)' }}>
                        <DollarSign size={36} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                        <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>No transactions yet</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>Transactions appear after sessions are completed</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    {['#', 'Plate', 'Session ID', 'Duration', 'Amount', 'Date', 'Status', ''].map((h, i) => (
                                        <th key={h} style={{ padding: '0.875rem 1rem 0.875rem ' + (i === 0 ? '1.5rem' : '0'), textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((t, idx) => (
                                    <tr key={t.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '1rem 1rem 1rem 1.5rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>
                                            {idx + 1}
                                        </td>
                                        <td style={{ padding: '1rem 1rem 1rem 0', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#818cf8', fontSize: '0.82rem' }}>
                                            {(t as any).plateNumber ?? '—'}
                                        </td>
                                        <td style={{ padding: '1rem 1rem 1rem 0', fontFamily: "'JetBrains Mono', monospace", color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>
                                            {t.sessionId?.slice(0, 13)}…
                                        </td>
                                        <td style={{ padding: '1rem 1rem 1rem 0', color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem' }}>
                                            {Math.floor((t.duration ?? 0) / 60)} min
                                        </td>
                                        <td style={{ padding: '1rem 1rem 1rem 0' }}>
                                            <span style={{ fontWeight: 800, color: '#10b981', fontSize: '0.95rem' }}>
                                                {(t.amount ?? 0).toLocaleString()}
                                            </span>
                                            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', marginLeft: '0.3rem' }}>CFA</span>
                                        </td>
                                        <td style={{ padding: '1rem 1rem 1rem 0', color: 'rgba(255,255,255,0.45)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                            {new Date(t.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td style={{ padding: '1rem 1rem 1rem 0' }}>
                                            <span className="badge badge-green">Paid</span>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem 1rem 0' }}>
                                            <button
                                                onClick={() => handleDelete(t.id)}
                                                disabled={deleting === t.id}
                                                title="Delete transaction record"
                                                style={{
                                                    display: 'flex', alignItems: 'center', gap: '0.35rem',
                                                    padding: '0.35rem 0.7rem',
                                                    background: 'rgba(244,63,94,0.08)',
                                                    border: '1px solid rgba(244,63,94,0.2)',
                                                    borderRadius: '0.5rem',
                                                    color: '#f43f5e',
                                                    cursor: deleting === t.id ? 'not-allowed' : 'pointer',
                                                    fontFamily: 'inherit',
                                                    fontSize: '0.75rem',
                                                    fontWeight: 600,
                                                    opacity: deleting === t.id ? 0.5 : 1,
                                                    transition: 'all 0.2s',
                                                    whiteSpace: 'nowrap',
                                                }}
                                                onMouseEnter={e => {
                                                    if (deleting !== t.id) {
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
                                                {deleting === t.id ? '…' : 'Delete'}
                                            </button>
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
