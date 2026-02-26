'use client';
import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
    ParkingCircle, CalendarClock, Car, Receipt,
    LogOut, User, Menu, X, ChevronRight
} from 'lucide-react';

interface StoredUser {
    id: string; name: string; email: string;
    vehiclePlateNumber: string; role: string;
}

const NAV = [
    { href: '/user/spots', label: 'Parking Spots', icon: ParkingCircle },
    { href: '/user/reservations', label: 'My Reservations', icon: CalendarClock },
    { href: '/user/sessions', label: 'My Sessions', icon: Car },
    { href: '/user/bills', label: 'My Bills', icon: Receipt },
];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const pathname = usePathname();
    const [user, setUser] = useState<StoredUser | null>(null);
    const [open, setOpen] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        const raw = localStorage.getItem('ps_user');
        if (!raw) { router.replace('/user/login'); return; }
        setUser(JSON.parse(raw));
    }, []);

    const logout = () => {
        localStorage.removeItem('ps_user');
        localStorage.removeItem('ps_token');
        router.replace('/user/login');
    };

    if (!mounted) return null;

    return (
        <div style={{ minHeight: '100vh', background: '#0f0f14', fontFamily: "'Inter', sans-serif", display: 'flex' }}>

            {/* ── Sidebar ── */}
            <aside style={{ width: open ? '15rem' : '4.25rem', minHeight: '100vh', background: 'rgba(255,255,255,0.025)', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', transition: 'width 0.28s cubic-bezier(.4,0,.2,1)', overflow: 'hidden', flexShrink: 0, position: 'sticky', top: 0, alignSelf: 'flex-start' }}>

                {/* Brand */}
                <div style={{ padding: '1.1rem 0.875rem', display: 'flex', alignItems: 'center', gap: '0.625rem', borderBottom: '1px solid rgba(255,255,255,0.05)', minHeight: '3.75rem' }}>
                    <button onClick={() => setOpen(o => !o)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                        {open ? <X size={18} /> : <Menu size={18} />}
                    </button>
                    {open && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', whiteSpace: 'nowrap' }}>
                            <div style={{ width: '1.7rem', height: '1.7rem', borderRadius: '0.45rem', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}>
                                <ParkingCircle size={12} color="white" />
                            </div>
                            <span style={{ fontWeight: 800, fontSize: '0.9rem', color: 'white', letterSpacing: '-0.02em' }}>ParkSmart</span>
                        </div>
                    )}
                </div>

                {/* Nav */}
                <nav style={{ flex: 1, padding: '0.625rem 0.4rem', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                    {NAV.map(({ href, label, icon: Icon }) => {
                        const active = pathname === href;
                        return (
                            <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', padding: '0.55rem 0.65rem', borderRadius: '0.6rem', textDecoration: 'none', background: active ? 'linear-gradient(135deg, rgba(99,102,241,0.18), rgba(139,92,246,0.1))' : 'transparent', border: active ? '1px solid rgba(99,102,241,0.22)' : '1px solid transparent', color: active ? '#818cf8' : 'rgba(255,255,255,0.36)', transition: 'all 0.18s', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                                <Icon size={17} style={{ flexShrink: 0 }} />
                                {open && <span style={{ fontSize: '0.82rem', fontWeight: active ? 700 : 500 }}>{label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* User footer */}
                {user && (
                    <div style={{ padding: '0.625rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        {open ? (
                            <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: '0.65rem', padding: '0.65rem 0.75rem' }}>
                                <p style={{ fontSize: '0.79rem', fontWeight: 700, color: 'white', marginBottom: '0.15rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{user.name}</p>
                                <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono', monospace", marginBottom: '0.65rem' }}>{user.vehiclePlateNumber}</p>
                                <button onClick={logout} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.18)', borderRadius: '0.45rem', color: '#f43f5e', cursor: 'pointer', padding: '0.35rem 0.65rem', fontFamily: 'inherit', fontSize: '0.72rem', fontWeight: 600, width: '100%', transition: 'all 0.18s' }}>
                                    <LogOut size={11} /> Sign out
                                </button>
                            </div>
                        ) : (
                            <button onClick={logout} title="Sign out" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '0.55rem', background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer' }}>
                                <LogOut size={15} />
                            </button>
                        )}
                    </div>
                )}
            </aside>

            {/* ── Main ── */}
            <main style={{ flex: 1, minHeight: '100vh', overflowX: 'hidden', position: 'relative' }}>
                <div style={{ position: 'fixed', top: '-10rem', right: '-10rem', width: '28rem', height: '28rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />
                <div style={{ position: 'fixed', bottom: '-8rem', left: '22%', width: '22rem', height: '22rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, transparent 70%)', pointerEvents: 'none', zIndex: 0 }} />

                {/* Top bar */}
                {user && (
                    <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(15,15,20,0.88)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(255,255,255,0.045)', padding: '0.75rem 1.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.72rem', color: 'rgba(255,255,255,0.28)' }}>
                            <span>User Portal</span>
                            <ChevronRight size={11} />
                            <span style={{ color: 'rgba(255,255,255,0.55)' }}>{NAV.find(n => n.href === pathname)?.label ?? 'Home'}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                            <div style={{ width: '1.65rem', height: '1.65rem', borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <User size={11} color="white" />
                            </div>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'white' }}>{user.name}</span>
                        </div>
                    </div>
                )}

                {children}
            </main>

            <style>{`
                .skeleton { background: linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.07) 50%, rgba(255,255,255,0.04) 100%); background-size: 200% 100%; animation: shimmer 1.4s infinite; }
                @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
                @keyframes spin { to { transform: rotate(360deg); } }
                input::placeholder { color: rgba(255,255,255,0.18); }
            `}</style>
        </div>
    );
}
