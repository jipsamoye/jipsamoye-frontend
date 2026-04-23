'use client';

import { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import MobileDrawer from './MobileDrawer';
import FloatingWriteButton from './FloatingWriteButton';
import LoginModal from '@/components/domain/LoginModal';
import { useAuthContext } from '@/components/providers/AuthProvider';
import ToastContainer from '@/components/common/Toast';
import AppProviders from '@/components/providers/AppProviders';
import HomeRefreshProvider, { useHomeRefresh } from '@/components/providers/HomeRefreshProvider';

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { user, loginAsGuest, logout } = useAuthContext();
  const { refreshKey } = useHomeRefresh();
  const [showLogin, setShowLogin] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  return (
    <>
      <Header
        isLoggedIn={!!user}
        onLoginClick={() => setShowLogin(true)}
        onLogout={logout}
        onMobileMenuClick={() => setShowMobileMenu(true)}
        nickname={user?.nickname}
        profileImageUrl={user?.profileImageUrl}
      />
      <Sidebar />
      <MobileDrawer isOpen={showMobileMenu} onClose={() => setShowMobileMenu(false)} />
      <main className="pt-16 lg:pl-52 overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div key={refreshKey}>{children}</div>
        </div>
      </main>
      {user && <FloatingWriteButton />}
      <LoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onGuestLogin={loginAsGuest}
      />
      <ToastContainer />
    </>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppProviders>
      <HomeRefreshProvider>
        <LayoutContent>{children}</LayoutContent>
      </HomeRefreshProvider>
    </AppProviders>
  );
}
