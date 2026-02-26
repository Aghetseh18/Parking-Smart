// Login and Signup pages are standalone, they don't use the user portal sidebar layout.
// This layout wrapper is intentionally minimal — just passes children through.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
}
