'use client';
import { useEffect, useState, FormEvent } from 'react';
import { getUserReservations, createReservation, cancelReservation, Reservation } from '@/lib/api';
import { Plus, X, CalendarClock, CheckCircle, XCircle, Clock, RefreshCw, ParkingCircle } from 'lucide-react';

function getUser() {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem('ps_user');
    return raw ? JSON.parse(raw) : null;
}

const statusColor = (s: string) =>
    s === 'pending' ? ['#f59e0b', 'rgba(245,158,11,0.12)', 'rgba(245,158,11,0.25)'] :
        s === 'active' ? ['#10b981', 'rgba(16,185,129,0.12)', 'rgba(16,185,129,0.25)'] :
            s === 'expired' ? ['rgba(255,255,255,0.35)', 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.1)'] :
                ['#f43f5e', 'rgba(244,63,94,0.12)', 'rgba(244,63,94,0.25)'];  // cancelled

function fmt(d: string) { return new Date(d).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }

export default function UserReservationsPage() {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [cancelling, setCancelling] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Form state
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const localDT = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    const defaultFrom = localDT(now);
    const defaultUntil = localDT(new Date(now.getTime() + 2 * 3600_000));
    const [from, setFrom] = useState(defaultFrom);
    const [until, setUntil] = useState(defaultUntil);
    const [plate, setPlate] = useState('');   // user can override or use their registered plate

    const user = getUser();

    const load = async () => {
        if (!user) return;
        setLoading(true);
        try { setReservations(await getUserReservations(user.id)); }
        catch { }
        finally { setLoading(false); }
    };
    useEffect(() => {
        if (user) setPlate(user.vehiclePlateNumber ?? '');
        load();
    }, []);

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setError(''); setSuccess('');
        if (!user) return;
        try {
            const res = await createReservation({
                userId: user.id,
                plateNumber: plate.toUpperCase().trim(),
                reservedFrom: new Date(from).toISOString(),
                reservedUntil: new Date(until).toISOString(),
            });
            setSuccess(`✅ Reserved Spot #${res.spotNumber}! Gate opens when your plate ${res.plateNumber} is scanned.`);
            setShowForm(false);
            load();
        } catch (e: any) {
            setError(e.message ?? 'Failed to create reservation');
        }
    };

    const cancel = async (id: string) => {
        if (!confirm('Cancel this reservation?')) return;
        setCancelling(id);
        try { await cancelReservation(id); load(); }
        catch { alert('Failed to cancel'); }
        finally { setCancelling(null); }
    };

    const pending = reservations.filter(r => r.status === 'pending').length;

    return (
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem', position: 'relative', zIndex: 1 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
                <div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>Booking</span>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginTop: '0.2rem' }}>My Reservations</h1>
                    <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.35rem' }}>Reserve in advance — gate opens automatically when your plate is scanned</p>
                </div>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button onClick={load} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem' }}>
                        <RefreshCw size={13} /> Refresh
                    </button>
                    <button onClick={() => { setShowForm(true); setError(''); setSuccess(''); }} id="new-reservation-btn" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 1.1rem', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: '0.75rem', color: 'white', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.83rem', boxShadow: '0 4px 14px rgba(99,102,241,0.3)', transition: 'all 0.2s' }}>
                        <Plus size={15} /> Reserve a Spot
                    </button>
                </div>
            </div>

            {/* Success / Error banners */}
            {success && <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '0.75rem', padding: '0.875rem 1.25rem', fontSize: '0.85rem', color: '#6ee7b7', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>{success}<button onClick={() => setSuccess('')} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}><X size={14} /></button></div>}

            {/* Create form (modal-like) */}
            {showForm && (
                <div style={{ background: 'rgba(15,15,20,0.7)', position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', backdropFilter: 'blur(8px)' }}>
                    <div style={{ background: '#16161f', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1.25rem', padding: '2rem', width: '100%', maxWidth: '440px', position: 'relative' }}>
                        <button onClick={() => setShowForm(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.5rem', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '0.3rem' }}><X size={15} /></button>
                        <h2 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'white', marginBottom: '1.5rem' }}>New Reservation</h2>
                        <form onSubmit={submit} id="reservation-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

                            <div>
                                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: '0.4rem' }}>Plate number <span style={{ color: '#f43f5e' }}>*</span></label>
                                <input id="res-plate" value={plate} onChange={e => setPlate(e.target.value)} required placeholder="ABC1234" style={{ width: '100%', padding: '0.7rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.65rem', color: 'white', fontSize: '0.9rem', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, letterSpacing: '0.05em', outline: 'none', boxSizing: 'border-box' }} onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }} />
                                <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.25rem' }}>Pre-filled from your registered plate. Change only if parking a different vehicle.</p>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.875rem' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: '0.4rem' }}>From</label>
                                    <input id="res-from" type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} required style={{ width: '100%', padding: '0.7rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.65rem', color: 'white', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }} onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }} />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: '0.4rem' }}>Until</label>
                                    <input id="res-until" type="datetime-local" value={until} onChange={e => setUntil(e.target.value)} required style={{ width: '100%', padding: '0.7rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.65rem', color: 'white', fontSize: '0.82rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', colorScheme: 'dark' }} onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; }} onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }} />
                                </div>
                            </div>

                            {error && <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '0.65rem', padding: '0.6rem 0.875rem', fontSize: '0.8rem', color: '#f87171' }}>{error}</div>}

                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.25rem' }}>
                                <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: '0.75rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', color: 'rgba(255,255,255,0.6)', fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                <button type="submit" id="submit-reservation" style={{ flex: 2, padding: '0.75rem', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: '0.75rem', color: 'white', fontFamily: 'inherit', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}>Confirm Reservation</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Stats pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
                {[
                    { label: 'Pending', value: pending, color: '#f59e0b', grad: 'rgba(245,158,11,0.12)', icon: Clock },
                    { label: 'Active', value: reservations.filter(r => r.status === 'active').length, color: '#10b981', grad: 'rgba(16,185,129,0.12)', icon: CheckCircle },
                    { label: 'Total', value: reservations.length, color: '#818cf8', grad: 'rgba(99,102,241,0.12)', icon: CalendarClock },
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

            {/* Table */}
            <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1.25rem', overflow: 'hidden' }}>
                {loading ? (
                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '3.5rem', borderRadius: '0.75rem' }} />)}
                    </div>
                ) : reservations.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'rgba(255,255,255,0.2)' }}>
                        <CalendarClock size={36} style={{ margin: '0 auto 1rem', opacity: 0.25 }} />
                        <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>No reservations yet</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>Click "Reserve a Spot" to book in advance</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    {['Plate', 'Spot', 'From', 'Until', 'Status', ''].map(h => (
                                        <th key={h} style={{ padding: '0.875rem 1rem', textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {reservations.map(r => {
                                    const [color, bg, bdr] = statusColor(r.status);
                                    return (
                                        <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                            <td style={{ padding: '1rem', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#818cf8' }}>{r.plateNumber}</td>
                                            <td style={{ padding: '1rem', color: 'white', fontWeight: 700 }}>#{r.spotNumber}</td>
                                            <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{fmt(r.reservedFrom)}</td>
                                            <td style={{ padding: '1rem', color: 'rgba(255,255,255,0.55)', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{fmt(r.reservedUntil)}</td>
                                            <td style={{ padding: '1rem' }}>
                                                <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color, background: bg, border: `1px solid ${bdr}`, borderRadius: '99px', padding: '0.2rem 0.65rem' }}>{r.status}</span>
                                            </td>
                                            <td style={{ padding: '1rem' }}>
                                                {(r.status === 'pending') && (
                                                    <button onClick={() => cancel(r.id)} disabled={cancelling === r.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.7rem', background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', borderRadius: '0.5rem', color: '#f43f5e', cursor: cancelling === r.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 600, opacity: cancelling === r.id ? 0.5 : 1 }}>
                                                        <XCircle size={12} /> {cancelling === r.id ? '…' : 'Cancel'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
