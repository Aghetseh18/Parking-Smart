'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard, Car, ListOrdered, Receipt,
    ParkingCircle, QrCode, Activity, Wifi
} from 'lucide-react';

const links = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard, color: '#6366f1' },
    { href: '/spots', label: 'Parking Map', icon: ParkingCircle, color: '#10b981' },
    { href: '/sessions', label: 'Sessions', icon: Car, color: '#06b6d4' },
    { href: '/reservations', label: 'Reservations', icon: ListOrdered, color: '#f59e0b' },
    { href: '/transactions', label: 'Transactions', icon: Receipt, color: '#ec4899' },
    { href: '/gate', label: 'Gate Control', icon: QrCode, color: '#8b5cf6' },
];

export default function Sidebar() {
    const path = usePathname();

    return (
        <aside
            style={{
                width: '15.5rem',
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                background: 'rgba(7, 11, 20, 0.95)',
                borderRight: '1px solid rgba(255,255,255,0.06)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                position: 'relative',
                zIndex: 10,
            }}
        >
            {/* Subtle top accent line */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, height: '2px',
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #ec4899)',
                opacity: 0.8,
            }} />

            {/* Logo */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1.5rem 1.25rem 1.25rem',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
            }}>
                <div style={{
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '0.875rem',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 16px rgba(99,102,241,0.45)',
                    flexShrink: 0,
                }}>
                    <ParkingCircle size={18} color="white" />
                </div>
                <div style={{ minWidth: 0 }}>
                    <p style={{ fontWeight: 800, fontSize: '0.9rem', letterSpacing: '-0.01em', color: 'white', lineHeight: 1.2 }}>
                        Parking Smart
                    </p>
                    <p style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: '0.1rem' }}>
                        Admin Console
                    </p>
                </div>
            </div>

            {/* Nav section label */}
            <div style={{ padding: '1.25rem 1.25rem 0.5rem' }}>
                <span style={{
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.2)',
                }}>
                    Navigation
                </span>
            </div>

            {/* Navigation */}
            <nav style={{ flex: 1, padding: '0 0.5rem', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {links.map(({ href, label, icon: Icon, color }) => {
                    const active = path === href;
                    return (
                        <Link
                            key={href}
                            href={href}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '0.65rem 0.875rem',
                                borderRadius: '0.875rem',
                                fontSize: '0.85rem',
                                fontWeight: active ? 600 : 500,
                                textDecoration: 'none',
                                transition: 'all 0.18s ease',
                                color: active ? 'white' : 'rgba(255,255,255,0.45)',
                                background: active ? `${color}18` : 'transparent',
                                border: active ? `1px solid ${color}35` : '1px solid transparent',
                                position: 'relative',
                            }}
                            onMouseEnter={e => {
                                if (!active) {
                                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)';
                                    (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)';
                                }
                            }}
                            onMouseLeave={e => {
                                if (!active) {
                                    (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)';
                                    (e.currentTarget as HTMLElement).style.background = 'transparent';
                                }
                            }}
                        >
                            <div style={{
                                width: '1.875rem',
                                height: '1.875rem',
                                borderRadius: '0.6rem',
                                background: active ? `${color}25` : 'rgba(255,255,255,0.06)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                transition: 'background 0.18s',
                            }}>
                                <Icon size={15} color={active ? color : 'rgba(255,255,255,0.5)'} />
                            </div>
                            {label}
                            {active && (
                                <div style={{
                                    marginLeft: 'auto',
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    background: color,
                                    boxShadow: `0 0 8px ${color}`,
                                }} />
                            )}
                        </Link>
                    );
                })}
            </nav>

            {/* Status Footer */}
            <div style={{
                margin: '0.75rem',
                padding: '0.875rem',
                background: 'rgba(16,185,129,0.06)',
                border: '1px solid rgba(16,185,129,0.15)',
                borderRadius: '0.875rem',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
                    <div style={{
                        width: '7px', height: '7px', borderRadius: '50%',
                        background: '#10b981',
                        boxShadow: '0 0 6px #10b981',
                    }} className="pulse-dot" />
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        System Online
                    </span>
                </div>
                <p style={{ fontSize: '0.68rem', color: 'rgba(255,255,255,0.3)', fontFamily: "'JetBrains Mono', monospace" }}>
                    localhost:3000
                </p>
            </div>
        </aside>
    );
}
