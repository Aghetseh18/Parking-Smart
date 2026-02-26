// /user/ — no auth check here; just group.
// Sub-routes: /user/login, /user/signup  (standalone, no sidebar)
// Protected sub-routes: /user/spots, /user/reservations, /user/sessions, /user/bills (have sidebar via (portal)/layout.tsx)
export default function UserRootLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
