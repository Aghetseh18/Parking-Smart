'use client';
import { useState } from 'react';
import { checkPlate, PlateCheckResult } from '@/lib/api';
import { Search, ParkingCircle, ShieldCheck, AlertTriangle, Wifi, Info, ChevronRight, User, Clock } from 'lucide-react';

type CheckState = { result: PlateCheckResult | null; loading: boolean; error: string | null };

export default function GatePage() {
    const [plate, setPlate] = useState('');
    const [state, setState] = useState<CheckState>({ result: null, loading: false, error: null });

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        const p = plate.trim().toUpperCase();
        if (!p) return;
        setState({ result: null, loading: true, error: null });
        try {
            const res = await checkPlate(p);
            setState({ result: res, loading: false, error: null });
        } catch (err: unknown) {
            setState({ result: null, loading: false, error: err instanceof Error ? err.message : 'Request failed' });
        }
    };

    const { result, loading, error } = state;

    const flowSteps = [
        'User registers with their vehicle plate number',
        'User books a reservation with a time window (from → until)',
        'When the car arrives, the ESP32-CAM snaps the plate image',
        'OCR reads the plate and checks it against active reservations',
        'If a valid reservation exists → gate opens as RESERVATION',
        'If no reservation → gate opens as GUEST (pay on exit)',
    ];

    const mqttInfo = [
        { label: 'Broker', value: 'broker.emqx.io' },
        { label: 'Command Topic', value: 'parking/gate/command' },
        { label: 'Status Topic', value: 'parking/gate/status' },
        { label: 'Rate / hour', value: '500 CFA' },
    ];

    return (
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem', position: 'relative', zIndex: 1 }}>

            {/* Header */}
            <div>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>
                    Gate Management
                </span>
                <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginTop: '0.2rem' }}>
                    Gate Control
                </h1>
                <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.35rem' }}>
                    Gate opens automatically by plate scan — check a plate's reservation status here
                </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '1.25rem', alignItems: 'start' }}>

                {/* ── Plate Check Card ── */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                    {/* Card header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <div style={{
                            width: '3rem', height: '3rem', borderRadius: '0.875rem',
                            background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(139,92,246,0.15))',
                            border: '1px solid rgba(99,102,241,0.3)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                            <Search size={20} color="#818cf8" />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'white' }}>Plate Lookup</h2>
                            <p style={{ fontSize: '0.76rem', color: 'rgba(255,255,255,0.35)', marginTop: '0.1rem' }}>
                                Check if a plate has a current valid reservation
                            </p>
                        </div>
                    </div>

                    <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)' }} />

                    {/* Form */}
                    <form onSubmit={submit} id="plate-check-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        <div>
                            <label style={{
                                display: 'block', fontSize: '0.68rem', fontWeight: 700,
                                textTransform: 'uppercase', letterSpacing: '0.1em',
                                color: 'rgba(255,255,255,0.35)', marginBottom: '0.6rem',
                            }}>
                                Plate Number
                            </label>
                            <input
                                id="plate-input"
                                className="input"
                                style={{
                                    textAlign: 'center',
                                    fontSize: '1.75rem',
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontWeight: 700,
                                    letterSpacing: '0.25em',
                                    padding: '1.1rem',
                                    background: 'rgba(99,102,241,0.05)',
                                    borderColor: plate ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.07)',
                                    textTransform: 'uppercase',
                                }}
                                placeholder="ABC 123"
                                value={plate}
                                onChange={e => setPlate(e.target.value.toUpperCase())}
                                maxLength={12}
                                autoComplete="off"
                                autoFocus
                            />
                            <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)', textAlign: 'center', marginTop: '0.5rem' }}>
                                Exactly as it appears on the vehicle
                            </p>
                        </div>

                        <button
                            id="check-plate-btn"
                            type="submit"
                            disabled={loading || !plate.trim()}
                            className="btn-primary"
                            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.625rem', padding: '0.9rem', fontSize: '0.9rem' }}
                        >
                            {loading ? (
                                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                                    Checking…
                                </span>
                            ) : (
                                <><Search size={16} /> Check Reservation</>
                            )}
                        </button>
                    </form>

                    {/* Error */}
                    {error && (
                        <div style={{ padding: '1rem', borderRadius: '0.875rem', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', color: '#f43f5e', fontSize: '0.875rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <AlertTriangle size={18} /> {error}
                        </div>
                    )}

                    {/* Result */}
                    {result && (
                        <div style={{
                            padding: '1.25rem',
                            borderRadius: '1rem',
                            background: result.hasReservation ? 'rgba(16,185,129,0.08)' : 'rgba(245,158,11,0.08)',
                            border: `1px solid ${result.hasReservation ? 'rgba(16,185,129,0.25)' : 'rgba(245,158,11,0.25)'}`,
                            animation: 'fadeIn 0.3s ease',
                            display: 'flex', flexDirection: 'column', gap: '1rem',
                        }}>
                            {/* Status row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                {result.hasReservation
                                    ? <ShieldCheck size={24} color="#10b981" />
                                    : <AlertTriangle size={24} color="#f59e0b" />}
                                <div>
                                    <p style={{ fontWeight: 800, fontSize: '0.95rem', color: result.hasReservation ? '#10b981' : '#f59e0b' }}>
                                        {result.hasReservation ? 'Valid Reservation Found' : 'No Active Reservation'}
                                    </p>
                                    <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.1rem' }}>
                                        {result.message}
                                    </p>
                                </div>
                            </div>

                            {/* Plate badge */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>Plate</span>
                                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '1.1rem', fontWeight: 800, color: 'white', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.5rem', padding: '0.2rem 0.75rem', letterSpacing: '0.2em' }}>
                                    {result.plateNumber}
                                </span>
                            </div>

                            {/* User info */}
                            {result.user && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.83rem', color: 'rgba(255,255,255,0.5)' }}>
                                    <User size={14} />
                                    {result.user.name} — {result.user.email}
                                </div>
                            )}

                            {/* Reservation details */}
                            {result.reservation && (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginTop: '0.25rem' }}>
                                    {[
                                        { label: 'Spot', val: `#${result.reservation.spotNumber}` },
                                        { label: 'From', val: new Date(result.reservation.reservedFrom).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                                        { label: 'Until', val: new Date(result.reservation.reservedUntil).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) },
                                    ].map(({ label, val }) => (
                                        <div key={label} style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '0.6rem', padding: '0.6rem 0.875rem' }}>
                                            <p style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'rgba(255,255,255,0.3)', marginBottom: '0.2rem' }}>{label}</p>
                                            <p style={{ fontWeight: 700, color: 'white', fontSize: '0.88rem', fontFamily: label === 'Spot' ? "'JetBrains Mono', monospace" : 'inherit' }}>{val}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* ── Right column ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                    {/* How it Works */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Info size={15} color="#818cf8" />
                            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'white' }}>How Plate-Based Access Works</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                            {flowSteps.map((step, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem' }}>
                                    <div style={{
                                        width: '1.5rem', height: '1.5rem', borderRadius: '50%',
                                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: '0.65rem', fontWeight: 800, color: 'white',
                                        flexShrink: 0, marginTop: '0.05rem',
                                    }}>{i + 1}</div>
                                    <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>{step}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* MQTT Status */}
                    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Wifi size={15} color="#06b6d4" />
                                <h3 style={{ fontSize: '0.875rem', fontWeight: 700, color: 'white' }}>MQTT Status</h3>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981' }} className="pulse-dot" />
                                <span style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600 }}>Connected</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                            {mqttInfo.map(({ label, value }, i) => (
                                <div key={label} style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '0.65rem 0',
                                    borderBottom: i < mqttInfo.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                                }}>
                                    <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>{label}</span>
                                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)', fontWeight: 600, background: 'rgba(255,255,255,0.05)', padding: '0.15rem 0.5rem', borderRadius: '0.35rem' }}>
                                        {value}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                @keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
            `}</style>
        </div>
    );
}
