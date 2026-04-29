import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { verifyOtp as apiVerifyOtp, getMe } from '../api/client';
import type { AppUser } from '../types';

interface AuthCtx {
  user: AppUser | null;
  token: string | null;
  loading: boolean;
  /** Termine la connexion : appelle /auth/verify-otp et stocke la session. */
  loginWithOtp: (phone: string, code: string) => Promise<void>;
  logout: () => void;
  /** Met à jour le user en mémoire après un PATCH /auth/me/* */
  refreshAuth: (token: string, user: AppUser) => void;
  isAdmin: boolean;
}

const Ctx = createContext<AuthCtx | null>(null);

function loadUser(): AppUser | null {
  try {
    const raw = localStorage.getItem('auth_user');
    return raw ? (JSON.parse(raw) as AppUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(loadUser);
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem('auth_token'),
  );
  const [loading, setLoading] = useState<boolean>(false);

  // Au boot : si on a un token mais pas de user (ou pour rafraîchir le user
  // après un changement côté serveur), on appelle /auth/me.
  useEffect(() => {
    if (!token) return;
    let alive = true;
    setLoading(true);
    getMe()
      .then((res) => {
        if (!alive) return;
        localStorage.setItem('auth_user', JSON.stringify(res.user));
        setUser(res.user);
      })
      .catch(() => {
        // Token invalide → cleanup côté client (le client.ts redirige déjà)
        if (!alive) return;
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        setToken(null);
        setUser(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loginWithOtp = useCallback(async (phone: string, code: string) => {
    const res = await apiVerifyOtp(phone, code);
    localStorage.setItem('auth_token', res.access_token);
    localStorage.setItem('auth_user', JSON.stringify(res.user));
    setToken(res.access_token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  }, []);

  const refreshAuth = useCallback((newToken: string, newUser: AppUser) => {
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  }, []);

  return (
    <Ctx.Provider
      value={{
        user,
        token,
        loading,
        loginWithOtp,
        logout,
        refreshAuth,
        isAdmin: user?.role === 'admin',
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useAuth(): AuthCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
