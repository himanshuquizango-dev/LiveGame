'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import { authApi, User, contestsApi, Contest, getImageUrl } from '@/lib/api';
import { isDailyContest, isDailyContestLive } from '@/lib/dailyContestUtils';
import { ContestCard } from '@/components/ContestCard';
import AdsenseAd from '@/components/AdsenseAd';
import {QuizResultCard} from '@/components/QuizResultCard';

interface ContestQuestion {
  id: string;
  question: string;
  type: string;
  media: string | null;
  options: string[];
  correctOption: string;
}

interface ContestData {
  id: string;
  name: string;
  duration: number;
  questions: ContestQuestion[];
  joining_fee: number;
  marking: number;
  negative_marking: number;
  lifeLineCharge: number;
  winCoins: number;
  contest_question_count?: number; // Total number of questions in the contest
}

interface AnswerResult {
  questionId: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  timeTaken: number;
}


export default function ContestPlayPage() {
  const router = useRouter();
  const params = useParams();
  const contestId = params?.id as string;

  const [contest, setContest] = useState<ContestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerResult[]>([]);
  const [score, setScore] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [incorrectAnswers, setIncorrectAnswers] = useState(0);
  const [totalTimeRemaining, setTotalTimeRemaining] = useState(0); // Total time for entire contest
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [usedLifelines, setUsedLifelines] = useState<Set<string>>(new Set()); // Track lifelines used globally (for UI display)
  const [lifelineUsedThisQuestion, setLifelineUsedThisQuestion] = useState(false); // Track if any lifeline used for current question
  const [questionStartTime, setQuestionStartTime] = useState<number>(0);
  const [freezeTimeActive, setFreezeTimeActive] = useState(false);
  const [activeFiftyFifty, setActiveFiftyFifty] = useState(false);
  const [removedOptions, setRemovedOptions] = useState<string[]>([]);
  const [activeAudiencePoll, setActiveAudiencePoll] = useState(false);
  const [showingLifelineModal, setShowingLifelineModal] = useState<string | null>(null);
  const [showingLifelineSelection, setShowingLifelineSelection] = useState(false);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [totalParticipants, setTotalParticipants] = useState<number | null>(null);
  const [loadingRank, setLoadingRank] = useState(false);
  const [allQuestionsPool, setAllQuestionsPool] = useState<ContestQuestion[]>([]); // Full question pool for flip feature
  const [usedQuestionIds, setUsedQuestionIds] = useState<Set<string>>(new Set()); // Track used question IDs
  const hasSubmittedResults = useRef(false);
  const questionScrollRef = useRef<HTMLDivElement>(null);
  const hasPlayedCelebrationMusic = useRef(false); // Track if celebration music has been played
  const [isMuted, setIsMuted] = useState(() => {
    // Load mute state from localStorage on initial render
    if (typeof window !== 'undefined') {
      const savedMuteState = localStorage.getItem('contestMusicMuted');
      return savedMuteState === 'true';
    }
    return false;
  });
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [consecutiveCorrect, setConsecutiveCorrect] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  const successSoundRef = useRef<HTMLAudioElement>(null);
  const correctSoundRef = useRef<HTMLAudioElement>(null);
  const wrongSoundRef = useRef<HTMLAudioElement>(null);
  const congratulationMusicRef = useRef<HTMLAudioElement>(null);
  const wellTriedMusicRef = useRef<HTMLAudioElement>(null);
  const [wasMusicOn, setWasMusicOn] = useState(false); // Track if music was on during contest
  const [audiencePollPercentages, setAudiencePollPercentages] = useState<{ [key: string]: number }>({});
  const [otherContests, setOtherContests] = useState<Contest[]>([]);
  const [contestsLoading, setContestsLoading] = useState(false);
  const [animatedScore, setAnimatedScore] = useState(0);
  const [animatedCorrect, setAnimatedCorrect] = useState(0);
  const [animatedWrong, setAnimatedWrong] = useState(0);

  // Animate number counting
  const animateNumber = useCallback((start: number, end: number, duration: number, setter: (n: number) => void) => {
    const startTime = Date.now();
    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = Math.floor(start + (end - start) * easeOut);
      setter(current);
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, []);

  // Fetch other contests for the "More Contests" section
  const fetchOtherContests = useCallback(async () => {
    try {
      setContestsLoading(true);
      const response = await contestsApi.getList();
      const contests = response.data || [];

      // Filter for LIVE contests (daily in their time window, or regular between start and end)
      const now = new Date();
      const liveContests = contests.filter((contest: any) => {
        if (contest.id === contestId) return false; // Exclude current contest
        if (isDailyContest(contest)) {
          return isDailyContestLive(contest.dailyStartTime, contest.dailyEndTime);
        }
        if (!contest.startDate || !contest.endDate) return false;
        const start = new Date(contest.startDate);
        const end = new Date(contest.endDate);
        return now >= start && now <= end;
      });

      // Take up to 5 live contests
      setOtherContests(liveContests.slice(0, 5));
    } catch (err) {
      console.error('Error fetching contests:', err);
    } finally {
      setContestsLoading(false);
    }
  }, [contestId]);

  useEffect(() => {
    fetchContestData();
    fetchUserData();
  }, [contestId]);

  // Auto-start quiz when both contest and user data are ready
  useEffect(() => {
    if (contest && !quizStarted && !loading && contest.questions.length > 0) {
      // Check if user came from rules page (already joined/paid)
      const hasJoinedContest = sessionStorage.getItem('currentContestId') === contestId;

      // If user has already joined (coins deducted), start immediately
      if (hasJoinedContest) {
        startQuiz();
        return;
      }

      // Check if user has enough coins (if contest has joining fee)
      // This is for direct access to play page without going through rules
      if (contest.joining_fee > 0) {
        const storedUser = localStorage.getItem('user');
        const isGuest = !storedUser;

        if (isGuest) {
          const guestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
          if (guestCoins >= contest.joining_fee) {
            startQuiz();
          } else {
            // Not enough coins - redirect to rules page
            router.push(`/contest/${contestId}/rules`);
          }
        } else if (user && (user.coins || 0) >= contest.joining_fee) {
          startQuiz();
        } else {
          // Not enough coins - redirect to rules page
          router.push(`/contest/${contestId}/rules`);
        }
      } else {
        // No joining fee, auto-start
        startQuiz();
      }
    }
  }, [contest, user, loading, quizStarted, contestId, router]);

  // Background music control
  useEffect(() => {
    if (audioRef.current) {
      // Stop music immediately if quiz is completed
      if (quizCompleted) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        setIsMusicPlaying(false);
        return;
      }

      if (quizStarted && !isMuted && !quizCompleted) {
        audioRef.current.play().then(() => {
          setIsMusicPlaying(true);
          setWasMusicOn(true); // Track that music was on (once set to true, it stays true)
          // console.log('🎵 Background music started, wasMusicOn set to true');
        }).catch(err => {
          // console.log('Audio play failed:', err);
          setIsMusicPlaying(false);
          // Don't set wasMusicOn to false on error - if it was true, keep it true
        });
      } else {
        audioRef.current.pause();
        setIsMusicPlaying(false);
        // Don't set wasMusicOn to false when pausing - we want to remember if it was ever on
      }
    }
  }, [quizStarted, isMuted, quizCompleted]);

  // Track actual audio playback state
  useEffect(() => {
    if (!audioRef.current) return;

    const audio = audioRef.current;

    const handlePlay = () => setIsMusicPlaying(true);
    const handlePause = () => setIsMusicPlaying(false);
    const handleEnded = () => setIsMusicPlaying(false);

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  // Initialize audience poll percentages when activated
  useEffect(() => {
    if (activeAudiencePoll && contest && contest.questions[currentQuestionIndex]) {
      const currentQ = contest.questions[currentQuestionIndex];
      // Generate random percentages that fluctuate
      const percentages: { [key: string]: number } = {};
      currentQ.options.forEach((option) => {
        if (option === currentQ.correctOption) {
          // Correct answer gets higher percentage (45-55%)
          percentages[option] = 45 + Math.random() * 10;
        } else {
          // Wrong answers get lower percentages (10-20% each)
          percentages[option] = 10 + Math.random() * 10;
        }
      });
      setAudiencePollPercentages(percentages);

      // Continuously fluctuate the percentages
      const interval = setInterval(() => {
        setAudiencePollPercentages((prev) => {
          const newPercentages: { [key: string]: number } = {};
          currentQ.options.forEach((option) => {
            if (option === currentQ.correctOption) {
              // Correct answer fluctuates between 40-60%
              newPercentages[option] = 40 + Math.random() * 20;
            } else {
              // Wrong answers fluctuate between 5-25%
              newPercentages[option] = 5 + Math.random() * 20;
            }
          });
          return newPercentages;
        });
      }, 800); // Update every 800ms for smooth animation

      return () => clearInterval(interval);
    }
  }, [activeAudiencePoll, contest, currentQuestionIndex]);

  // Auto-scroll to current question indicator
  useEffect(() => {
    if (questionScrollRef.current && quizStarted) {
      const questionElement = questionScrollRef.current.children[0]?.children[currentQuestionIndex] as HTMLElement;
      if (questionElement) {
        questionElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentQuestionIndex, quizStarted]);

  useEffect(() => {
    if (quizStarted && totalTimeRemaining > 0 && !freezeTimeActive && contest) {
      const timer = setInterval(() => {
        setTotalTimeRemaining((prev) => {
          if (prev <= 1) {
            // Time's up - mark remaining questions as unanswered
            setAnswers((prevAnswers) => {
              if (contest && currentQuestionIndex < contest.questions.length) {
                const remainingQuestions = contest.questions.slice(currentQuestionIndex);
                const unansweredResults: AnswerResult[] = remainingQuestions.map(q => ({
                  questionId: q.id,
                  selectedAnswer: '',
                  correctAnswer: q.correctOption,
                  isCorrect: false,
                  timeTaken: 0,
                }));
                return [...prevAnswers, ...unansweredResults];
              }
              return prevAnswers;
            });
            // Stop background music immediately and synchronously (before any state updates)
            if (audioRef.current) {
              audioRef.current.pause();
              audioRef.current.currentTime = 0;
            }
            // Set quizStarted to false first to ensure music stops via useEffect
            setQuizStarted(false);
            // Then set quizCompleted (React will batch these, but music is already stopped)
            setQuizCompleted(true);
            // Celebration music will be played by useEffect when quizCompleted becomes true
            return 0;
          }
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [quizStarted, totalTimeRemaining, freezeTimeActive, contest, currentQuestionIndex]);

  // Submit contest results when quiz is completed
  useEffect(() => {
    if (!quizCompleted || !contest || !contestId || hasSubmittedResults.current) return;

    hasSubmittedResults.current = true;

    const submitContestResults = async () => {
      try {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
          try {
            // Logged in user - submit to backend
            await contestsApi.submitContestResults(contestId, {
              score,
              answers: answers.map(a => ({
                questionId: a.questionId,
                selectedAnswer: a.selectedAnswer,
                correctAnswer: a.correctAnswer,
                isCorrect: a.isCorrect,
                timeTaken: a.timeTaken,
              })),
            });

            // Fetch rank after submission
            setLoadingRank(true);
            try {
              const rankData = await contestsApi.getContestRank(contestId);
              setUserRank(rankData.rank);
              setTotalParticipants(rankData.totalParticipants);
            } catch (err) {
              // console.error('Error fetching rank:', err);
            } finally {
              setLoadingRank(false);
            }
          } catch (submitErr: any) {
            // Handle submission errors gracefully
            // console.error('Error submitting contest results:', submitErr);
            if (submitErr.response?.status === 401) {
              // Session expired - clear user and continue as guest
              // console.warn('Session expired, continuing as guest');
              localStorage.removeItem('user');
            } else if (submitErr.response?.status === 404) {
              // Participation not found - user might not have joined properly
              // console.warn('Participation not found, results not submitted');
            } else {
              // Other errors - log but don't block UI
              // console.error('Failed to submit results:', submitErr.response?.data || submitErr.message);
            }
            // Continue without blocking - results are still stored locally
          }
        }
        // Guest users - results stored locally, no backend submission needed
      } catch (err) {
        // console.error('Unexpected error in submitContestResults:', err);
        // Don't reset hasSubmittedResults - allow UI to continue
      }
    };

    submitContestResults();
  }, [quizCompleted, contestId, contest, score, answers]);

  const fetchContestData = async () => {
    try {
      setLoading(true);
      const response = await contestsApi.getContestById(contestId);
      if (response.status && response.data) {
        const contestData = response.data;
        const contestDuration = (contestData.duration || 60); // Total duration for entire contest
        const allQuestions = contestData.questions || [];
        const questionCount = contestData.contest_question_count || allQuestions.length;

        // Store full question pool for flip feature
        setAllQuestionsPool(allQuestions);

        // Randomly select non-repeating questions based on contest_question_count
        let selectedQuestions: ContestQuestion[] = [];
        if (allQuestions.length > 0) {
          // Create a shuffled copy of all questions
          const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
          // Select only the required number of questions
          selectedQuestions = shuffled.slice(0, Math.min(questionCount, allQuestions.length));
          // Track initial question IDs as used
          const initialUsedIds = new Set(selectedQuestions.map(q => q.id));
          setUsedQuestionIds(initialUsedIds);
        }

        setContest({
          id: contestData.id,
          name: contestData.name,
          duration: contestDuration,
          questions: selectedQuestions,
          joining_fee: contestData.joining_fee || 0,
          marking: contestData.marking || 25,
          negative_marking: contestData.negative_marking || 10,
          lifeLineCharge: contestData.lifeLineCharge || 0,
          winCoins: contestData.winCoins || 0,
          contest_question_count: contestData.contest_question_count,
        });
        setTotalTimeRemaining(contestDuration);
      }
    } catch (err) {
      // console.error('Error fetching contest:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUserData = async () => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        setUser(JSON.parse(storedUser));
        // Try to fetch fresh data
        try {
          const userData = await authApi.getCurrentUser();
          setUser(userData);
          localStorage.setItem('user', JSON.stringify(userData));
        } catch (err) {
          // Session expired, but keep stored user for now
          // console.error('Error fetching user:', err);
        }
      }
      // Guest users don't need to fetch user data
    } catch (err) {
      console.error('Error fetching user:', err);
    }
  };

  const startQuiz = () => {
    // Check if user has already joined this contest (coins already deducted)
    const hasJoinedContest = sessionStorage.getItem('currentContestId') === contestId;

    // If user has already joined, skip coin check and start immediately
    if (!hasJoinedContest && contest && contest.joining_fee > 0) {
      // Only check coins if user hasn't joined yet (direct access to play page)
      const storedUser = localStorage.getItem('user');
      const isGuest = !storedUser;

      if (isGuest) {
        const guestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
        if (guestCoins < contest.joining_fee) {
          alert('Insufficient coins to start this contest. Please go back and watch a video or spin the wheel to earn coins.');
          router.push(`/contest/${contestId}/rules`);
          return;
        }
      } else {
        const currentUser = user || (storedUser ? JSON.parse(storedUser) : null);
        if (currentUser && (currentUser.coins || 0) < contest.joining_fee) {
          alert('Insufficient coins to start this contest. Please go back and watch a video or spin the wheel to earn coins.');
          router.push(`/contest/${contestId}/rules`);
          return;
        }
      }
    }

    // Clear sessionStorage after starting (to prevent issues on refresh)
    if (hasJoinedContest) {
      sessionStorage.removeItem('currentContestId');
    }

    setQuizStarted(true);
    setQuestionStartTime(Date.now());
    setConsecutiveCorrect(0); // Reset consecutive correct counter
  };

  const toggleMute = () => {
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    // Save mute state to localStorage
    localStorage.setItem('contestMusicMuted', newMuteState.toString());
  };

  // Function to play celebration music based on results
  const playCelebrationMusic = (answers: AnswerResult[]) => {
    // Prevent duplicate calls
    if (hasPlayedCelebrationMusic.current) {
      // console.log('🎵 Celebration music already played, skipping');
      return;
    }

    // console.log('🎵 playCelebrationMusic called', { wasMusicOn, answersCount: answers.length });

    if (!wasMusicOn) {
      // console.log('🎵 Music was not on during contest, skipping celebration music');
      return; // Only play if music was on during contest
    }

    // Mark as played immediately to prevent duplicate calls
    hasPlayedCelebrationMusic.current = true;

    const totalQuestions = contest?.contest_question_count || contest?.questions.length || 1;
    const halfQuestions = Math.ceil(totalQuestions / 2);
    const correctCount = answers.filter(a => a.isCorrect).length;
    const isMoreThanHalf = correctCount > halfQuestions;

    // console.log('🎵 Celebration music check', { 
    //   totalQuestions, 
    //   halfQuestions, 
    //   correctCount, 
    //   isMoreThanHalf,
    //   shouldPlayCongrats: isMoreThanHalf,
    //   shouldPlayWellTried: !isMoreThanHalf
    // });

    // Stop background music first and ensure it stays stopped
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      // Remove any event listeners that might restart it
      audioRef.current.removeEventListener('play', () => { });
    }

    // Also stop any other audio that might be playing
    if (correctSoundRef.current && !correctSoundRef.current.paused) {
      correctSoundRef.current.pause();
    }
    if (wrongSoundRef.current && !wrongSoundRef.current.paused) {
      wrongSoundRef.current.pause();
    }

    // Play appropriate celebration music after a short delay
    setTimeout(() => {
      if (isMoreThanHalf) {
        // Play congratulations music
        if (congratulationMusicRef.current) {
          // console.log('🎵 Playing congratulations music', {
          //   hasRef: !!congratulationMusicRef.current,
          //   src: congratulationMusicRef.current.src
          // });
          congratulationMusicRef.current.currentTime = 0; // Reset to start
          congratulationMusicRef.current.volume = 1.0; // Ensure volume is set
          congratulationMusicRef.current.play().catch(err => {
            // console.error('❌ Congratulations music play failed:', err);
          });
        } else {
          // console.error('❌ Congratulations music ref is null!');
        }
      } else {
        // Play well tried music (correctCount <= halfQuestions)
        // console.log('🎵 Attempting to play well tried music', {
        //   hasRef: !!wellTriedMusicRef.current,
        //   correctCount,
        //   halfQuestions,
        //   isMoreThanHalf
        // });

        if (wellTriedMusicRef.current) {
          const audio = wellTriedMusicRef.current;
          // console.log('🎵 Playing well tried music', {
          //   hasRef: !!audio,
          //   src: audio.src,
          //   readyState: audio.readyState,
          //   HAVE_ENOUGH_DATA: audio.HAVE_ENOUGH_DATA || 4
          // });

          // Ensure audio is loaded
          if (audio.readyState < 2) {
            // console.log('⏳ Well tried music not ready, waiting for load...');
            audio.load();
            audio.addEventListener('canplaythrough', () => {
              // console.log('✅ Well tried music ready to play');
              audio.currentTime = 0;
              audio.volume = 1.0;
              audio.play().then(() => {
                // console.log('✅ Well tried music started playing successfully');
              }).catch(err => {
                // console.error('❌ Well tried music play failed:', err);
              });
            }, { once: true });
          } else {
            audio.currentTime = 0; // Reset to start
            audio.volume = 1.0; // Ensure volume is set
            audio.play().then(() => {
              console.log('✅ Well tried music started playing successfully');
            }).catch(err => {
              console.error('❌ Well tried music play failed:', err);
              // console.error('Error details:', {
              //   name: err.name,
              //   message: err.message,
              //   code: (err as any).code
              // });
            });
          }
        } else {
          // console.error('❌ Well tried music ref is null!');
        }
      }
    }, 500); // Small delay to ensure background music has stopped
  };

  // Trigger animations and fetch other contests when quiz completes
  useEffect(() => {
    if (quizCompleted && contest) {
      const contestQuestionIds = new Set(contest.questions.map(q => q.id));
      const validAnswers = answers.filter(a => contestQuestionIds.has(a.questionId));
      const correctCount = validAnswers.filter(a => a.isCorrect).length;
      const wrongCount = validAnswers.filter(a => !a.isCorrect && a.selectedAnswer && a.selectedAnswer.trim().length > 0).length;

      // Animate numbers with staggered timing
      setTimeout(() => animateNumber(0, score, 800, setAnimatedScore), 200);
      setTimeout(() => animateNumber(0, correctCount, 600, setAnimatedCorrect), 400);
      setTimeout(() => animateNumber(0, wrongCount, 600, setAnimatedWrong), 600);

      // Fetch other contests
      fetchOtherContests();
    }
  }, [quizCompleted, contest, score, answers, animateNumber, fetchOtherContests]);

  // Play celebration music when quiz completes
  useEffect(() => {
    if (quizCompleted && contest && !hasPlayedCelebrationMusic.current) {
      // console.log('🎵 Quiz completed, checking for celebration music', { 
      //   wasMusicOn, 
      //   answersCount: answers.length,
      //   isMuted,
      //   isMusicPlaying,
      //   hasPlayed: hasPlayedCelebrationMusic.current
      // });

      // Ensure background music is stopped
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }

      // Use a delay to ensure state is fully updated and background music has stopped
      const timer = setTimeout(() => {
        // Double-check that background music is stopped
        if (audioRef.current && !audioRef.current.paused) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }

        // Get all answers including any unanswered ones
        const contestQuestionIds = new Set(contest.questions.map(q => q.id));
        const validAnswers = answers.filter(a => contestQuestionIds.has(a.questionId));

        // Check if there are unanswered questions
        const answeredQuestionIds = new Set(validAnswers.map(a => a.questionId));
        const unansweredQuestions = contest.questions.filter(q => !answeredQuestionIds.has(q.id));
        const unansweredResults: AnswerResult[] = unansweredQuestions.map(q => ({
          questionId: q.id,
          selectedAnswer: '',
          correctAnswer: q.correctOption,
          isCorrect: false,
          timeTaken: 0,
        }));

        const allAnswers = [...validAnswers, ...unansweredResults];
        playCelebrationMusic(allAnswers);
      }, 800); // Delay to ensure background music has fully stopped and state is updated

      return () => clearTimeout(timer);
    }
  }, [quizCompleted, contest, answers.length, wasMusicOn]);

  const handleAnswerSelect = (option: string) => {
    if (selectedAnswer || !quizStarted || totalTimeRemaining <= 0) return;
    setSelectedAnswer(option);
    // Hide audience poll when answer is selected
    setActiveAudiencePoll(false);
    setAudiencePollPercentages({}); // Reset poll percentages

    const timeTaken = Math.floor((Date.now() - questionStartTime) / 1000);
    const currentQ = contest!.questions[currentQuestionIndex];
    const isCorrect = option === currentQ.correctOption;

    const answerResult: AnswerResult = {
      questionId: currentQ.id,
      selectedAnswer: option,
      correctAnswer: currentQ.correctOption,
      isCorrect,
      timeTaken,
    };

    handleAnswerSubmission(answerResult);
  };

  const handleAnswerSubmission = (answerResult: AnswerResult) => {
    const newAnswers = [...answers, answerResult];
    setAnswers(newAnswers);

    // Update score and track consecutive correct answers
    if (answerResult.isCorrect) {
      setScore((prev) => prev + (contest?.marking || 25));
      setCorrectAnswers((prev) => prev + 1);
      const newConsecutive = consecutiveCorrect + 1;
      setConsecutiveCorrect(newConsecutive);

      // Play correct sound for every correct answer (only if not muted)
      if (correctSoundRef.current && !isMuted) {
        correctSoundRef.current.currentTime = 0; // Reset to start
        correctSoundRef.current.play().catch(err => {
          // console.log('Correct sound play failed:', err);
        });
      }

      // Play success sound after 3 consecutive correct answers (only if not muted)
      if (newConsecutive >= 3 && successSoundRef.current && !isMuted) {
        successSoundRef.current.play().catch(err => {
          // console.log('Success sound play failed:', err);
        });
        // Reset counter after playing sound
        setConsecutiveCorrect(0);
      }
    } else {
      // Reset consecutive correct counter on wrong answer
      setConsecutiveCorrect(0);
      setIncorrectAnswers((prev) => prev + 1);

      // Play wrong sound for every wrong answer (only if not muted)
      if (wrongSoundRef.current && !isMuted) {
        wrongSoundRef.current.currentTime = 0; // Reset to start
        wrongSoundRef.current.play().catch(err => {
          // console.log('Wrong sound play failed:', err);
        });
      }

      if (answerResult.selectedAnswer) {
        // Only deduct if an answer was selected (not timeout)
        setScore((prev) => Math.max(0, prev - (contest?.negative_marking || 10)));
      }
    }

    // Move to next question or complete quiz
    if (currentQuestionIndex < contest!.questions.length - 1) {
      setTimeout(() => {
        // Mark current question as used
        const currentQId = contest!.questions[currentQuestionIndex].id;
        setUsedQuestionIds(prev => new Set(prev).add(currentQId));

        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedAnswer(null);
        setQuestionStartTime(Date.now());
        setFreezeTimeActive(false);
        setActiveFiftyFifty(false);
        setRemovedOptions([]);
        setActiveAudiencePoll(false);
        setAudiencePollPercentages({}); // Reset poll percentages
        setLifelineUsedThisQuestion(false); // Reset lifeline usage for new question
      }, 1500);
    } else {
      // Quiz completed
      setTimeout(() => {
        // Stop background music immediately and synchronously (before any state updates)
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
        }
        // Set quizStarted to false first to ensure music stops via useEffect
        setQuizStarted(false);
        // Then set quizCompleted (React will batch these, but music is already stopped)
        setQuizCompleted(true);
        // Celebration music will be played by useEffect when quizCompleted becomes true
      }, 1500);
    }
  };

  const handleLifeline = async (lifelineType: string) => {
    // Check if any lifeline has already been used for this question
    if (lifelineUsedThisQuestion) {
      alert('You can only use one lifeline per question');
      return;
    }

    // Check if this specific lifeline type has been used globally (for UI display)
    if (usedLifelines.has(lifelineType)) {
      alert('This lifeline has already been used in this contest');
      return;
    }

    if (!contest || !contestId) return;

    const lifelineCost = contest.lifeLineCharge || 0;
    const storedUser = localStorage.getItem('user');
    const isGuest = !storedUser;

    // Get coins based on user type
    const userCoins = isGuest
      ? parseInt(localStorage.getItem('guestCoins') || '0')
      : (user?.coins || 0);

    if (userCoins < lifelineCost) {
      // Show watch video option
      setShowingLifelineModal(lifelineType);
      return;
    }

    // Deduct coins and create history
    if (isGuest) {
      // Guest user - deduct from localStorage
      const currentGuestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
      if (currentGuestCoins < lifelineCost) {
        setShowingLifelineModal(lifelineType);
        return;
      }
      const newGuestCoins = Math.max(0, currentGuestCoins - lifelineCost);
      localStorage.setItem('guestCoins', newGuestCoins.toString());
      // Trigger coins update event for navbar
      window.dispatchEvent(new Event('coinsUpdated'));
    } else {
      // Logged in user - call backend API to deduct coins and create history
      try {
        const response = await contestsApi.useLifeline(contestId, lifelineType);

        // Update user data with new coin balance from backend
        if (response.coins !== undefined) {
          if (user) {
            const updatedUser = { ...user, coins: response.coins };
            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));
            // Trigger coins update event for navbar
            window.dispatchEvent(new Event('coinsUpdated'));
          }
        }
      } catch (err: any) {
        // console.error('Error using lifeline:', err);
        if (err.response?.status === 400 && err.response?.data?.error === 'Insufficient coins') {
          setShowingLifelineModal(lifelineType);
          return;
        }
        alert(err.response?.data?.error || 'Failed to use lifeline. Please try again.');
        return;
      }
    }

    // Activate lifeline
    activateLifeline(lifelineType);
  };

  const handleWatchVideoForLifeline = async () => {
    if (!contest || !showingLifelineModal || !contestId) return;

    // TODO: Implement video watching logic
    alert('Video watching feature coming soon!');

    const storedUser = localStorage.getItem('user');
    const isGuest = !storedUser;
    const lifelineCost = contest.lifeLineCharge || 0;

    // After watching video, award coins and use lifeline
    if (isGuest) {
      // Guest user - add to localStorage
      const currentGuestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
      const newGuestCoins = currentGuestCoins + lifelineCost;
      localStorage.setItem('guestCoins', newGuestCoins.toString());
      // Trigger coins update event for navbar
      window.dispatchEvent(new Event('coinsUpdated'));
    } else {
      // Logged in user - award coins via backend API (creates coin history)
      try {
        await authApi.awardCoins(lifelineCost, 'Earned coins from watching video ad for lifeline', contestId);
        // Fetch updated user data
        const userData = await authApi.getCurrentUser();
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        // Trigger coins update event for navbar
        window.dispatchEvent(new Event('coinsUpdated'));
      } catch (err) {
        // console.error('Error awarding coins:', err);
        // Fallback to local update if API fails
        if (user) {
          const updatedUser = { ...user, coins: (user.coins || 0) + lifelineCost };
          setUser(updatedUser);
          localStorage.setItem('user', JSON.stringify(updatedUser));
        }
      }
    }

    // Now use the lifeline without deducting coins (since we just added coins)
    activateLifeline(showingLifelineModal);
    setShowingLifelineModal(null);
  };

  const activateLifeline = (lifelineType: string) => {
    setUsedLifelines((prev) => new Set(prev).add(lifelineType));
    setLifelineUsedThisQuestion(true); // Mark that a lifeline has been used for this question

    const currentQ = contest!.questions[currentQuestionIndex];

    if (lifelineType === 'freeze') {
      setFreezeTimeActive(true);
      setTimeout(() => {
        setFreezeTimeActive(false);
      }, 30000); // Freeze for 30 seconds
    } else if (lifelineType === 'fifty-fifty') {
      // Remove two wrong options
      const wrongOptions = currentQ.options.filter(
        opt => opt !== currentQ.correctOption
      );
      const toRemove = wrongOptions.slice(0, 2);
      setRemovedOptions(toRemove);
      setActiveFiftyFifty(true);
    } else if (lifelineType === 'audience') {
      // Show audience poll - stays visible until answer is submitted
      setActiveAudiencePoll(true);
    } else if (lifelineType === 'flip') {
      // Flip question: replace current question with a different one from the pool
      if (allQuestionsPool.length === 0) {
        alert('No alternative questions available');
        return;
      }

      const currentQuestionId = currentQ.id;

      // Get all question IDs currently in the quiz (excluding the current one we're replacing)
      const otherQuestionIds = new Set(
        contest!.questions
          .map((q, idx) => idx !== currentQuestionIndex ? q.id : null)
          .filter(id => id !== null) as string[]
      );

      // Find available questions that:
      // 1. Are not the current question
      // 2. Are not already in the quiz (other positions)
      // 3. Haven't been used in previous questions
      const availableQuestions = allQuestionsPool.filter(
        q => q.id !== currentQuestionId &&
          !otherQuestionIds.has(q.id) &&
          !usedQuestionIds.has(q.id)
      );

      let newQuestion: ContestQuestion;

      if (availableQuestions.length === 0) {
        // If no unused questions, try any question that's not the current one and not in quiz
        const alternativeQuestions = allQuestionsPool.filter(
          q => q.id !== currentQuestionId && !otherQuestionIds.has(q.id)
        );
        if (alternativeQuestions.length === 0) {
          alert('No alternative questions available');
          return;
        }

        // Pick a random alternative question
        const randomIndex = Math.floor(Math.random() * alternativeQuestions.length);
        newQuestion = alternativeQuestions[randomIndex];
      } else {
        // Pick a random unused question
        const randomIndex = Math.floor(Math.random() * availableQuestions.length);
        newQuestion = availableQuestions[randomIndex];
      }

      // Replace current question in the questions array
      const updatedQuestions = [...contest!.questions];
      updatedQuestions[currentQuestionIndex] = newQuestion;
      setContest({ ...contest!, questions: updatedQuestions });

      // Mark the old question as used (so it won't appear again)
      // Don't mark the new question as used yet - it will be marked when answered or moved to next
      setUsedQuestionIds(prev => {
        const updated = new Set(prev);
        updated.add(currentQuestionId);
        return updated;
      });

      // Reset any active lifelines for the new question
      setActiveFiftyFifty(false);
      setRemovedOptions([]);
      setActiveAudiencePoll(false);
      setAudiencePollPercentages({}); // Reset poll percentages
      setSelectedAnswer(null);
      setQuestionStartTime(Date.now());

      // Show a brief message that question was flipped
      // console.log('Question flipped successfully');
    }
  };

  if (loading) {
    return (
      <>
        <DashboardNav />
        <div className="min-h-screen bg-[#0D0009] flex flex-col items-center justify-center px-4">
          <div className="relative mb-6">
            <div className="w-14 h-14 rounded-full border-4 border-[#FFF6D9]/20 border-t-[#FFD602] animate-loading-spin" />
            <div className="absolute inset-0 flex items-center justify-center">
              <img src="/logo.svg" alt="" className="w-6 h-6 opacity-90" />
            </div>
          </div>
          <p className="text-[#FFF6D9] text-lg font-medium">Loading contest...</p>
          <p className="text-[#FFD602] text-sm mt-1 font-semibold animate-loading-dots">...</p>
        </div>
        <Footer />
      </>
    );
  }

  if (!contest || contest.questions.length === 0) {
    return (
      <>
        <DashboardNav />
        <div className="min-h-screen bg-[#0D0009] flex items-center justify-center p-5">
          <div className="text-center">
            <div className="mb-6">
              <svg className="w-16 h-16 mx-auto text-[#FFD602] opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <p className="text-[#FFF6D9] text-lg mb-2 font-semibold">Contest Not Found</p>
            <p className="text-[#FFF6D9]/70 text-sm mb-6">This contest is unavailable or has no questions.</p>
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-[#0D0009] px-6 py-3 rounded-xl font-bold hover:from-yellow-500 hover:to-yellow-600 transition-all transform hover:scale-105 shadow-lg"
              style={{ boxShadow: '0 4px 15px rgba(255, 215, 0, 0.3)' }}
            >
              Go to Dashboard
            </button>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  // Show message if quiz hasn't started yet (waiting for auto-start)
  if (!quizStarted && !loading && contest.questions.length > 0) {
    const hasJoinedContest = sessionStorage.getItem('currentContestId') === contestId;
    const storedUser = localStorage.getItem('user');
    const isGuest = !storedUser;
    const hasEnoughCoins = contest.joining_fee === 0 ||
      (isGuest ? parseInt(localStorage.getItem('guestCoins') || '0') >= contest.joining_fee :
        (user && (user.coins || 0) >= contest.joining_fee));

    // If user has joined but quiz hasn't started, show loading
    if (hasJoinedContest) {
      return (
        <>
          <DashboardNav />
          <div className="min-h-screen bg-[#0D0009] flex flex-col items-center justify-center px-4">
            <div className="relative mb-6">
              <div className="w-14 h-14 rounded-full border-4 border-[#FFF6D9]/20 border-t-[#FFD602] animate-loading-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <img src="/logo.svg" alt="" className="w-6 h-6 opacity-90" />
              </div>
            </div>
            <p className="text-[#FFF6D9] text-lg font-medium">Starting quiz...</p>
            <p className="text-[#FFD602] text-sm mt-1 font-semibold animate-loading-dots">...</p>
          </div>
          <Footer />
        </>
      );
    }

    // If user doesn't have enough coins and hasn't joined, redirect
    if (!hasEnoughCoins && contest.joining_fee > 0) {
      // Redirect will happen in useEffect, but show message while redirecting
      return (
        <>
          <DashboardNav />
          <div className="min-h-screen bg-[#0D0009] flex flex-col items-center justify-center px-4">
            <div className="relative mb-6">
              <div className="w-14 h-14 rounded-full border-4 border-[#FFF6D9]/20 border-t-[#FFD602] animate-loading-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <img src="/logo.svg" alt="" className="w-6 h-6 opacity-90" />
              </div>
            </div>
            <p className="text-[#FFF6D9] text-lg font-medium">Redirecting to contest rules...</p>
            <p className="text-[#FFD602] text-sm mt-1 font-semibold animate-loading-dots">...</p>
          </div>
          <Footer />
        </>
      );
    }
  }


  // Audio elements - always render so refs are available
  const audioElements = (
    <>
      {/* Background Music */}
      <audio
        ref={audioRef}
        src="/background-music.mp3"
        loop
        preload="auto"
      />

      {/* Success Sound Effect */}
      <audio
        ref={successSoundRef}
        src="/success-sound.mp3"
        preload="auto"
      />

      {/* Correct Answer Sound Effect */}
      <audio
        ref={correctSoundRef}
        src="/correct-sound.wav"
        preload="auto"
      />

      {/* Wrong Answer Sound Effect */}
      <audio
        ref={wrongSoundRef}
        src="/wrong-sound.wav"
        preload="auto"
      />

      {/* Congratulations Music (plays when >50% correct) */}
      <audio
        ref={congratulationMusicRef}
        src="/congratulation-music.mp3"
        preload="auto"
      />

      {/* Well Tried Music (plays when <=50% correct) */}
      <audio
        ref={wellTriedMusicRef}
        src="/well-tried-music.wav"
        preload="auto"
        onLoadedData={() => {
          // console.log('✅ Well tried music loaded successfully');
        }}
        onError={(e) => {
          // console.error('❌ Well tried music failed to load:', e);
        }}
      />
    </>
  );

  if (quizCompleted) {
    // Get unique answers by questionId to avoid duplicates
    const uniqueAnswers = Array.from(
      new Map(answers.map(a => [a.questionId, a])).values()
    );

    // Limit to actual contest questions
    const contestQuestionIds = new Set(contest?.questions.map(q => q.id) || []);
    const validAnswers = uniqueAnswers.filter(a => contestQuestionIds.has(a.questionId));

    const correctCount = validAnswers.filter(a => a.isCorrect).length;
    // Wrong count: answers that are incorrect AND have a selected answer (not empty/null)
    const wrongCount = validAnswers.filter(a => !a.isCorrect && a.selectedAnswer && a.selectedAnswer.trim().length > 0).length;
    const storedUser = localStorage.getItem('user');
    const isGuest = !storedUser;

    // Calculate winner announcement time (assuming contest ends at a specific time, for now using placeholder)
    const winnerAnnouncementTime = "5:45 pm"; // This should come from contest data
    const potentialWinnings = contest?.winCoins || 1000;

    // Calculate message once and store it (to prevent it from changing)
    const totalQuestions = contest?.contest_question_count || contest?.questions.length || 1;
    const halfQuestions = Math.ceil(totalQuestions / 2);
    const isMoreThanHalf = correctCount > halfQuestions;
    const showCongratulations = isMoreThanHalf;

    return (
      <>
        {audioElements}
        <DashboardNav />

        <div className=" p-5 pb-0">
          <div className=" ">

            {/* Results Card with enhanced animations */}
            <div className=" rounded-md p-6 text-center mb-4 border border-[#414D65]    relative overflow-hidden">
              <div className=" ">
                <div className="flex justify-center">
                  <img src="/trophy2.gif" alt="Trophy" className="w-35 h-35 drop-shadow-2xl" />
                </div>
              </div>
              <p className="text-white text-3xl m-4">
                Your Score is {animatedScore}
              </p>

              <button
                style={{ width: '300px', height: '36px' }}
                onClick={() => router.push('/dashboard')}
                className="bg-[#FFB540] text-white rounded-md font-semibold hover:bg-transparent hover:border-2 hover:border-[#FFB540] hover:text-[#FFB540]"
              >
                Go to Home
              </button>


            </div>
          </div>
        </div>

        {/* Advertisement - Full Width */}
        <div className="w-full overflow-hidden">
          <AdsenseAd adSlot="8153775072" adFormat="auto" />
          <p className="text-center text-[#414D65] text-xs mt-2 mb-2 font-medium">A D V E R T I S E M E N T</p>
        </div>
      </>
    );
  }

  const currentQuestion = contest.questions[currentQuestionIndex];
  const totalQuestions = contest.contest_question_count || contest.questions.length;
  const progress = ((currentQuestionIndex + 1) / totalQuestions) * 100;
  const timePercentage = (totalTimeRemaining / contest.duration) * 100;

  return (
    <>
      <SEOHead
        title="Play Contest - Quizwala Contest Quiz"
        description="Play exciting quiz contests on Quizwala! Answer questions, compete with other players, and win coins. Test your knowledge and climb the leaderboard!"
        keywords="play contest, quiz contest, contest quiz, play quiz, quiz competition, contest game"
      />
      {audioElements}
      <DashboardNav />
      <div className="min-h-screen p-5 pb-20 bg-[#172031]" style={{
        // boxShadow: '0px 0px 2px 0px #FFF6D9'
      }}>
        <div className="max-w-md mx-auto ">
          {/* Header */}
          {quizStarted && (
            <div className="text-center mb-4">
              <p className="text-[#FFB540] text-lg font-bold mb-1">{contest?.name || 'Brain Test'}</p>
              <div className="flex-1 min-w-0 justify-center items-center gap-2 flex">
                <p className="text-white flex items-center gap-1 whitespace-nowrap">
                  Play & WinCoin

                  <svg
                    stroke="currentColor"
                    fill="currentColor"
                    strokeWidth="0"
                    viewBox="0 0 24 24"
                    className="text-[#FFB540]"
                    height="1em"
                    width="1em"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path d="M12 10c3.976 0 8-1.374 8-4s-4.024-4-8-4-8 1.374-8 4 4.024 4 8 4z"></path>
                    <path d="M4 10c0 2.626 4.024 4 8 4s8-1.374 8-4V8c0 2.626-4.024 4-8 4s-8-1.374-8-4v2z"></path>
                    <path d="M4 14c0 2.626 4.024 4 8 4s8-1.374 8-4v-2c0 2.626-4.024 4-8 4s-8-1.374-8-4v2z"></path>
                    <path d="M4 18c0 2.626 4.024 4 8 4s8-1.374 8-4v-2c0 2.626-4.024 4-8 4s-8-1.374-8-4v2z"></path>
                  </svg>

                  {(contest?.winCoins || 24000).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2">
              </div>
            </div>
          )}
          {/* Timer */}
          {quizStarted ? (
            <>
              {/* Main Container with overlapping Timer */}
              <div className="relative pt-10">
                {/* Timer - Centered and overlapping the top border */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 z-10">
                  <div className="relative w-24 h-24 bg-[#1F2937] rounded-full flex items-center justify-center shadow-lg">
                    {/* SVG Progress Ring */}
                    <svg className="absolute top-0 left-0 w-full h-full -rotate-90">
                      <circle
                        cx="48"
                        cy="48"
                        r="44" // Adjusted radius to fit inside the 24w container (96px)
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="transparent"
                        className="text-gray-700" // Background of the ring
                      />
                      <circle
                        cx="48"
                        cy="48"
                        r="44"
                        stroke="currentColor"
                        strokeWidth="6"
                        fill="transparent"
                        strokeDasharray={2 * Math.PI * 44}
                        strokeDashoffset={
                          2 * Math.PI * 44 - (totalTimeRemaining / (contest?.duration || 1)) * (2 * Math.PI * 44)
                        }
                        strokeLinecap="round"
                        className="text-yellow-500 transition-all duration-1000 ease-linear"
                      />
                    </svg>

                    {/* Timer Text */}
                    <span className="relative z-10 text-white text-3xl font-bold">
                      {Math.floor(totalTimeRemaining / 60)}:{String(totalTimeRemaining % 60).padStart(2, '0')}
                    </span>
                  </div>
                </div>

                {/* Question Card and Answer Options Container */}
                <div className="bg-[#2D3748] rounded-3xl p-4 shadow-2xl">
                  <div className="flex items-center justify-between mb-6">
                    {/* Correct Score */}
                    <div className="w-12 h-12 bg-[#2E7D32] rounded-full flex items-center justify-center shadow-inner">
                      <span className="text-white text-xl font-semibold">{correctAnswers}</span>
                    </div>

                    {/* Incorrect Score */}
                    <div className="w-12 h-12 bg-[#C62828] rounded-full flex items-center justify-center shadow-inner">
                      <span className="text-white text-xl font-semibold">{-Math.abs(incorrectAnswers)}</span>
                    </div>
                  </div>

                  {/* Question Number Pill */}
                  <div className="flex justify-center mb-8">
                    <span className="bg-[#1A202C] text-white px-6 py-2 rounded-full text-lg ">
                      Question {currentQuestionIndex + 1}/{totalQuestions}
                    </span>
                  </div>

                  {/* Question Text */}
                  <div className="mb-4">
                    <h2 className="text-white text-center text-xl ">
                      {currentQuestion.question}
                    </h2>
                  </div>

                  {/* Answer Options Grid */}
                  <div className="grid grid-cols-2 gap-4">
                    {currentQuestion.options.map((option, index) => {
                      const isSelected = selectedAnswer === option;
                      const isCorrect = option === currentQuestion.correctOption;
                      const showResult = selectedAnswer !== null;

                      let bgColor = 'bg-[#1A202C] hover:bg-[#E9B44C]';
                      let textColor = 'text-white';

                      if (showResult) {
                        if (isCorrect) bgColor = 'bg-[#2E7D32]';
                        else if (isSelected) bgColor = 'bg-[#C62828]';
                      }

                      return (
                        <button
                          key={index}
                          onClick={() => handleAnswerSelect(option)}
                          disabled={showResult}
                          className={`${bgColor} ${textColor} rounded-md p-2 text-md`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {quizStarted && (
            <>
              {/* Score */}
              <div className="text-center font-semibold text-[#FFB540] mt-4 mb-4 animate-fade-in">
                <span className="inline-block">Your Score is {score}</span>
              </div>
            </>
          )}
        </div>
        <div>
          <div className="w-full overflow-hidden ">
            <AdsenseAd adSlot="8153775072" adFormat="auto" />
          </div>
          <p className="text-center text-[#414d65] text-xs mt-2 mb-2 font-medium">A D V E R T I S E M E N T</p>
        </div>
      </div>
      {/* <Footer /> */}

      {/* Insufficient Coins Modal (Watch Video) */}
      {showingLifelineModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-[#0D0009] rounded-xl p-6 max-w-md w-full border border-[#FFF6D9]/20" style={{
            boxShadow: '0px 0px 2px 0px #FFF6D9'
          }}>
            <h3 className="text-[#FFF6D9] text-xl font-bold mb-4">Insufficient Coins</h3>
            <p className="text-[#FFF6D9]/80 mb-4">
              You need {contest?.lifeLineCharge || 0} coins to use this lifeline.
              Watch a video to earn coins!
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleWatchVideoForLifeline}
                className="flex-1 bg-yellow-400 text-[#0D0009] font-bold py-3 px-4 rounded-lg hover:bg-yellow-500 relative overflow-hidden"
              >
                <span className="relative z-10">Watch Video</span>
                <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
              </button>
              <button
                onClick={() => setShowingLifelineModal(null)}
                className="flex-1 bg-[#0D0009] text-[#FFF6D9] font-bold py-3 px-4 rounded-lg hover:bg-[#0D0009]/80 border border-[#FFF6D9]/30"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

