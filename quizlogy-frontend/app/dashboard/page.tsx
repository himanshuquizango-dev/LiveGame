'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { QuizCard } from '@/components/QuizCard';
import { ContestCard } from '@/components/ContestCard';
import { PlayGamesSection } from '@/components/PlayGamesSection';
import AdsenseAd from '@/components/AdsenseAd';
import { SEOHead } from '@/components/SEOHead';
import { contestsApi, Contest, categoriesApi, Category, getImageUrl, authApi, battlesApi, Battle } from '@/lib/api';
import { isDailyContest, isDailyContestLive, getNextDailyStartTime } from '@/lib/dailyContestUtils';

// Sort contests: Live Daily (highest priority) > Active > Upcoming Daily > Upcoming > Past Daily > Past
const sortContests = (contests: Contest[]): Contest[] => {
  const now = new Date();

  const liveDaily: Contest[] = [];
  const active: Contest[] = [];
  const upcomingDaily: Contest[] = [];
  const upcoming: Contest[] = [];
  const pastDaily: Contest[] = [];
  const past: Contest[] = [];

  contests.forEach((contest) => {
    if (isDailyContest(contest)) {
      // Daily contest logic
      const isLive = isDailyContestLive(contest.dailyStartTime, contest.dailyEndTime);
      
      if (isLive) {
        liveDaily.push(contest);
      } else {
        // Check if it's past today's end time
        const [endHours, endMinutes] = (contest.dailyEndTime || '23:59').split(':').map(Number);
        const currentHours = now.getHours();
        const currentMinutes = now.getMinutes();
        const currentTotalMinutes = currentHours * 60 + currentMinutes;
        const endTotalMinutes = endHours * 60 + endMinutes;
        
        if (currentTotalMinutes >= endTotalMinutes) {
          pastDaily.push(contest);
        } else {
          upcomingDaily.push(contest);
        }
      }
    } else {
      // Regular contest logic
      if (!contest.startDate || !contest.endDate) {
        past.push(contest);
        return;
      }

      const start = new Date(contest.startDate);
      const end = new Date(contest.endDate);

      if (now >= start && now <= end) {
        active.push(contest);
      } else if (now < start) {
        upcoming.push(contest);
      } else {
        past.push(contest);
      }
    }
  });

  // Sort live daily contests (no specific order needed, all are live)
  // Sort active by end date (ascending - ending soon first)
  active.sort((a, b) => {
    if (!a.endDate || !b.endDate) return 0;
    return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
  });
  // Sort upcoming by start date (ascending)
  upcoming.sort((a, b) => {
    if (!a.startDate || !b.startDate) return 0;
    return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
  });
  // Sort past by end date (descending)
  past.sort((a, b) => {
    if (!a.endDate || !b.endDate) return 0;
    return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
  });

  return [...liveDaily, ...active, ...upcomingDaily, ...upcoming, ...pastDaily, ...past];
};

export default function DashboardPage() {
  const router = useRouter();
  const [topBattles, setTopBattles] = useState<Battle[]>([]);
  const [favoriteBattles, setFavoriteBattles] = useState<Set<string>>(new Set());
  const [contestsForYou, setContestsForYou] = useState<Contest[]>([]);
  const [trendingQuizzes, setTrendingQuizzes] = useState<Contest[]>([]);
  const [allContests, setAllContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingBattles, setLoadingBattles] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  // Random playing counts assigned per load so live contests sort by "highest players" and order changes on refresh
  const [liveContestPlayerCounts, setLiveContestPlayerCounts] = useState<Record<string, number>>({});
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('All');
  const categoryTabsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetchContests();
    fetchBattles();
    fetchCategories();
    // Check if user is logged in and fetch user data
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // Check localStorage first - if no user stored, don't make API call
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      // No stored user, guest mode - don't make API call
      return;
    }
    
    try {
      // Only fetch from API if we have a stored user (to refresh coins)
      const user = await authApi.getCurrentUser();
      if (user) {
        localStorage.setItem('user', JSON.stringify(user));
      }
    } catch (err: any) {
      // If API call fails (401), user is no longer authenticated
      if (err?.response?.status === 401) {
        localStorage.removeItem('user');
      }
      // Silently handle - don't log 401 errors
    }
  };

  const fetchBattles = async () => {
    try {
      setLoadingBattles(true);
      const battles = await battlesApi.getAll('ACTIVE');
      
      // Sort battles by order field (higher order first), then by createdAt if order is same
      const sortedBattles = battles.sort((a, b) => {
        const orderA = (a as any).order || 0;
        const orderB = (b as any).order || 0;
        if (orderB !== orderA) {
          return orderB - orderA; // Higher order first
        }
        // If order is same, sort by createdAt (newer first)
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      
      // Get top 3 battles
      setTopBattles(sortedBattles.slice(0, 3));
    } catch (err) {
      console.error('Error fetching battles:', err);
    } finally {
      setLoadingBattles(false);
    }
  };

  const fetchContests = async () => {
    try {
      setLoading(true);
      const response = await contestsApi.getList();
      const contests = response.data || [];
      
      // Log what we received from backend
      // console.log('📥 Contests from backend:', contests.map(c => ({
      //   id: c.id,
      //   name: c.name,
      //   contestImage: c.contestImage,
      //   contestImageType: typeof c.contestImage
      // })));
      
      // Only show LIVE contests: daily that are in their time window, or regular that are between start and end
      const now = new Date();
      const liveContests = contests.filter((contest) => {
        if (isDailyContest(contest)) {
          return isDailyContestLive(contest.dailyStartTime, contest.dailyEndTime);
        }
        if (!contest.startDate || !contest.endDate) return false;
        const start = new Date(contest.startDate);
        const end = new Date(contest.endDate);
        return now >= start && now <= end;
      });

      // Assign random playing count to each live contest (changes on refresh so order switches)
      const counts: Record<string, number> = {};
      liveContests.forEach((c) => {
        counts[c.id] = Math.floor(Math.random() * 600) + 100; // 100–700
      });
      setLiveContestPlayerCounts(counts);

      // Sort by assigned playing count descending (highest players on top)
      const sortedLive = [...liveContests].sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));

      setAllContests(sortedLive);
      setContestsForYou(sortedLive);
      setTrendingQuizzes(sortedLive.slice(0, 8));
    } catch (err) {
      console.error('Error fetching contests:', err);
      setError('Failed to load contests. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      setLoadingCategories(true);
      const data = await categoriesApi.getAllWithDetails();
      setCategories(data);
    } catch (err) {
      console.error('Error fetching categories:', err);
    } finally {
      setLoadingCategories(false);
    }
  };

  // Get trending categories with specific styling
  const getTrendingCategories = (): Category[] => {
    if (!categories.length) return [];
    
    // Map category names to specific background colors (case-insensitive matching)
    const categoryColorMap: { [key: string]: string } = {
      'flags': '#FFF6D9',
      'logo quiz': '#E5F5FF',
      'indian mythology': '#FFEDF7',
      'marvel': '#E5F5FF',
    };

    // Find matching categories
    const trending: Category[] = [];
    const lowerNames = categories.map(c => c.name.toLowerCase());
    
    Object.entries(categoryColorMap).forEach(([name, bgColor]) => {
      const index = lowerNames.findIndex(n => n.includes(name) || name.includes(n));
      if (index !== -1) {
        const cat = categories[index];
        trending.push({ ...cat, backgroundColor: bgColor });
      }
    });

    // If we don't have 4, fill with first available categories (use their own backgroundColor or default)
    while (trending.length < 4 && trending.length < categories.length) {
      const remaining = categories.filter(c => !trending.some(t => t.id === c.id));
      if (remaining.length > 0) {
        const cat = remaining[0];
        trending.push(cat);
      } else {
        break;
      }
    }

    return trending.slice(0, 4);
  };

  const handleCategorySelect = (category: Category) => {
    const isSelected = selectedCategories.some(cat => cat.id === category.id);
    
    if (isSelected) {
      // Remove category
      setSelectedCategories(selectedCategories.filter(cat => cat.id !== category.id));
    } else {
      // Add category (max 3)
      if (selectedCategories.length < 3) {
        setSelectedCategories([...selectedCategories, category]);
      } else {
        alert('You can select maximum 3 categories');
      }
    }
  };

  const handleModalCategorySelect = (category: Category) => {
    handleCategorySelect(category);
  };

  const handleDone = () => {
    setShowCategoryModal(false);
  };

  const handleCreateQuiz = () => {
    if (selectedCategories.length === 0) {
      alert('Please select at least one category');
      return;
    }
    
    // Store selected category names in sessionStorage and redirect
    const categoryNames = selectedCategories.map(cat => cat.name);
    sessionStorage.setItem('customContestCategories', JSON.stringify(categoryNames));
    router.push('/custom-contest');
  };

  const handleCardClick = (contestId: string) => {
    // Navigate to contest rules page
    router.push(`/contest/${contestId}/rules`);
  };

  const handleBattleClick = (battleId: string) => {
    // Navigate to battle rules page
    router.push(`/battles/${battleId}/rules`);
  };

  const [showPlayModal, setShowPlayModal] = useState(false);
  const [playModalData, setPlayModalData] = useState<{
    contest: Contest | null;
    message: string;
    timeRemaining?: string;
    isUpcoming?: boolean;
  }>({ contest: null, message: '', isUpcoming: false });

  const handlePlayClick = (contestId: string) => {
    const contest = [...contestsForYou].find(c => c.id === contestId);
    if (!contest) return;

    // Handle daily contests
    if (isDailyContest(contest)) {
      const isLive = isDailyContestLive(contest.dailyStartTime, contest.dailyEndTime);
      
      if (isLive) {
        // Live - allow playing
        router.push(`/contest/${contestId}/rules`);
      } else {
        // Not live - show message with next start time
        const nextStart = getNextDailyStartTime(contest.dailyStartTime);
        if (nextStart) {
          const hours = nextStart.getHours();
          const minutes = nextStart.getMinutes();
          const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
          
          setPlayModalData({
            contest,
            message: `Come back tomorrow to play daily quiz at ${timeStr}`,
            isUpcoming: false
          });
          setShowPlayModal(true);
        } else {
          setPlayModalData({
            contest,
            message: 'Daily quiz is not currently available',
            isUpcoming: false
          });
          setShowPlayModal(true);
        }
      }
      return;
    }

    // Handle regular contests
    if (!contest.startDate || !contest.endDate) {
      setPlayModalData({
        contest,
        message: 'Contest dates are not configured',
        isUpcoming: false
      });
      setShowPlayModal(true);
      return;
    }

    const now = new Date();
    const start = new Date(contest.startDate);
    const end = new Date(contest.endDate);

    if (now < start) {
      // Upcoming - show time until start
      const diff = start.getTime() - now.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      let timeStr = '';
      if (days > 0) {
        timeStr = `${days} day${days > 1 ? 's' : ''}, ${hours} hour${hours > 1 ? 's' : ''}`;
      } else if (hours > 0) {
        timeStr = `${hours} hour${hours > 1 ? 's' : ''}, ${minutes} minute${minutes > 1 ? 's' : ''}`;
      } else {
        timeStr = `${minutes} minute${minutes > 1 ? 's' : ''}`;
      }

      setPlayModalData({
        contest,
        message: `Quiz starts in ${timeStr}`,
        timeRemaining: timeStr,
        isUpcoming: true
      });
      setShowPlayModal(true);
    } else if (now > end) {
      // Past - show ended message
      setPlayModalData({
        contest,
        message: 'Quiz has ended',
        isUpcoming: false
      });
      setShowPlayModal(true);
    } else {
      // Live - allow playing
      router.push(`/contest/${contestId}/rules`);
    }
  };

  // Use assigned random playing count for live contests (same as used for sorting); 0 otherwise
  const getPlayerCount = (contest: Contest): number => {
    if (liveContestPlayerCounts[contest.id] !== undefined) {
      return liveContestPlayerCounts[contest.id];
    }
    return 0;
  };

  // Tabs at the top: "All" plus dynamic category names
  const categoryTabs: string[] = [
    'All',
    ...Array.from(
      new Set(
        categories
          .map((cat) => cat.name?.trim())
          .filter((name): name is string => !!name && name.length > 0)
      )
    ),
  ];

  // Base contests list (all live contests we fetched)
  const baseContests = allContests.length > 0 ? allContests : contestsForYou;

  // Filter contests by selected category tab
  const filteredContests: Contest[] =
    selectedCategoryFilter === 'All'
      ? baseContests
      : baseContests.filter((contest) => {
          const contestCategory = (contest.categoryName || contest.category || '').trim().toLowerCase();
          const target = selectedCategoryFilter.trim().toLowerCase();
          return contestCategory !== '' && contestCategory === target;
        });

  return (
    <>
      <SEOHead 
        title="Quizwala Dashboard - Play Quizzes & Earn Coins"
        description="Explore top quizzes, daily contests, and trending quiz topics on Quizwala. Play quizzes, earn coins, and compete with players worldwide. Start your quiz journey today!"
        keywords="quiz dashboard, play quizzes, earn coins, daily quiz, quiz contests, quiz games, knowledge test"
      />
      <DashboardNav />

            <div className="bg-[#252F424D]   mb-5 shadow-lg">
              <div className="w-full overflow-hidden">
                <AdsenseAd adSlot="8153775072" adFormat="auto" />
              </div>
              <p className="text-center text-[#414d65] text-xs mt-2 mb-2 font-medium">A D V E R T I S E M E N T</p>
            </div>
      <div className="min-h-screen bg-[#172030]">
        <div className="max-w-md mx-auto px-3 pb-6 pt-1">
          {/* Top category tabs with left/right scroll buttons near edges */}
          <div className="relative flex items-center mb-3 -mx-1">
            <button
              type="button"
              onClick={() => {
                if (categoryTabsRef.current) {
                  categoryTabsRef.current.scrollBy({ left: -140, behavior: 'smooth' });
                }
              }}
              className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-transparent border border-[#64748b] flex items-center justify-center text-[#94a3b8] hover:border-[#94a3b8] hover:text-white"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            <div
              ref={categoryTabsRef}
              className="flex-1 flex items-center gap-1.5 overflow-x-auto hide-scrollbar px-8"
            >
              {categoryTabs.map((label) => {
                const isActive = selectedCategoryFilter === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => setSelectedCategoryFilter(label)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold border transition-all flex-shrink-0 ${
                      isActive
                        ? 'bg-[#172030] text-[#ffb540] border-[#ffb540]'
                        : 'bg-transparent text-[#e2e8f0] border-[#334155] hover:text-white hover:border-[#475569]'
                    }`}
                  >
                    {label.toUpperCase()}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => {
                if (categoryTabsRef.current) {
                  categoryTabsRef.current.scrollBy({ left: 140, behavior: 'smooth' });
                }
              }}
              className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-transparent border border-[#64748b] flex items-center justify-center text-[#94a3b8] hover:border-[#94a3b8] hover:text-white"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Contests list */}
          <div className="space-y-2">
            {loading && (
              <div className="text-center text-[#E5E7EB] py-8 text-sm">Loading contests...</div>
            )}

            {error && !loading && (
              <div className="text-center text-red-400 py-8 text-sm">{error}</div>
            )}

            {!loading && !error && (
              <>
                {filteredContests.length === 0 ? (
                  <div className="text-center text-[#E5E7EB] py-8 text-sm">
                    No contests available for this category.
                  </div>
                ) : (
                  <>
                    {filteredContests.map((contest) => {
                      const mainCategory =
                        (contest.categoryName || contest.category || '').trim() || 'Quiz';
                      const subLabel = contest.name && contest.name !== mainCategory ? contest.name : '';
                      const categoryLine = subLabel ? `${mainCategory} | ${subLabel}` : mainCategory;
                      const prizeText =
                        contest.winCoins && contest.winCoins > 0
                          ? `Play and Win ${contest.winCoins.toLocaleString()}`
                          : contest.name || 'Play and Win';
                      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

                      return (
                        <button
                          key={contest.id}
                          type="button"
                          onClick={() => handlePlayClick(contest.id)}
                          className="w-full flex items-center gap-3 rounded-2xl bg-[#1e2a3a] px-4 py-3 border border-[#2a3648] hover:border-[#3d4d63] transition-colors text-left"
                        >
                          {/* Left: contest image */}
                          <div className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden flex items-center justify-center">
                            {contest.contestImage ? (
                              <img
                                src={getImageUrl(contest.contestImage)}
                                alt={contest.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  const img = e.currentTarget as HTMLImageElement;
                                  const triedCategories = img.dataset.triedCategories === 'true';
                                  const triedContests = img.dataset.triedContests === 'true';
                                  const filename = contest.contestImage;
                                  if (filename && !filename.includes('/')) {
                                    if (img.src.includes('/uploads/contests/') && !triedCategories) {
                                      img.dataset.triedContests = 'true';
                                      img.dataset.triedCategories = 'true';
                                      img.src = `${baseUrl}/uploads/categories/${filename}`;
                                    } else if (img.src.includes('/uploads/categories/') && !triedContests) {
                                      img.dataset.triedCategories = 'true';
                                      img.dataset.triedContests = 'true';
                                      img.src = `${baseUrl}/uploads/contests/${filename}`;
                                    } else {
                                      img.style.display = 'none';
                                      const fallback = img.nextElementSibling as HTMLElement;
                                      if (fallback) fallback.classList.remove('hidden');
                                    }
                                  } else {
                                    img.style.display = 'none';
                                    const fallback = img.nextElementSibling as HTMLElement;
                                    if (fallback) fallback.classList.remove('hidden');
                                  }
                                }}
                              />
                            ) : null}
                            <div className={`w-full h-full rounded-xl bg-gradient-to-br from-cyan-400 via-blue-500 to-violet-500 flex items-center justify-center ${contest.contestImage ? 'hidden' : ''}`}>
                              <span className="text-white/90 text-lg font-bold">?</span>
                            </div>
                          </div>

                          {/* Middle text */}
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-[#94a3b8] font-medium truncate leading-tight">
                              {categoryLine}
                            </p>
                            <p className="text-base font-semibold text-white truncate leading-tight mt-0.5">
                              {prizeText}
                            </p>
                            <div className="inline-flex items-center gap-1.5 mt-1.5 rounded-full bg-[#172030] px-2 py-1">
                              <span className="text-xs text-[#94a3b8]">Entry Fee</span>
                              <img src="/coin2.svg" alt="" className="w-4 h-4 object-contain" />
                              <span className="text-xs font-semibold text-white">
                                {contest.joining_fee.toLocaleString()}
                              </span>
                            </div>
                          </div>

                          {/* Play button */}
                          <div className="flex-shrink-0">
                            <div className="w-12 h-12 rounded-full bg-[#ffb540] flex items-center justify-center active:scale-95 transition-transform">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                viewBox="0 0 24 24"
                                className="w-6 h-6 text-white ml-0.5"
                                fill="currentColor"
                              >
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Category Selection Modal */}
      {showCategoryModal && (
        <div 
          className="fixed inset-0 bg-black/70 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowCategoryModal(false)}
        >
          <div 
            className="bg-[#0D0009] rounded-t-3xl sm:rounded-3xl w-full max-w-md max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
            style={{
              boxShadow: '0px 0px 2px 0px #FFF6D9'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="bg-[#0D0009] px-6 py-4 flex items-center justify-between border-b border-[#FFF6D9]/20">
              <h2 className="text-[#FFF6D9] text-xl font-bold">Select Categories</h2>
              <button
                onClick={() => setShowCategoryModal(false)}
                className="text-[#FFF6D9]/70 hover:text-[#FFF6D9] text-2xl font-light w-8 h-8 flex items-center justify-center"
              >
                ×
              </button>
            </div>

            {/* Selected Count */}
            <div className="px-6 py-3 bg-[#0D0009]/80">
              <p className="text-[#FFF6D9]/70 text-sm">
                Selected: <span className="text-yellow-400 font-semibold">{selectedCategories.length}/3</span>
              </p>
            </div>

            {/* Categories Grid */}
            <div className="flex-1 overflow-y-auto p-6 bg-[#0D0009]">
              {loadingCategories ? (
                <div className="text-center text-[#FFF6D9] py-12">
                  <div className="text-lg">Loading categories...</div>
                </div>
              ) : categories.length === 0 ? (
                <div className="text-center text-[#FFF6D9]/70 py-12">
                  <div className="text-lg">No categories available</div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {categories.map((category) => {
                    const isSelected = selectedCategories.some(cat => cat.id === category.id);
                    return (
                      <button
                        key={category.id}
                        onClick={() => handleModalCategorySelect(category)}
                        disabled={!isSelected && selectedCategories.length >= 3}
                        className={`relative rounded-xl overflow-hidden transition-all ${
                          isSelected
                            ? 'ring-4 ring-yellow-400 scale-105'
                            : selectedCategories.length >= 3
                            ? 'opacity-50 cursor-not-allowed'
                            : 'hover:scale-105 active:scale-95'
                        }`}
                      >
                        {/* Category Card */}
                        <div className={`${isSelected ? 'bg-[#FFF6D9]' : 'bg-[#0D0009] border-2 border-[#FFF6D9]/30'} rounded-xl p-4`}
                          style={!isSelected ? {
                            boxShadow: '0px 0px 2px 0px #FFF6D9'
                          } : {}}
                        >
                          {/* Image */}
                          <div className="h-24 mb-3 flex items-center justify-center">
                            {(category.imagePath || category.image) ? (
                              <img
                                src={getImageUrl(category.imagePath || category.image, 'category')}
                                alt={category.name}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  const img = e.currentTarget as HTMLImageElement;
                                  const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001';
                                  const filename = category.imagePath || category.image;
                                  
                                  // Prevent infinite loop
                                  const hasTriedCategories = img.dataset.triedCategories === 'true';
                                  const hasTriedContests = img.dataset.triedContests === 'true';
                                  
                                  // If first attempt failed and it's just a filename, try the other folder
                                  if (filename && !filename.includes('/')) {
                                    if (img.src.includes('/uploads/categories/') && !hasTriedContests) {
                                      // First try was categories, now try contests
                                      img.dataset.triedCategories = 'true';
                                      img.dataset.triedContests = 'true';
                                      img.src = `${baseUrl}/uploads/contests/${filename}`;
                                    } else if (img.src.includes('/uploads/contests/') && !hasTriedCategories) {
                                      // First try was contests, now try categories
                                      img.dataset.triedContests = 'true';
                                      img.dataset.triedCategories = 'true';
                                      img.src = `${baseUrl}/uploads/categories/${filename}`;
                                    } else {
                                      // Both folders tried, hide image
                                      img.style.display = 'none';
                                    }
                                  } else {
                                    img.style.display = 'none';
                                  }
                                }}
                              />
                            ) : (
                              <div className="w-16 h-16 flex items-center justify-center">
                                <div className="relative w-12 h-10">
                                  <div className="absolute top-0 left-1.5 w-6 h-4 bg-blue-500 rounded-full"></div>
                                  <div className="absolute top-0.5 right-1.5 w-5 h-4 bg-green-500 rounded-full"></div>
                                  <div className="absolute bottom-1.5 left-3 w-4 h-4 bg-yellow-400 rounded-full"></div>
                                  <div className="absolute bottom-1 right-3 w-4 h-3 bg-red-500 rounded-full"></div>
                                  <div className="absolute top-2 left-4.5 w-3 h-2 bg-purple-500 rounded-full"></div>
                                </div>
                              </div>
                            )}
                          </div>
                          
                          {/* Category Name */}
                          <p className={`text-center font-semibold text-sm truncate ${
                            isSelected ? 'text-[#0D0009]' : 'text-[#FFF6D9]'
                          }`}>
                            {category.name}
                          </p>
                        </div>

                        {/* Tick Mark */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                            <svg
                              className="w-4 h-4 text-[#0D0009]"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                              strokeWidth="3"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="bg-[#0D0009] px-6 py-4 border-t border-[#FFF6D9]/20">
              <button
                onClick={handleDone}
                className="w-full bg-yellow-400 text-[#0D0009] py-3 rounded-xl font-bold text-lg hover:bg-yellow-500 transition-colors active:scale-95 relative overflow-hidden"
              >
                <span className="relative z-10">Done ({selectedCategories.length}/3)</span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Play Modal */}
      {showPlayModal && (
        <div
          className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
          onClick={() => setShowPlayModal(false)}
        >
          <div
            className="bg-[#2C2159] rounded-3xl w-full max-w-md p-8 text-center shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              onClick={() => setShowPlayModal(false)}
              className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl font-light leading-none transition-colors w-8 h-8 flex items-center justify-center"
            >
              ×
            </button>
            
            <div className="mb-6">
              <div className="w-24 h-24 flex items-center justify-center mx-auto mb-4 relative">
                {playModalData.isUpcoming ? (
                  <img
                    src="/3d-alarm.png"
                    alt="Upcoming"
                    className="w-full h-full object-contain animate-cute-sway"
                  />
                ) : (
                  <img
                    src="/oops.svg"
                    alt="Ended"
                    className="w-full h-full object-contain animate-cute-sway"
                  />
                )}
              </div>
              <h3 className="text-white text-xl font-bold mb-2">
                {playModalData.contest?.name}
              </h3>
              <p className="text-white/80 text-lg mb-3">
                {playModalData.message}
              </p>
              {/* Player Count */}
              {playModalData.contest && (() => {
                const contest = playModalData.contest;
                const isDaily = isDailyContest(contest);
                const isDailyLive = isDailyContestLive(contest.dailyStartTime, contest.dailyEndTime);
                const isPast = !isDaily && contest.endDate && new Date() > new Date(contest.endDate);
                const playerCount = getPlayerCount(contest);
                
                return (
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <img src={'/timer.svg'} alt="User" className="w-4 h-4 object-contain" />
                    <span className="text-white opacity-70 text-sm">
                      {isPast 
                        ? `${Math.floor(playerCount / 1000)}k people played`
                        : (isDaily && !isDailyLive) 
                          ? '0 Players playing' 
                          : `${playerCount} Players playing`
                      }
                    </span>
                  </div>
                );
              })()}
            </div>
            <button
              onClick={() => setShowPlayModal(false)}
              className="w-full bg-yellow-400 text-[#392C6E] font-bold py-3 px-4 rounded-lg hover:bg-yellow-500 transition-colors relative overflow-hidden"
            >
              <span className="relative z-10">OK</span>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
            </button>
          </div>
        </div>
      )}
    </>
  );
}

