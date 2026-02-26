'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function UserIndex() {
    const router = useRouter();
    useEffect(() => {
        const raw = localStorage.getItem('ps_user');
        router.replace(raw ? '/user/spots' : '/user/login');
    }, []);
    return null;
}
