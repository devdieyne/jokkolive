import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';

// PWA : capturer `beforeinstallprompt` LE PLUS TÔT POSSIBLE.
// Chrome/Edge dispatchent cet event une seule fois, parfois avant même que
// React ne monte. On le stash dans `window` ; le composant InstallPrompt
// le lira ensuite. Sans ça, on rate l'event sur les chargements rapides.
declare global {
  interface Window {
    __pwaInstallEvent?: Event;
  }
}
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__pwaInstallEvent = e;
  // Permet au composant InstallPrompt de réagir s'il était déjà monté.
  window.dispatchEvent(new CustomEvent('pwa:installable'));
});

import { Layout } from './components/Layout';
import { ProtectedRoute } from './components/ProtectedRoute';
import { OfflineBanner } from './components/OfflineBanner';
import { InstallPrompt } from './components/InstallPrompt';
import { LoginPage } from './pages/LoginPage';
import { OtpPage } from './pages/OtpPage';
import { MagicAuthPage } from './pages/MagicAuthPage';
import { ProductsPage } from './pages/ProductsPage';
import { OrdersPage } from './pages/OrdersPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminRevenuePage } from './pages/AdminRevenuePage';
import { PayPage } from './pages/PayPage';
import { WalletPage } from './pages/WalletPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { TermsPage } from './pages/TermsPage';
import { ShopPage } from './pages/ShopPage';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

function AppRoutes() {
  return (
    <Routes>
      {/* Public — pas d'auth */}
      <Route path="/login" element={<LoginPage />} />
      {/* Inscription publique désactivée : /register redirige vers /login */}
      <Route path="/register" element={<Navigate to="/login" replace />} />
      <Route path="/otp" element={<OtpPage />} />
      <Route path="/auth/magic" element={<MagicAuthPage />} />
      <Route path="/pay/:token" element={<PayPage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/shop/:pseudo" element={<ShopPage />} />

      {/* Vendeur connecté */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ProductsPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route
          path="admin/users"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminUsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="admin/revenue"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminRevenuePage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
          {/* PWA helpers — montés au niveau global pour être visibles sur
              TOUTES les routes (login, register, dashboard…), pas seulement
              quand le user est authentifié. */}
          <OfflineBanner />
          <InstallPrompt />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
