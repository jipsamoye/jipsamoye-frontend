'use client';

import { useState } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import LoginModal from '@/components/domain/LoginModal';
import { useAuthContext } from '@/components/providers/AuthProvider';
import ToastContainer from '@/components/common/Toast';
import AppProviders from '@/components/providers/AppProviders';

function LayoutContent({ children }: { children: React.ReactNode }) {
  const { user, loginAsGuest, logout } = useAuthContext();
  const [showLogin, setShowLogin] = useState(false);

  return (
    <>
      <Header
        isLoggedIn={!!user}
        onLoginClick={() => setShowLogin(true)}
        onLogout={logout}
        nickname={user?.nickname}
        profileImageUrl={user?.profileImageUrl}
      />
      <Sidebar />
      <main className="pt-16 lg:pl-52 pb-16 lg:pb-0 overflow-x-hidden">
        <div className="max-w-7xl mx-auto px-4 py-6">
          {children}
        </div>
      </main>
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
      <LayoutContent>{children}</LayoutContent>
    </AppProviders>
  );
}
