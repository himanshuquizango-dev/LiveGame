'use client';

import { useRouter } from 'next/navigation';
import { authApi, User } from '@/lib/api';
import { useEffect, useState } from 'react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onReportIssueClick?: () => void;
}

export const Sidebar = ({ isOpen, onClose, onReportIssueClick }: SidebarProps) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    // Prevent body scroll when sidebar is open
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    // Cleanup
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const checkAuth = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        
        // Only fetch from API if we have a stored user (to refresh coins)
        try {
          const userData = await authApi.getCurrentUser();
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (err: any) {
          // If API call fails (401), user is no longer authenticated
          if (err?.response?.status === 401) {
            setUser(null);
            localStorage.removeItem('user');
          }
        }
      } else {
        // No stored user, don't make API call for guests
        setUser(null);
      }
    } catch (err) {
      setUser(null);
      localStorage.removeItem('user');
    } finally {
      setLoading(false);
    }
  };

  const handleMenuClick = (path: string) => {
    router.push(path);
    onClose(); // Close sidebar when navigating
  };

  const handleSignIn = () => {
    router.push('/login');
    onClose();
  };

  const handleProfileClick = () => {
    if (user) {
      router.push('/profile');
      onClose();
    }
  };

  return (
    <>
      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed top-0 h-full w-full sm:w-80 bg-[#172031] z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-y-full'
        }`}
        style={{
          boxShadow: '0px 0px 2px 0px #FFF6D9'
        }}
      >
        <div className="flex flex-col h-full">
          {/* Header with Close Button */}
          <div className="flex justify-end p-4">
            <button
              onClick={onClose}
              className="text-white hover:text-gray-300 transition-colors"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          </div>

          {/* User Profile Section */}
          <div className="px-6 pb-6  ">
            <div className="flex items-center gap-4">
              {/* Profile Avatar with Progress Circle */}
              <div className="relative">
                {/* Progress Circle SVG */}
                {user && (() => {
                  // Calculate profile completion percentage
                  const profile = user.profile;
                  const fields = [
                    profile?.mobileNo,
                    profile?.whatsappNo,
                    profile?.address,
                    profile?.city,
                    profile?.country,
                    profile?.postalCode,
                  ];
                  const filledFields = fields.filter(f => f && f.trim() !== '').length;
                  const completionPercentage = (filledFields / 6) * 100;
                  const circumference = 2 * Math.PI * 28; // radius = 28
                  const offset = circumference - (completionPercentage / 100) * circumference;
                  
                  return (
                    <svg className="absolute inset-0 w-16 h-16 transform -rotate-90" viewBox="0 0 64 64">
                      {/* Background circle */}
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke="rgba(255, 246, 217, 0.2)"
                        strokeWidth="4"
                      />
                      {/* Progress circle */}
                      <circle
                        cx="32"
                        cy="32"
                        r="28"
                        fill="none"
                        stroke={completionPercentage === 100 ? "#10b981" : completionPercentage >= 50 ? "#fbbf24" : "#ef4444"}
                        strokeWidth="4"
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={offset}
                        className="transition-all duration-500"
                      />
                    </svg>
                  );
                })()}
                
              <div
                onClick={user ? handleProfileClick : undefined}
                  className={`relative w-16 h-16 rounded-full bg-gray-400 flex items-center justify-center shadow-lg ${user ? 'cursor-pointer hover:scale-105 transition-transform' : ''}`}
              >
                {user?.picture ? (
                  <img
                    src={user.picture}
                    alt="Profile"
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : user?.name ? (
                  <span className="text-white text-2xl font-bold">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                    <svg className="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                )}
                </div>
              </div>

              {/* User Info */}
              <div className="flex-1">
                <h3 className="text-white text-xl font-bold">
                  {user?.name || 'Guest'}
                </h3>
                <p className="text-[#ffb540] text-sm mb-2 font-bold">Play Quiz & earn Coins</p>
                {user && user.profile && (() => {
                  const profile = user.profile;
                  const fields = [
                    profile?.mobileNo,
                    profile?.whatsappNo,
                    profile?.address,
                    profile?.city,
                    profile?.country,
                    profile?.postalCode,
                  ];
                  const filledFields = fields.filter(f => f && f.trim() !== '').length;
                  const completionPercentage = (filledFields / 6) * 100;
                  
                  if (completionPercentage < 100) {
                    return (
                      <p className="text-yellow-400 text-xs font-medium">
                        Complete the profile details
                      </p>
                    );
                  }
                  return null;
                })()}
                {!user && (
                  <button
                    onClick={handleSignIn}
                    className="bg-[#FFB540] text-white font-bold px-4 py-2 rounded-4xl w-40 hover:bg-yellow-500 transition-colors text-sm"
                  >
                    Sign in
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Menu Items */}
          <div className="flex-1 overflow-y-auto ">
            <div>
              {/* Quiz Rules */}
              <button
                onClick={() => handleMenuClick('/dashboard')}
                className="w-full flex items-center gap-4 pl-4  text-white hover:bg-[#ffb540] transition-colors text-left"
              >
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 20 20" aria-hidden="true" height="2em" width="2em" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M9.293 2.293a1 1 0 0 1 1.414 0l7 7A1 1 0 0 1 17 11h-1v6a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6H3a1 1 0 0 1-.707-1.707l7-7Z" clipRule="evenodd"></path></svg>
                <span className="font-medium underline">Home</span>
              </button>
              <button
                onClick={() => handleMenuClick('/quiz-rules')}
                className="w-full flex items-center gap-4 pl-4  mt-2 text-white hover:bg-[#ffb540] transition-colors text-left"
              >
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="2em" width="2em" xmlns="http://www.w3.org/2000/svg"><path d="M256 25c-11.594 0-23 12.8-23 31s11.406 31 23 31 23-12.8 23-31-11.406-31-23-31zm-103.951 2.975l-16.098 8.05c15.092 30.185 51.37 56.81 82.188 74.442L232.334 295H247V192h18v103h14.666l14.195-184.533c30.818-17.632 67.096-44.257 82.188-74.442l-16.098-8.05c-19.91 29.9-44.891 49.148-71.334 57.77C281.311 97.28 269.75 105 256 105c-13.75 0-25.31-7.72-32.617-19.256-26.443-8.62-51.424-27.87-71.334-57.77zM169 313v96H25v78h462v-30H343V313H169z"></path></svg>
                <span className="font-medium underline">Contest Rules</span>
              </button>

              {/* Coin History */}
              <button
                onClick={() => handleMenuClick('/coin-history')}
                className="w-full flex items-center gap-4 pl-4  mt-2 text-white hover:bg-[#ffb540] transition-colors text-left"
              >
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="2em" width="2em" xmlns="http://www.w3.org/2000/svg"><path d="M504 255.531c.253 136.64-111.18 248.372-247.82 248.468-59.015.042-113.223-20.53-155.822-54.911-11.077-8.94-11.905-25.541-1.839-35.607l11.267-11.267c8.609-8.609 22.353-9.551 31.891-1.984C173.062 425.135 212.781 440 256 440c101.705 0 184-82.311 184-184 0-101.705-82.311-184-184-184-48.814 0-93.149 18.969-126.068 49.932l50.754 50.754c10.08 10.08 2.941 27.314-11.313 27.314H24c-8.837 0-16-7.163-16-16V38.627c0-14.254 17.234-21.393 27.314-11.314l49.372 49.372C129.209 34.136 189.552 8 256 8c136.81 0 247.747 110.78 248 247.531zm-180.912 78.784l9.823-12.63c8.138-10.463 6.253-25.542-4.21-33.679L288 256.349V152c0-13.255-10.745-24-24-24h-16c-13.255 0-24 10.745-24 24v135.651l65.409 50.874c10.463 8.137 25.541 6.253 33.679-4.21z"></path></svg>
                <span className="font-medium underline">Coin History</span>
              </button>

              {/* About Us */}
              <button
                onClick={() => handleMenuClick('/about-us')}
                className="w-full flex items-center gap-4 pl-4  mt-2 text-white hover:bg-[#ffb540] transition-colors text-left"
              >
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="2em" width="2em" xmlns="http://www.w3.org/2000/svg"><path d="M192 32c0 17.7 14.3 32 32 32c123.7 0 224 100.3 224 224c0 17.7 14.3 32 32 32s32-14.3 32-32C512 128.9 383.1 0 224 0c-17.7 0-32 14.3-32 32zm0 96c0 17.7 14.3 32 32 32c70.7 0 128 57.3 128 128c0 17.7 14.3 32 32 32s32-14.3 32-32c0-106-86-192-192-192c-17.7 0-32 14.3-32 32zM96 144c0-26.5-21.5-48-48-48S0 117.5 0 144L0 368c0 79.5 64.5 144 144 144s144-64.5 144-144s-64.5-144-144-144l-16 0 0 96 16 0c26.5 0 48 21.5 48 48s-21.5 48-48 48s-48-21.5-48-48l0-224z"></path></svg>
                <span className="font-medium underline">About Us</span>
              </button>

              {/* Contact Us */}
              <button
                onClick={() => handleMenuClick('/contact-us')}
                className="w-full flex items-center gap-4 pl-4  mt-2 text-white hover:bg-[#ffb540] transition-colors text-left"
              >
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="2em" width="2em" xmlns="http://www.w3.org/2000/svg"><path fill="none" d="M0 0h24v24H0z"></path><path d="M11 14H9a9 9 0 0 1 9-9v2c-3.87 0-7 3.13-7 7zm7-3V9c-2.76 0-5 2.24-5 5h2c0-1.66 1.34-3 3-3zM7 4c0-1.11-.89-2-2-2s-2 .89-2 2 .89 2 2 2 2-.89 2-2zm4.45.5h-2A2.99 2.99 0 0 1 6.5 7h-3C2.67 7 2 7.67 2 8.5V11h6V8.74a4.97 4.97 0 0 0 3.45-4.24zM19 17c1.11 0 2-.89 2-2s-.89-2-2-2-2 .89-2 2 .89 2 2 2zm1.5 1h-3a2.99 2.99 0 0 1-2.95-2.5h-2A4.97 4.97 0 0 0 16 19.74V22h6v-2.5c0-.83-.67-1.5-1.5-1.5z"></path></svg>
                <span className="font-medium underline">Contact Us</span>
              </button>

              {/* Report An Issue */}
              <button
                onClick={() => {
                  onClose();
                  if (onReportIssueClick) {
                    onReportIssueClick();
                  }
                }}
                className="w-full flex items-center gap-4 pl-4  mt-2 text-white hover:bg-[#ffb540] transition-colors text-left"
              >
                <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 24 24" height="2em" width="2em" xmlns="http://www.w3.org/2000/svg"><path fill="none" d="M0 0h24v24H0V0z"></path><path d="M15.73 3H8.27L3 8.27v7.46L8.27 21h7.46L21 15.73V8.27L15.73 3zM19 14.9 14.9 19H9.1L5 14.9V9.1L9.1 5h5.8L19 9.1v5.8z"></path><circle cx="12" cy="16" r="1"></circle><path d="M11 7h2v7h-2z"></path></svg>
                <span className="font-medium underline">Report An Issue</span>
              </button>
            </div>
          </div>

          

        </div>
      </div>
    </>
  );
};

