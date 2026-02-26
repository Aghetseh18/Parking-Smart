'use client';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authRegister, setToken } from '@/lib/api';
import { ParkingCircle, User, Mail, Phone, Car, Lock, Eye, EyeOff, UserPlus } from 'lucide-react';

export default function SignupPage() {
    const router = useRouter();
    const [form, setForm] = useState({ name: '', email: '', phone: '', vehiclePlateNumber: '', password: '' });
    const [showPw, setShowPw] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(f => ({ ...f, [k]: e.target.value }));

    const submit = async (e: FormEvent) => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            const res = await authRegister({ ...form, vehiclePlateNumber: form.vehiclePlateNumber.toUpperCase() });
            setToken(res.token);
            localStorage.setItem('ps_user', JSON.stringify(res.user));
            router.push('/user/spots');
        } catch (err: any) {
            setError(err.message ?? 'Sign up failed');
        } finally {
            setLoading(false);
        }
    };

    const field = (
        id: string, label: string, key: keyof typeof form,
        type: string, placeholder: string, icon: React.ReactNode,
        extra?: React.ReactNode
    ) => (
        <div>
            <label htmlFor={id} style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginBottom: '0.4rem' }}>{label}</label>
            <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: '0.875rem', top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)', pointerEvents: 'none', display: 'flex', alignItems: 'center' }}>{icon}</span>
                <input
                    id={id}
                    type={type}
                    value={form[key]}
                    onChange={set(key)}
                    required
                    placeholder={placeholder}
                    style={{ width: '100%', padding: `0.7rem ${extra ? '2.5rem' : '0.875rem'} 0.7rem 2.5rem`, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '0.75rem', color: 'white', fontSize: '0.88rem', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.2s' }}
                    onFocus={e => { e.target.style.borderColor = 'rgba(99,102,241,0.5)'; }}
                    onBlur={e => { e.target.style.borderColor = 'rgba(255,255,255,0.1)'; }}
                />
                {extra}
            </div>
        </div>
    );

    return (
        <div style={{ minHeight: '100vh', background: '#0f0f14', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem 1rem', fontFamily: "'Inter', sans-serif", position: 'relative', overflow: 'hidden' }}>

            {/* Background orbs */}
            <div style={{ position: 'fixed', top: '-15rem', left: '50%', transform: 'translateX(-50%)', width: '40rem', height: '40rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'fixed', bottom: '-8rem', right: '10%', width: '22rem', height: '22rem', borderRadius: '50%', background: 'radial-gradient(circle, rgba(139,92,246,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ width: '100%', maxWidth: '440px', position: 'relative', zIndex: 1 }}>

                {/* Logo */}
                <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '3.5rem', height: '3.5rem', borderRadius: '1rem', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', marginBottom: '0.875rem', boxShadow: '0 8px 32px rgba(99,102,241,0.35)' }}>
                        <ParkingCircle size={22} color="white" />
                    </div>
                    <h1 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'white', letterSpacing: '-0.03em', marginBottom: '0.3rem' }}>Create account</h1>
                    <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)' }}>Reserve parking spots in advance</p>
                </div>

                {/* Card */}
                <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '1.25rem', padding: '2rem', backdropFilter: 'blur(12px)' }}>
                    <form onSubmit={submit} id="signup-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

                        {field('signup-name', 'Full name', 'name', 'text', 'John Doe', <User size={15} />)}
                        {field('signup-email', 'Email address', 'email', 'email', 'you@example.com', <Mail size={15} />)}
                        {field('signup-phone', 'Phone number', 'phone', 'tel', '+237 6XX XXX XXX', <Phone size={15} />)}
                        {field('signup-plate', 'Vehicle plate', 'vehiclePlateNumber', 'text', 'ABC 1234', <Car size={15} />)}
                        {field(
                            'signup-password', 'Password', 'password',
                            showPw ? 'text' : 'password', '••••••••',
                            <Lock size={15} />,
                            <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: 'absolute', right: '0.875rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'rgba(255,255,255,0.35)', cursor: 'pointer', padding: 0 }}>
                                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                            </button>
                        )}

                        {/* Password hint */}
                        <p style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.25)', marginTop: '-0.4rem' }}>
                            💡 Use your vehicle plate number for automatic gate access when you make a reservation.
                        </p>

                        {error && (
                            <div style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.25)', borderRadius: '0.65rem', padding: '0.6rem 0.875rem', fontSize: '0.8rem', color: '#f87171' }}>
                                {error}
                            </div>
                        )}

                        <button
                            id="signup-submit"
                            type="submit"
                            disabled={loading}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', padding: '0.8rem', background: loading ? 'rgba(99,102,241,0.5)' : 'linear-gradient(135deg, #6366f1, #8b5cf6)', border: 'none', borderRadius: '0.75rem', color: 'white', fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9rem', cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: '0 4px 20px rgba(99,102,241,0.3)', marginTop: '0.25rem' }}
                        >
                            {loading
                                ? <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid white', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
                                : <><UserPlus size={16} /> Create Account</>}
                        </button>
                    </form>
                </div>

                <p style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.83rem', color: 'rgba(255,255,255,0.35)' }}>
                    Already have an account?{' '}
                    <Link href="/user/login" style={{ color: '#818cf8', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
                </p>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
                input::placeholder { color: rgba(255,255,255,0.2); }
            `}</style>
        </div>
    );
}
