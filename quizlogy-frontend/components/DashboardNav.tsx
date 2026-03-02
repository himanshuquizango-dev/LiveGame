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
      <div className="w-full bg-[#0D0009] border-b border-[#564C53] relative">
        {/* Bell GIF in corner */}
        <div className="flex items-center justify-between px-4 py-3 w-full">
          {/* Left Section: Hamburger Menu + Logo + Quizwala */}
          <div className="flex items-center gap-3 flex-shrink-0">
            {/* Hamburger Menu Icon */}
            <button 
              onClick={() => setSidebarOpen(true)}
              className="flex flex-col gap-1.5 cursor-pointer hover:opacity-80 transition-opacity flex-shrink-0"
            >
                          <svg
              width="50"
              height="50"
              viewBox="0 0 120 120"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect x="20" y="25" width="55" height="8" rx="2" fill="#E5E7EB" />
              <rect x="20" y="50" width="55" height="8" rx="2" fill="#E5E7EB" />
              <rect x="20" y="75" width="80" height="8" rx="2" fill="#E5E7EB" />

              <polygon
                points="80,22 100,42 80,62 85,62 105,42 85,22"
                fill="#E5E7EB"
              />
            </svg>
            </button>

            <div className="text-3xl font-bold text-[#ffb540]" style={{fontFamily: 'monospace'}}>Quizwinz</div>
          </div>

          <div className="flex items-center gap-1 border border-yellow-400 px-3 py-1 rounded-full text-yellow-400 text-sm font-semibold">
            🪙 {guestCoins.toLocaleString()}
          </div>
        </div>
      </div>
    </>
  );
};
