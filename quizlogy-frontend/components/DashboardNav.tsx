'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi, User } from '@/lib/api';
import { Sidebar } from './Sidebar';
import { ReportIssueModal } from './ReportIssueModal';

export const DashboardNav = () => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [reportIssueModalOpen, setReportIssueModalOpen] = useState(false);
  const [guestCoins, setGuestCoins] = useState<number>(0);

  useEffect(() => {
    checkAuth();
    updateGuestCoins();

    // Listen for storage changes (for guest coins and user updates)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'guestCoins') {
        updateGuestCoins();
      } else if (e.key === 'user') {
        // User data was updated, refresh
        checkAuth();
      }
    };

    // Listen for custom events (triggered when coins are updated)
    const handleCoinsUpdate = () => {
      // Update immediately from localStorage first (instant update)
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const parsedUser = JSON.parse(storedUser);
          setUser(parsedUser);
        } catch (e) {
          console.error('Error parsing user:', e);
        }
      }
      updateGuestCoins();

      // Then fetch fresh data from API in background (for sync)
      (async () => {
        try {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            const userData = await authApi.getCurrentUser();
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
          }
        } catch (err) {
          // If API call fails, keep the localStorage value
        }
      })();
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('coinsUpdated', handleCoinsUpdate);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('coinsUpdated', handleCoinsUpdate);
    };
  }, []);

  const updateGuestCoins = () => {
    const coins = parseInt(localStorage.getItem('guestCoins') || '0');
    setGuestCoins(coins);
  };

  const checkAuth = async () => {
    try {
      // Try to get from localStorage first for immediate display
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);

        // Always fetch fresh data from API to get updated coins
        // This ensures coins are always in sync with the database
        try {
          const userData = await authApi.getCurrentUser();
          // Only update if coins changed or if it's a fresh fetch
          if (userData.coins !== parsedUser.coins || !parsedUser.coins) {
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
          } else {
            // Coins are the same, but update other fields that might have changed
            setUser(userData);
            localStorage.setItem('user', JSON.stringify(userData));
          }
        } catch (err) {
          // Session expired, but keep stored user for now
          // Just update from localStorage
          setUser(parsedUser);
        }
      } else {
        setUser(null);
      }
    } catch (err) {
      // User not authenticated - this is fine for guests
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        onReportIssueClick={() => setReportIssueModalOpen(true)}
      />
      <ReportIssueModal
        isOpen={reportIssueModalOpen}
        onClose={() => setReportIssueModalOpen(false)}
      />

      <div className="w-full bg-[#172031] relative">
        <div className="flex items-center justify-between px-4 py-3 w-full">

          {/* Left Side: Sidebar Button */}
          <div className="flex items-center flex-shrink-0 z-10">
            <button
              onClick={() => setSidebarOpen(true)}
              className="flex flex-col gap-1.5 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0 text-white"
            ><svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="2em" width="2em" xmlns="http://www.w3.org/2000/svg"><path d="M21 17.9995V19.9995H3V17.9995H21ZM17.4038 3.90332L22 8.49951L17.4038 13.0957L15.9896 11.6815L19.1716 8.49951L15.9896 5.31753L17.4038 3.90332ZM12 10.9995V12.9995H3V10.9995H12ZM12 3.99951V5.99951H3V3.99951H12Z"></path></svg>
            </button>
          </div>

          {/* Center: Quizwinz */}
          <div className="absolute left-1/2 -translate-x-1/2 text-3xl font-bold text-[#ffb540]" style={{ fontFamily: 'monospace' }}>
            Quizwinz
          </div>

          {/* Right Side: Coins */}
          <div className="flex items-center gap-1 border-2 border-yellow-400 px-3 py-1 rounded-full text-yellow-400 text-sm font-semibold z-10">
            🪙 {guestCoins.toLocaleString()}
          </div>

        </div>
      </div>
    </>
  );
};
