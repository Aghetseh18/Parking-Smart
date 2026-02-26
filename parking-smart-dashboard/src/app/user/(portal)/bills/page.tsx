'use client';
import { useEffect, useState } from 'react';
import { getTransactionsByUser, Transaction } from '@/lib/api';
import { Receipt, TrendingUp, DollarSign, Hash, RefreshCw, ArrowUpRight } from 'lucide-react';

function getUser() {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('ps_user');
    return raw ? JSON.parse(raw) : null;
}
function fmt(d: string) { return new Date(d).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }

export default function UserBillsPage() {
    const [bills, setBills] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);

    const load = async () => {
        const user = getUser();
        if (!user) return;
        setLoading(true);
        try { setBills(await getTransactionsByUser(user.id)); }
        catch { }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const total = bills.reduce((s, b) => s + (b.amount ?? 0), 0);
    const today = bills.filter(b => new Date(b.createdAt).toDateString() === new Date().toDateString()).reduce((s, b) => s + (b.amount ?? 0), 0);
    const avgAmount = bills.length ? Math.round(total / bills.length) : 0;

    return (
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem', position: 'relative', zIndex: 1 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>Finance</span>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginTop: '0.2rem' }}>My Bills</h1>
                    <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.35rem' }}>Payment history for all your completed parking sessions</p>
                </div>
                <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem' }}>
                    <RefreshCw size={13} /> Refresh
                </button>
            </div>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {[
                    { label: 'Total Spent', value: `${total.toLocaleString()}`, unit: 'CFA', sub: 'All time', icon: DollarSign, color: '#10b981', grad: 'linear-gradient(135deg, rgba(16,185,129,0.18), rgba(16,185,129,0.06))' },
                    { label: "Today's Spending", value: `${today.toLocaleString()}`, unit: 'CFA', sub: new Date().toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' }), icon: TrendingUp, color: '#818cf8', grad: 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(99,102,241,0.06))' },
                    { label: 'Total Bills', value: bills.length.toString(), unit: 'records', sub: `Avg ${avgAmount.toLocaleString()} CFA/session`, icon: Hash, color: '#ec4899', grad: 'linear-gradient(135deg, rgba(236,72,153,0.18), rgba(236,72,153,0.06))' },
                ].map(c => (
                    <div key={c.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1.25rem', padding: '1.25rem 1.5rem', position: 'relative', overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '1rem' }}>
                            <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.875rem', background: c.grad, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 14px ${c.color}20` }}>
                                <c.icon size={20} color={c.color} />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.68rem', fontWeight: 600, color: c.color, background: `${c.color}15`, border: `1px solid ${c.color}25`, borderRadius: '99px', padding: '0.18rem 0.5rem' }}>
                                <ArrowUpRight size={10} /> Live
                            </div>
                        </div>
                        <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)', marginBottom: '0.35rem' }}>{c.label}</p>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
                            <span style={{ fontSize: '1.8rem', fontWeight: 800, color: 'white', letterSpacing: '-0.03em', lineHeight: 1 }}>{c.value}</span>
                            <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.3)' }}>{c.unit}</span>
                        </div>
                        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.35rem' }}>{c.sub}</p>
                        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: c.grad, opacity: 0.7 }} />
                    </div>
                ))}
            </div>

            {/* Bills table */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1.25rem', overflow: 'hidden' }}>
                <div style={{ padding: '1.1rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white' }}>Transaction History</h2>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>{bills.length} record{bills.length !== 1 ? 's' : ''}</span>
                </div>

                {loading ? (
                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '3.5rem', borderRadius: '0.75rem' }} />)}
                    </div>
                ) : bills.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'rgba(255,255,255,0.2)' }}>
                        <Receipt size={36} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                        <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>No bills yet</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>Bills are generated automatically when you exit the parking</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    {['#', 'Date', 'Plate', 'Duration', 'Amount', 'Status'].map(h => (
                                        <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {bills.map((b, idx) => (
                                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '1rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.25)', fontFamily: 'monospace' }}>{idx + 1}</td>
                                        <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{fmt(b.createdAt)}</td>
                                        <td style={{ padding: '1rem', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#818cf8', fontSize: '0.82rem' }}>{b.plateNumber}</td>
                                        <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem' }}>{Math.floor((b.duration ?? 0) / 60)} min</td>
                                        <td style={{ padding: '1rem' }}>
                                            <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
                                                <span style={{ fontWeight: 800, color: '#10b981', fontSize: '1rem' }}>{(b.amount ?? 0).toLocaleString()}</span>
                                                <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)' }}>CFA</span>
                                            </div>
                                        </td>
                                        <td style={{ padding: '1rem' }}>
                                            <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#10b981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '99px', padding: '0.2rem 0.65rem' }}>Paid</span>
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
