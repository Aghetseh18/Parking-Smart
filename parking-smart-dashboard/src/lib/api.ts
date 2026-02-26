const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

// ── Token helpers ────────────────────────────────────────────────
export const getToken = (): string | null =>
    typeof window !== 'undefined' ? localStorage.getItem('ps_token') : null;

export const setToken = (t: string) =>
    typeof window !== 'undefined' && localStorage.setItem('ps_token', t);

export const clearToken = () =>
    typeof window !== 'undefined' && localStorage.removeItem('ps_token');

// ── Core fetch ───────────────────────────────────────────────────
async function apiFetch<T>(path: string, opts?: RequestInit): Promise<T> {
    const token = getToken();
    const res = await fetch(`${BASE}${path}`, {
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...opts,
    });
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? `API error ${res.status}: ${path}`);
    }
    const json = await res.json();
    return json.data ?? json;
}

// ── Auth ─────────────────────────────────────────────────────────
export const authRegister = (body: RegisterBody) =>
    apiFetch<AuthResponse>('/api/auth/register', { method: 'POST', body: JSON.stringify(body) });

export const authLogin = (body: LoginBody) =>
    apiFetch<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify(body) });

export const getMe = () =>
    apiFetch<User>('/api/auth/me');

export const updateMe = (body: Partial<RegisterBody & { currentPassword: string; newPassword: string }>) =>
    apiFetch<User>('/api/auth/me', { method: 'PUT', body: JSON.stringify(body) });

// ── Users (admin) ────────────────────────────────────────────────
export const getAllUsers = () => apiFetch<User[]>('/api/users');
export const getUser = (id: string) => apiFetch<User>(`/api/users/${id}`);
export const updateUser = (id: string, body: Partial<RegisterBody>) =>
    apiFetch<User>(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deleteUser = (id: string) =>
    apiFetch<{ message: string }>(`/api/users/${id}`, { method: 'DELETE' });

// ── Dashboard ────────────────────────────────────────────────────
export const getStats = () => apiFetch<Stats>('/api/dashboard/stats');
export const getActiveSessions = () => apiFetch<Session[]>('/api/dashboard/sessions/active');
export const getSessionHistory = () => apiFetch<Session[]>('/api/dashboard/sessions/history');
export const getSessionsByUser = (userId: string) => apiFetch<Session[]>(`/api/dashboard/sessions/user/${userId}`);
export const getSession = (id: string) => apiFetch<Session>(`/api/dashboard/sessions/${id}`);
export const updateSession = (id: string, body: Partial<Session>) =>
    apiFetch<Session>(`/api/dashboard/sessions/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const deleteSession = (id: string) =>
    apiFetch<{ message: string }>(`/api/dashboard/sessions/${id}`, { method: 'DELETE' });
export const getTransactions = () => apiFetch<Transaction[]>('/api/dashboard/transactions');
export const getTransactionsByUser = (userId: string) => apiFetch<Transaction[]>(`/api/dashboard/transactions/user/${userId}`);
export const getTransaction = (id: string) => apiFetch<Transaction>(`/api/dashboard/transactions/${id}`);
export const deleteTransaction = (id: string) =>
    apiFetch<{ message: string }>(`/api/dashboard/transactions/${id}`, { method: 'DELETE' });


// ── Spots ────────────────────────────────────────────────────────
/** Returns { data: Spot[], availablePlaces: number } */
export const getAllSpots = () => apiFetch<SpotsResponse>('/api/spots');
/** Live available-places summary: { total, occupied, reserved, available } */
export const getAvailablePlaces = () => apiFetch<AvailablePlaces>('/api/spots/available-count');
export const getSpot = (spotNumber: number) => apiFetch<Spot>(`/api/spots/${spotNumber}`);
export const updateSpotAdmin = (spotNumber: number, body: { isOccupied?: boolean; isReserved?: boolean }) =>
    apiFetch<Spot>(`/api/spots/${spotNumber}`, { method: 'PUT', body: JSON.stringify(body) });
export const deleteSpotAdmin = (spotNumber: number) =>
    apiFetch<{ message: string }>(`/api/spots/${spotNumber}`, { method: 'DELETE' });
/** Delete a spot by its UUID (used in the Parking Map UI) */
export const deleteSpot = (id: string) =>
    apiFetch<{ message: string }>(`/api/spots/by-id/${id}`, { method: 'DELETE' });

// ── Reservations ─────────────────────────────────────────────────
export const getAllReservations = () => apiFetch<Reservation[]>('/api/reservations');
export const getUserReservations = (userId: string) =>
    apiFetch<Reservation[]>(`/api/reservations/user/${userId}`);
export const getReservation = (id: string) => apiFetch<Reservation>(`/api/reservations/${id}`);
/** Spot is AUTO-ASSIGNED — do NOT pass spotNumber in the body */
export const createReservation = (body: CreateReservationBody) =>
    apiFetch<ReservationCreated>('/api/reservations', { method: 'POST', body: JSON.stringify(body) });
export const updateReservation = (id: string, body: Partial<CreateReservationBody>) =>
    apiFetch<Reservation>(`/api/reservations/${id}`, { method: 'PUT', body: JSON.stringify(body) });
export const cancelReservation = (id: string) =>
    apiFetch<{ message: string }>(`/api/reservations/${id}`, { method: 'DELETE' });
export const getSessionDetails = (sessionId: string) =>
    apiFetch<SessionDetail>(`/api/reservations/session/${sessionId}`);

// ── Gate ─────────────────────────────────────────────────────────
/** Admin/kiosk manual plate check — returns reservation info if found */
export const checkPlate = (plateNumber: string) =>
    apiFetch<PlateCheckResult>('/api/gate/check-plate', {
        method: 'POST',
        body: JSON.stringify({ plateNumber }),
    });

// ── Types ─────────────────────────────────────────────────────────
export interface LoginBody {
    email: string;
    password: string;
}

export interface RegisterBody {
    name: string;
    email: string;
    phone: string;
    vehiclePlateNumber: string;
    password: string;
    role?: 'user' | 'admin';
}

export interface AuthResponse {
    token: string;
    user: User;
}

export interface User {
    id: string;
    name: string;
    email: string;
    phone: string;
    vehiclePlateNumber: string;
    role: 'user' | 'admin';
    createdAt?: string;
}

export interface Stats {
    totalSpots: number;
    occupiedSpots: number;
    reservedSpots: number;
    availableSpots: number;
    revenueToday: number;
    totalRevenue: number;
    lastUpdated: string;
}

export interface Session {
    id: string;
    plateNumber: string;
    status: 'active' | 'completed';
    entryTime: string;
    exitTime?: string;
    duration?: number;
    price?: number;
    User?: { name: string; email: string };
    Reservation?: Reservation;
}

export interface SessionDetail extends Session {
    Transaction?: Transaction;
}

export interface Transaction {
    id: string;
    sessionId: string;
    amount: number;
    duration: number;
    plateNumber: string;
    createdAt: string;
    User?: { name: string; email: string };
}

export interface Spot {
    id: string;
    spotNumber: number;
    isOccupied: boolean;
    isReserved: boolean;
    lastUpdated: string;
    reservationId?: string;
}

export interface SpotsResponse {
    /** The raw Spot array comes from api.ts wrapping, so we need the parent */
    success: boolean;
    data: Spot[];
    availablePlaces: number;
}

export interface AvailablePlaces {
    total: number;
    occupied: number;
    reserved: number;
    available: number;
}

export interface Reservation {
    id: string;
    userId: string;
    spotNumber: number;         // auto-assigned
    plateNumber: string;        // gate-access identity
    reservedFrom: string;
    reservedUntil: string;
    status: 'pending' | 'active' | 'expired' | 'cancelled';
    User?: { name: string; email: string; vehiclePlateNumber: string };
}

export interface ReservationCreated {
    reservationId: string;
    spotNumber: number;         // auto-assigned
    plateNumber: string;
    reservedFrom: string;
    reservedUntil: string;
}

/** plateNumber is required — it is the gate-access identity */
export interface CreateReservationBody {
    userId?: string;            // optional — admin can create without a user account
    plateNumber: string;        // REQUIRED — gate opens by plate scan
    reservedFrom: string;
    reservedUntil: string;
}

export interface PlateCheckResult {
    hasReservation: boolean;
    plateNumber: string;
    reservation?: {
        id: string;
        spotNumber: number;
        reservedFrom: string;
        reservedUntil: string;
    };
    user?: { name: string; email: string } | null;
    message: string;
}
