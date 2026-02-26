'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAllSpots, getAvailablePlaces, Spot, AvailablePlaces } from '@/lib/api';
import { ParkingCircle, Car, RefreshCw, Wifi, CheckCircle, Info } from 'lucide-react';

export default function UserSpotsPage() {
    const router = useRouter();
    const [spots, setSpots] = useState<Spot[]>([]);
    const [places, setPlaces] = useState<AvailablePlaces | null>(null);
    const [loading, setLoading] = useState(true);
    const [last, setLast] = useState<Date | null>(null);

    const load = async () => {
        try {
            const raw = await getAllSpots() as any;
            setSpots(Array.isArray(raw) ? raw : (raw?.data ?? []));
            setPlaces(await getAvailablePlaces());
            setLast(new Date());
        } catch { } finally { setLoading(false); }
    };

    useEffect(() => { load(); const t = setInterval(load, 10_000); return () => clearInterval(t); }, []);

    const free = places?.available ?? spots.filter(s => !s.isOccupied && !s.isReserved).length;
    const occ = places?.occupied ?? spots.filter(s => s.isOccupied).length;
    const rsv = places?.reserved ?? spots.filter(s => s.isReserved).length;
    const total = places?.total ?? spots.length;
    const pct = total ? Math.round(((occ + rsv) / total) * 100) : 0;
    const sorted = [...spots].sort((a, b) => a.spotNumber - b.spotNumber);

    return (
        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1.75rem', position: 'relative', zIndex: 1 }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    <span style={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.3)' }}>Live View</span>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginTop: '0.2rem' }}>Parking Spots</h1>
                    <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', marginTop: '0.35rem' }}>Real-time availability · auto-refreshes every 10 s</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {last && <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Wifi size={11} />{last.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
                    <button onClick={load} id="refresh-user-spots" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.55rem 0.9rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '0.75rem', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.78rem', transition: 'all 0.2s' }}>
                        <RefreshCw size={13} /> Refresh
                    </button>
                </div>
            </div>

            {/* Stats bar */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr', gap: '1rem' }}>
                {[
                    { label: 'Available', value: free, color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: ParkingCircle },
                    { label: 'Occupied', value: occ, color: '#f43f5e', bg: 'rgba(244,63,94,0.1)', icon: Car },
                    { label: 'Reserved', value: rsv, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: CheckCircle },
                ].map(s => (
                    <div key={s.label} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1rem', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
                        <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '0.75rem', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <s.icon size={18} color={s.color} />
                        </div>
                        <div>
                            <p style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.3)' }}>{s.label}</p>
                            <p style={{ fontSize: '1.7rem', fontWeight: 800, color: 'white', letterSpacing: '-0.03em', lineHeight: 1 }}>{s.value}</p>
                        </div>
                    </div>
                ))}
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '1rem', padding: '1rem 1.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.6rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)' }}>Occupancy</span>
                        <span style={{ fontSize: '1rem', fontWeight: 800, color: 'white' }}>{pct}%</span>
                    </div>
                    <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: '99px', height: '7px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, borderRadius: '99px', background: pct > 85 ? 'linear-gradient(90deg, #f43f5e, #f97316)' : pct > 60 ? 'linear-gradient(90deg, #f59e0b, #10b981)' : 'linear-gradient(90deg, #6366f1, #10b981)', transition: 'width 0.8s cubic-bezier(.4,0,.2,1)' }} />
                    </div>
                    <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.25)' }}>
                        {pct > 85 ? '🔴 Almost full' : pct > 60 ? '🟡 Moderately busy' : '🟢 Plenty of space'}
                    </p>
                </div>
            </div>

            {/* Reserve CTA */}
            {free > 0 && (
                <div style={{ background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '1rem', padding: '1.1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <Info size={18} color="#818cf8" />
                        <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)' }}>
                            <strong style={{ color: '#818cf8' }}>{free} spot{free > 1 ? 's' : ''}</strong> available — reserve one before it fills up!
                        </p>
                    </div>
                    <button
                        onClick={() => router.push('/user/reservations')}
                        style={{ padding: '0.55rem 1.25rem', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: '0.65rem', color: 'white', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.83rem', cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 14px rgba(99,102,241,0.3)' }}
                    >
                        Reserve a Spot →
                    </button>
                </div>
            )}

            {/* Spot grid */}
            {loading ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.875rem' }}>
                    {Array.from({ length: 12 }).map((_, i) => <div key={i} className="skeleton" style={{ height: '8rem', borderRadius: '1rem' }} />)}
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.875rem' }}>
                    {sorted.map(spot => {
                        const color = spot.isOccupied ? '#f43f5e' : spot.isReserved ? '#f59e0b' : '#10b981';
                        const bg = spot.isOccupied ? 'rgba(244,63,94,0.08)' : spot.isReserved ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)';
                        const bdr = spot.isOccupied ? 'rgba(244,63,94,0.2)' : spot.isReserved ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.18)';
                        const label = spot.isOccupied ? 'Occupied' : spot.isReserved ? 'Reserved' : 'Free';
                        return (
                            <div key={spot.id} style={{ borderRadius: '1.1rem', border: `1px solid ${bdr}`, background: bg, padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.55rem', backdropFilter: 'blur(8px)', transition: 'transform 0.2s, box-shadow 0.2s' }}
                                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px ${color}30`; }}
                                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                            >
                                <div style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', background: spot.isOccupied ? 'rgba(244,63,94,0.12)' : spot.isReserved ? 'rgba(245,158,11,0.12)' : 'rgba(16,185,129,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {spot.isOccupied ? <Car size={20} color="#f43f5e" /> : <ParkingCircle size={20} color={color} />}
                                </div>
                                <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'white', letterSpacing: '-0.02em' }}>#{spot.spotNumber}</span>
                                <span style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color, background: `${color}15`, border: `1px solid ${color}25`, borderRadius: '99px', padding: '0.18rem 0.65rem' }}>{label}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
