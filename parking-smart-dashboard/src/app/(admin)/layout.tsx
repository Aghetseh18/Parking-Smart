import Sidebar from '@/components/Sidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <div style={{ display: 'flex', height: '100vh', background: '#070b14', color: 'white', overflow: 'hidden' }}>
            <Sidebar />
            <main style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
                {children}
            </main>
        </div>
    );
}
