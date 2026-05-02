import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  LineChart,
  LogOut,
  Package,
  Receipt,
  Settings,
  Users,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { Avatar } from './ui/Avatar';
import { Logo } from './ui/Logo';
import { cn } from './ui/cn';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement | null>(null);

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const items: NavItem[] = [
    { to: '/', label: 'Produits', icon: Package, end: true },
    { to: '/orders', label: 'Commandes', icon: Receipt },
    { to: '/wallet', label: 'Portefeuille', icon: Wallet },
    { to: '/settings', label: 'Réglages', icon: Settings },
    ...(isAdmin
      ? [
          { to: '/admin/users', label: 'Utilisateurs', icon: Users },
          { to: '/admin/revenue', label: 'Bénéfices', icon: LineChart },
        ]
      : []),
  ];

  // Close user menu on outside click
  useEffect(() => {
    if (!userMenuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(e.target as Node)
      ) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [userMenuOpen]);

  const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
      isActive
        ? 'bg-emerald-50 text-emerald-700'
        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
    );

  const mobileTabClass = ({ isActive }: { isActive: boolean }) =>
    cn(
      // Cibles tactiles 56px de haut (>= Apple HIG 44px et Material 48px),
      // typo plus lisible, feedback "tap" via active:scale.
      'flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition-all',
      'active:scale-95 active:bg-slate-100',
      isActive ? 'text-emerald-700' : 'text-slate-500',
    );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top bar — sticky, respecte le notch iOS via safe-area-inset-top.
          Sur mobile, la barre s'étend visuellement sous le status bar grâce
          au padding-top dynamique, donnant un look "edge to edge" natif. */}
      <nav
        className="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-4 px-4 sm:h-16 sm:px-6">
          <Logo size="sm" />

          {/* Desktop nav */}
          <div className="ml-6 hidden flex-1 items-center gap-1 md:flex">
            {items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={desktopLinkClass}
              >
                {it.label}
              </NavLink>
            ))}
          </div>

          {/* User menu (desktop) + compact identity (mobile) */}
          <div ref={userMenuRef} className="relative ml-auto flex">
            <button
              type="button"
              onClick={() => setUserMenuOpen((v) => !v)}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-2 text-sm text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/30 sm:gap-2.5 sm:pr-3"
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
              aria-label="Compte"
            >
              <Avatar name={user?.displayName ?? user?.pseudo ?? '?'} size="sm" />
              <span className="hidden max-w-[120px] truncate font-medium lg:inline">
                @{user?.pseudo}
              </span>
              <ChevronDown className="h-4 w-4 text-slate-400" />
            </button>

            {userMenuOpen && (
              <div
                role="menu"
                className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-pop animate-fade-in"
              >
                <div className="border-b border-slate-100 px-4 py-3">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {user?.displayName}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    @{user?.pseudo}
                    <span className="ml-1 text-slate-400">· {user?.role}</span>
                  </p>
                </div>
                <div className="p-1">
                  <button
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      navigate('/settings');
                    }}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <Settings className="h-4 w-4 text-slate-400" />
                    Réglages
                  </button>
                  <button
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50"
                  >
                    <LogOut className="h-4 w-4" />
                    Déconnexion
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main — full-bleed sur mobile (px-0) pour permettre aux Cards de
          s'étendre bord à bord façon iOS grouped list. Padding latéral
          rétabli en sm+ pour le look web classique. */}
      <main className="mx-auto max-w-7xl space-y-4 px-0 py-4 pb-28 sm:space-y-6 sm:px-6 sm:py-8 sm:pb-8">
        <Outlet />
      </main>

      {/* Bottom nav (mobile only) — items 56px de haut, icônes 24px,
          padding home-bar safe-area, bordure plus marquée pour ancrer
          la barre au bas de l'écran comme une vraie tab bar iOS. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Navigation principale"
      >
        <div className="mx-auto flex max-w-md items-stretch gap-1 px-2 py-1">
          {items.map((it) => {
            const Icon = it.icon;
            return (
              <NavLink
                key={it.to}
                to={it.to}
                end={it.end}
                className={mobileTabClass}
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={cn(
                        'h-6 w-6 transition-colors',
                        isActive ? 'text-emerald-600' : 'text-slate-500',
                      )}
                      strokeWidth={isActive ? 2.25 : 2}
                    />
                    <span className="leading-none">{it.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
