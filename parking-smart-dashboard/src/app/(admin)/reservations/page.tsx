'use client';
import { useEffect, useState } from 'react';
import {
    getAllReservations, cancelReservation, createReservation,
    getAvailablePlaces, Reservation, AvailablePlaces
} from '@/lib/api';
import { RefreshCw, Plus, X, CalendarClock, CheckCircle, XCircle, Clock, ParkingCircle } from 'lucide-react';

type FormState = {
    plateNumber: string;
    reservedFrom: string;
    reservedUntil: string;
};
const blank: FormState = { plateNumber: '', reservedFrom: '', reservedUntil: '' };


export default function ReservationsPage() {
    const [rows, setRows] = useState<Reservation[]>([]);
    const [places, setPlaces] = useState<AvailablePlaces | null>(null);
    const [loading, setLoading] = useState(true);
    const [showForm, setShow] = useState(false);
    const [form, setForm] = useState<FormState>(blank);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const [r, p] = await Promise.all([
                getAllReservations(),
                getAvailablePlaces(),
            ]);
            setRows(r);
            setPlaces(p);
        } catch { }
        finally { setLoading(false); }
    };
    useEffect(() => { load(); }, []);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const result = await createReservation({
                plateNumber: form.plateNumber,
                reservedFrom: new Date(form.reservedFrom).toISOString(),
                reservedUntil: new Date(form.reservedUntil).toISOString(),
            });
            const r = result as any;
            setMsg({ ok: true, text: `✓ Reserved! Spot #${r.spotNumber} assigned to plate ${r.plateNumber}. Gate opens automatically on arrival.` });
            setForm(blank); setShow(false); load();
        } catch (err: unknown) {
            setMsg({ ok: false, text: err instanceof Error ? err.message : 'Failed to create reservation' });
        } finally { setSaving(false); setTimeout(() => setMsg(null), 7000); }
    };

    const cancel = async (id: string) => {
        try { await cancelReservation(id); load(); }
        catch { setMsg({ ok: false, text: 'Failed to cancel reservation' }); }
    };

    const statusColor: Record<string, string> = {
        pending: 'badge-yellow',
        active: 'badge-green',
        expired: 'badge-red',
        cancelled: 'badge-red',
    };

    const stats = [
        { icon: CalendarClock, label: 'Total', value: rows.length, color: '#818cf8', bg: 'rgba(99,102,241,0.1)' },
        { icon: Clock, label: 'Pending', value: rows.filter(r => r.status === 'pending').length, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
        { icon: CheckCircle, label: 'Active', value: rows.filter(r => r.status === 'active').length, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
        { icon: XCircle, label: 'Cancelled', value: rows.filter(r => r.status === 'cancelled').length, color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' },
    ];

    return (
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem', position: 'relative', zIndex: 1 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>
                        Booking Management
                    </span>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginTop: '0.2rem' }}>
                        Reservations
                    </h1>
                    <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.35rem' }}>
                        Spots are auto-assigned when you reserve — no manual selection needed
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
                    <button onClick={load}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.6rem 0.875rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8rem', transition: 'all 0.2s' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)'; }}
                    >
                        <RefreshCw size={14} />
                    </button>
                    <button id="new-reservation-btn" onClick={() => setShow(v => !v)} className="btn-primary"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Plus size={16} /> New Reservation
                    </button>
                </div>
            </div>

            {/* Live available places banner */}
            {places && (
                <div className="card" style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', padding: '1rem 1.5rem', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <ParkingCircle size={20} color="#818cf8" />
                        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>Live Availability</span>
                    </div>
                    <div style={{ display: 'flex', gap: '2rem', marginLeft: '0.5rem' }}>
                        {[
                            { label: 'Available', val: places.available, color: '#10b981' },
                            { label: 'Occupied', val: places.occupied, color: '#f43f5e' },
                            { label: 'Reserved', val: places.reserved, color: '#f59e0b' },
                            { label: 'Total', val: places.total, color: 'rgba(255,255,255,0.4)' },
                        ].map(p => (
                            <div key={p.label} style={{ textAlign: 'center' }}>
                                <p style={{ fontSize: '1.4rem', fontWeight: 800, color: p.color, lineHeight: 1 }}>{p.val}</p>
                                <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '0.2rem' }}>{p.label}</p>
                            </div>
                        ))}
                    </div>
                    <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <div className="pulse-dot" style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#10b981' }} />
                        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>Updated by ESP32</span>
                    </div>
                </div>
            )}

            {/* Stats Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.875rem' }}>
                {stats.map(({ icon: Icon, label, value, color, bg }) => (
                    <div key={label} className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1rem 1.25rem' }}>
                        <div style={{ width: '2.25rem', height: '2.25rem', borderRadius: '0.65rem', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <Icon size={16} color={color} />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>{label}</p>
                            <p style={{ fontSize: '1.4rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{value}</p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Message Banner */}
            {msg && (
                <div style={{
                    padding: '0.875rem 1.25rem', borderRadius: '0.875rem',
                    fontSize: '0.875rem', fontWeight: 600,
                    display: 'flex', alignItems: 'center', gap: '0.625rem',
                    animation: 'fadeIn 0.3s ease',
                    background: msg.ok ? 'rgba(16,185,129,0.1)' : 'rgba(244,63,94,0.1)',
                    border: `1px solid ${msg.ok ? 'rgba(16,185,129,0.25)' : 'rgba(244,63,94,0.25)'}`,
                    color: msg.ok ? '#10b981' : '#f43f5e',
                }}>
                    {msg.ok ? <CheckCircle size={16} /> : <XCircle size={16} />}
                    {msg.text}
                </div>
            )}

            {/* Create Form — NO spot number field */}
            {showForm && (
                <div className="card fade-in" style={{ border: '1px solid rgba(99,102,241,0.25)', background: 'rgba(99,102,241,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
                        <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <CalendarClock size={18} color="#818cf8" />
                            New Reservation
                            <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', fontWeight: 500, marginLeft: '0.25rem' }}>
                                — spot will be auto-assigned
                            </span>
                        </h2>
                        <button onClick={() => setShow(false)}
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: '0.25rem', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = 'white'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'; }}
                        >
                            <X size={18} />
                        </button>
                    </div>
                    <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: '0.5rem' }}>
                                Plate Number <span style={{ color: '#f43f5e' }}>*</span>
                            </label>
                            <input id="plate-number" className="input" type="text" placeholder="ABC 123" required
                                value={form.plateNumber}
                                onChange={e => setForm(p => ({ ...p, plateNumber: e.target.value.toUpperCase() }))}
                            />
                            <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.25)', marginTop: '0.35rem' }}>Gate opens when this plate is scanned</p>
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: '0.5rem' }}>
                                From
                            </label>
                            <input id="reserved-from" className="input" type="datetime-local" required
                                value={form.reservedFrom}
                                onChange={e => setForm(p => ({ ...p, reservedFrom: e.target.value }))}
                            />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.35)', marginBottom: '0.5rem' }}>
                                Until
                            </label>
                            <input id="reserved-until" className="input" type="datetime-local" required
                                value={form.reservedUntil}
                                onChange={e => setForm(p => ({ ...p, reservedUntil: e.target.value }))}
                            />
                        </div>
                        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.25rem' }}>
                            <button type="button" onClick={() => setShow(false)} className="btn-ghost">Cancel</button>
                            <button id="submit-reservation" type="submit" disabled={saving} className="btn-primary">
                                {saving ? 'Creating…' : 'Confirm Reservation'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Table */}
            <div className="card" style={{ padding: 0 }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h2 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'white' }}>All Reservations</h2>
                    <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.3)' }}>{rows.length} records</span>
                </div>

                {loading ? (
                    <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                        {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '3.5rem', borderRadius: '0.75rem' }} />)}
                    </div>
                ) : rows.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '4rem 2rem', color: 'rgba(255,255,255,0.2)' }}>
                        <CalendarClock size={36} style={{ margin: '0 auto 1rem', opacity: 0.25 }} />
                        <p style={{ fontSize: '0.9rem', fontWeight: 600 }}>No reservations found</p>
                        <p style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}>Click "New Reservation" to get started</p>
                    </div>
                ) : (
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                                    {['Plate', 'Spot (auto)', 'From', 'Until', 'Status', ''].map((h, i) => (
                                        <th key={i} style={{ padding: '0.875rem 1rem 0.875rem ' + (i === 0 ? '1.5rem' : '0'), textAlign: 'left', fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.id} className="table-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                                        <td style={{ padding: '1rem 1rem 1rem 1.5rem', fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: '#818cf8' }}>
                                            {r.plateNumber}
                                        </td>
                                        <td style={{ padding: '1rem 1rem 1rem 0' }}>
                                            {r.spotNumber
                                                ? <span style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.4rem', padding: '0.2rem 0.55rem', fontWeight: 600, fontFamily: 'monospace', color: 'rgba(255,255,255,0.7)' }}>#{r.spotNumber}</span>
                                                : <span style={{ color: 'rgba(255,255,255,0.15)' }}>—</span>}
                                        </td>
                                        <td style={{ padding: '1rem 1rem 1rem 0', color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                            {new Date(r.reservedFrom).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td style={{ padding: '1rem 1rem 1rem 0', color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
                                            {new Date(r.reservedUntil).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td style={{ padding: '1rem 1rem 1rem 0' }}>
                                            <span className={`badge ${statusColor[r.status] ?? 'badge-blue'}`}>{r.status}</span>
                                        </td>
                                        <td style={{ padding: '1rem 1.5rem 1rem 0' }}>
                                            {r.status === 'pending' && (
                                                <button onClick={() => cancel(r.id)} className="btn-danger"
                                                    style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
                                                    <X size={12} /> Cancel
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
