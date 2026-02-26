'use client';
import { useEffect, useState } from 'react';
import { getAllSpots, getAvailablePlaces, deleteSpot, Spot, AvailablePlaces } from '@/lib/api';
import { RefreshCw, ParkingCircle, Car, Clock, Wifi, Trash2 } from 'lucide-react';

export default function SpotsPage() {
    const [spots, setSpots] = useState<Spot[]>([]);
    const [places, setPlaces] = useState<AvailablePlaces | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdate, setLast] = useState<Date | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    const load = async () => {
        try {
            const raw = await getAllSpots() as any;
            const spotList: Spot[] = Array.isArray(raw) ? raw : (raw?.data ?? []);
            setSpots(spotList);
            const p = await getAvailablePlaces();
            setPlaces(p);
            setLast(new Date());
        } catch { }
        finally { setLoading(false); }
    };

    useEffect(() => {
        load();
        // Polling fallback — every 30 s (SSE handles instant updates below)
        const t = setInterval(load, 30000);

        // SSE — instant push when spots or gate change
        const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        const es = new EventSource(`${BASE}/api/dashboard/live`);
        es.addEventListener('spots_updated', () => load());
        es.addEventListener('gate_event', () => load());
        es.onerror = () => es.close();

        return () => { clearInterval(t); es.close(); };
    }, []);

    const handleDelete = async (spotId: string, spotNumber: number) => {
        if (!confirm(`Delete Spot #${spotNumber} from the database? This cannot be undone.`)) return;
        setDeleting(spotId);
        try {
            await deleteSpot(spotId);
            await load();
        } catch {
            alert('Failed to delete spot');
        } finally {
            setDeleting(null);
        }
    };

    const free = places ? places.available : spots.filter(s => !s.isOccupied).length;
    const occ = places ? places.occupied : spots.filter(s => s.isOccupied).length;
    const total = places ? places.total : spots.length;
    const pct = total ? Math.round((occ / total) * 100) : 0;

    const sorted = [...spots].sort((a, b) => a.spotNumber - b.spotNumber);

    return (
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem', position: 'relative', zIndex: 1 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>
                        Real-time View
                    </span>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginTop: '0.2rem' }}>
                        Parking Map
                    </h1>
                    <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.35rem' }}>
                        Live spot occupancy — hover a spot to delete it
                    </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {lastUpdate && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)' }}>
                            <Wifi size={12} />
                            {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </div>
                    )}
                    <button
                        onClick={load}
                        id="refresh-spots"
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
            </div>

            {/* Summary bar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: '1rem', alignItems: 'stretch' }}>
                {[
                    { icon: ParkingCircle, label: 'Available', value: free, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
                    { icon: Car, label: 'Occupied', value: occ, color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' },
                    { icon: Clock, label: 'Total', value: total, color: '#818cf8', bg: 'rgba(99,102,241,0.1)' },
                ].map(s => (
                    <div key={s.label} className="card" style={{ display: 'flex', alignItems: 'center', gap: '0.875rem', padding: '1rem 1.25rem' }}>
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <s.icon size={18} color={s.color} />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>{s.label}</p>
                            <p style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white', letterSpacing: '-0.03em', lineHeight: 1.1 }}>{s.value}</p>
                        </div>
                    </div>
                ))}

                {/* Occupancy bar card */}
                <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.75rem', padding: '1rem 1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>Occupancy Rate</span>
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: 'white' }}>{pct}%</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '99px', height: '8px', overflow: 'hidden' }}>
                        <div style={{
                            height: '100%',
                            width: `${pct}%`,
                            borderRadius: '99px',
                            background: pct > 85
                                ? 'linear-gradient(90deg, #f43f5e, #f97316)'
                                : pct > 60
                                    ? 'linear-gradient(90deg, #f59e0b, #10b981)'
                                    : 'linear-gradient(90deg, #6366f1, #10b981)',
                            transition: 'width 0.8s cubic-bezier(.4,0,.2,1)',
                            boxShadow: pct > 85 ? '0 0 12px rgba(244,63,94,0.5)' : '0 0 12px rgba(99,102,241,0.4)',
                        }} />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: pct > 85 ? '#f43f5e' : '#10b981', boxShadow: pct > 85 ? '0 0 6px #f43f5e' : '0 0 6px #10b981' }} className="pulse-dot" />
                        <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)' }}>
                            {pct > 85 ? 'Almost full' : pct > 60 ? 'Moderately occupied' : 'Plenty of space available'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Spot Grid */}
            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.875rem' }}>
                    {Array.from({ length: 20 }).map((_, i) => (
                        <div key={i} className="skeleton" style={{ height: '7.5rem', borderRadius: '1rem' }} />
                    ))}
                </div>
            ) : spots.length === 0 ? (
                <div className="card" style={{ textAlign: 'center', padding: '4rem 2rem', color: 'rgba(255,255,255,0.2)' }}>
                    <ParkingCircle size={42} style={{ margin: '0 auto 1rem', opacity: 0.2 }} />
                    <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>No spot data from backend</p>
                    <p style={{ fontSize: '0.82rem', marginTop: '0.4rem', color: 'rgba(255,255,255,0.15)' }}>
                        Make sure the backend is running on port 3000
                    </p>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.875rem' }}>
                    {sorted.map(spot => (
                        <div
                            key={spot.id}
                            className="spot-card"
                            style={{
                                borderRadius: '1.1rem',
                                border: `1px solid ${spot.isOccupied ? 'rgba(244,63,94,0.25)' : 'rgba(16,185,129,0.22)'}`,
                                background: spot.isOccupied
                                    ? 'linear-gradient(135deg, rgba(244,63,94,0.1), rgba(244,63,94,0.04))'
                                    : 'linear-gradient(135deg, rgba(16,185,129,0.1), rgba(16,185,129,0.04))',
                                padding: '1rem 0.875rem 0.75rem',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '0.45rem',
                                transition: 'transform 0.2s, box-shadow 0.2s',
                                position: 'relative',
                                backdropFilter: 'blur(8px)',
                                overflow: 'hidden',
                            }}
                            onMouseEnter={e => {
                                (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)';
                                (e.currentTarget as HTMLElement).style.boxShadow = spot.isOccupied
                                    ? '0 8px 24px rgba(244,63,94,0.2)'
                                    : '0 8px 24px rgba(16,185,129,0.2)';
                                const btn = (e.currentTarget as HTMLElement).querySelector('.spot-delete-btn') as HTMLElement | null;
                                if (btn) btn.style.opacity = '1';
                            }}
                            onMouseLeave={e => {
                                (e.currentTarget as HTMLElement).style.transform = 'translateY(0)';
                                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                                const btn = (e.currentTarget as HTMLElement).querySelector('.spot-delete-btn') as HTMLElement | null;
                                if (btn) btn.style.opacity = '0';
                            }}
                        >
                            {/* Icon */}
                            <div style={{
                                width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem',
                                background: spot.isOccupied ? 'rgba(244,63,94,0.15)' : 'rgba(16,185,129,0.15)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                {spot.isOccupied
                                    ? <Car size={18} color="#f43f5e" />
                                    : <ParkingCircle size={18} color="#10b981" />}
                            </div>

                            {/* Spot number */}
                            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'white', letterSpacing: '-0.02em' }}>
                                #{spot.spotNumber}
                            </span>

                            {/* Status badge */}
                            <span style={{
                                fontSize: '0.65rem',
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.08em',
                                color: spot.isOccupied ? '#f43f5e' : '#10b981',
                                background: spot.isOccupied ? 'rgba(244,63,94,0.1)' : 'rgba(16,185,129,0.1)',
                                border: `1px solid ${spot.isOccupied ? 'rgba(244,63,94,0.2)' : 'rgba(16,185,129,0.2)'}`,
                                borderRadius: '99px',
                                padding: '0.15rem 0.6rem',
                            }}>
                                {spot.isOccupied ? 'Occupied' : 'Free'}
                            </span>

                            {/* Delete button — appears on hover */}
                            <button
                                className="spot-delete-btn"
                                onClick={e => { e.stopPropagation(); handleDelete(spot.id, spot.spotNumber); }}
                                disabled={deleting === spot.id}
                                title={`Delete Spot #${spot.spotNumber}`}
                                style={{
                                    opacity: 0,
                                    position: 'absolute',
                                    top: '0.5rem',
                                    right: '0.5rem',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: '1.75rem', height: '1.75rem',
                                    background: 'rgba(244,63,94,0.15)',
                                    border: '1px solid rgba(244,63,94,0.3)',
                                    borderRadius: '0.5rem',
                                    color: '#f43f5e',
                                    cursor: deleting === spot.id ? 'not-allowed' : 'pointer',
                                    transition: 'opacity 0.18s, background 0.18s',
                                    padding: 0,
                                }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.3)'; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(244,63,94,0.15)'; }}
                            >
                                {deleting === spot.id
                                    ? <span style={{ width: '10px', height: '10px', border: '1.5px solid rgba(244,63,94,0.3)', borderTop: '1.5px solid #f43f5e', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                                    : <Trash2 size={12} />
                                }
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
}
