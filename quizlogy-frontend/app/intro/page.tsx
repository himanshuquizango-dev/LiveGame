'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Question, funfactsApi, FunFact, authApi, twoQuestionsApi } from '@/lib/api';
import { visitorTrackingApi } from '@/lib/visitorTracking';
import { HeadNav } from '@/components/headnav';
import { QuestionCard } from '@/components/QuestionCard';
import { QuizResultCard } from '@/components/QuizResultCard';
import { WrongAnswerPopup } from '@/components/WrongAnswerPopup';
import AdsenseAd from '@/components/AdsenseAd';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';

interface AnswerResult {
  questionId: string;
  selectedAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
}

export default function IntroPage() {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [answers, setAnswers] = useState<AnswerResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [funfacts, setFunfacts] = useState<FunFact[]>([]);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [showPopup, setShowPopup] = useState(false);
  const [coinsAwarded, setCoinsAwarded] = useState(0);
  const [isGuest, setIsGuest] = useState(false);

  useEffect(() => {
    // If user has played intro in the last 1 hour, redirect to dashboard (no replay)
    const lastPlayedTimestamp = localStorage.getItem('introLastPlayed');
    const oneHourInMs = 1;

    if (lastPlayedTimestamp) {
      const lastPlayed = parseInt(lastPlayedTimestamp, 10);
      const timeDifference = Date.now() - lastPlayed;
      if (timeDifference < oneHourInMs) {
        router.push('/dashboard');
        return;
      }
    }

    checkGuestMode();
    fetchRandomQuestions();
    fetchRandomFunfacts();
  }, [router]);

  const checkGuestMode = () => {
    const storedUser = localStorage.getItem('user');
    if (!storedUser) {
      setIsGuest(true);
      // Initialize guest coins if not exists
      if (!localStorage.getItem('guestCoins')) {
        localStorage.setItem('guestCoins', '0');
      }
    }
  };

  const fetchRandomQuestions = async () => {
    try {
      setLoading(true);

      // Get user country code for intro questions (e.g. "IN", "US")
      let country: string | undefined;
      try {
        const visitorData = await visitorTrackingApi.getVisitorInfo();
        const visitor = visitorData?.visitor;
        if (visitor?.countryCode && visitor.countryCode !== 'UN') {
          country = visitor.countryCode; // ISO code e.g. "IN", "US"
          localStorage.setItem('userCountryCode', visitor.countryCode);
        }
      } catch {
        // Backend will derive country from request IP if we don't pass it
      }

      // Get previously shown question IDs from localStorage
      const shownQuestionIds = JSON.parse(localStorage.getItem('introShownQuestionIds') || '[]');

      // Fetch random two questions filtered by user country
      const selectedQuestions = await twoQuestionsApi.getRandom(2, shownQuestionIds, country);

      if (selectedQuestions.length === 0) {
        // If no questions available, reset the tracking and try again
        localStorage.setItem('introShownQuestionIds', '[]');
        const retryQuestions = await twoQuestionsApi.getRandom(2, [], country);
        if (retryQuestions.length === 0) {
          throw new Error('No questions available');
        }
        setQuestions(retryQuestions);
        // Store the new question IDs
        const newQuestionIds = retryQuestions.map(q => q.id);
        localStorage.setItem('introShownQuestionIds', JSON.stringify(newQuestionIds));
      } else {
        setQuestions(selectedQuestions);

        // Check if any of the returned questions were in our exclude list
        // This means the backend reset because we've shown all questions
        const returnedIds = selectedQuestions.map(q => q.id);
        const wereExcluded = returnedIds.some(id => shownQuestionIds.includes(id));

        if (wereExcluded) {
          // Backend reset - all questions were shown, start fresh with these new questions
          localStorage.setItem('introShownQuestionIds', JSON.stringify(returnedIds));
        } else {
          // Normal case - add new question IDs to the tracking list
          const updatedShownIds = [...shownQuestionIds, ...returnedIds];
          localStorage.setItem('introShownQuestionIds', JSON.stringify(updatedShownIds));
        }
      }
    } catch (err) {
      console.error('Error fetching questions from API:', err);
      setError('Failed to load questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchRandomFunfacts = async () => {
    try {
      const data = await funfactsApi.getAll('ACTIVE');

      // Filter funfacts that have descriptions
      const funfactsWithDescriptions = data.filter(f => f.description && f.description.trim().length > 0);

      if (funfactsWithDescriptions.length === 0) {
        return;
      }

      // Shuffle and get 5 random funfacts (no duplicates)
      const shuffled = [...funfactsWithDescriptions].sort(() => Math.random() - 0.5);
      const randomFunfacts = shuffled.slice(0, Math.min(6, funfactsWithDescriptions.length));

      setFunfacts(randomFunfacts);
    } catch (err) {
      console.error('Error fetching funfacts:', err);
      // Don't set error, just continue without funfacts
    }
  };

  const handleAnswerSelect = (option: string) => {
    if (selectedAnswer) return; // Prevent changing answer once selected
    setSelectedAnswer(option);

    // Save the answer result
    const currentQ = questions[currentQuestionIndex];
    const isCorrect = option === currentQ.correctOption;
    const answerResult: AnswerResult = {
      questionId: currentQ.id,
      selectedAnswer: option,
      correctAnswer: currentQ.correctOption,
      isCorrect,
    };

    const newAnswers = [...answers, answerResult];
    setAnswers(newAnswers);

    // If this is the last question, show results on the same page
    if (currentQuestionIndex === questions.length - 1) {
      setTimeout(async () => {
        // Calculate coins based on correct answers
        const correctCount = newAnswers.filter((r: AnswerResult) => r.isCorrect).length;
        let coinsToAward = 0;

        if (correctCount === 2) {
          // Both correct - award 200 coins
          coinsToAward = 200;
        } else if (correctCount === 1) {
          // One correct - award 100 coins
          coinsToAward = 100;
        } else {
          // Both incorrect - award 0 coins
          coinsToAward = 0;
        }

        // Award coins if any were earned
        if (coinsToAward > 0) {
          try {
            const storedUser = localStorage.getItem('user');
            if (storedUser) {
              // Logged in user - award to account
              await authApi.awardCoins(coinsToAward, `Completed intro quiz with ${correctCount} correct answer${correctCount > 1 ? 's' : ''}`);
              const userData = await authApi.getCurrentUser();
              localStorage.setItem('user', JSON.stringify(userData));
            } else {
              // Guest user - store in localStorage
              const currentGuestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
              localStorage.setItem('guestCoins', (currentGuestCoins + coinsToAward).toString());
            }
            setCoinsAwarded(coinsToAward); // Always show coins in UI
          } catch (err) {
            console.error('Error awarding coins:', err);
            // If API fails but user is guest, still award locally
            if (!localStorage.getItem('user')) {
              const currentGuestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
              localStorage.setItem('guestCoins', (currentGuestCoins + coinsToAward).toString());
            }
            setCoinsAwarded(coinsToAward); // Still show in UI even if API call fails
          }
        } else {
          setCoinsAwarded(0);
        }

        // Don't show popup for now - commented out but kept for future use
        // To reuse the popup in the future:
        // 1. Uncomment the popup rendering below (around line 299)
        // 2. Set setShowPopup(true) when you want to show it (e.g., when correctCount < 2)
        // 3. The popup allows users to watch an ad to earn additional coins
        // 4. You can customize the popup behavior in handleWatchAd function
        setShowPopup(false);
        setQuizCompleted(true);
        // Save the current timestamp when intro is completed
        localStorage.setItem('introLastPlayed', Date.now().toString());
      }, 1000); // Show feedback for 1 second before showing results
    } else {
      // If not the last question, automatically move to next question after 1 second
      setTimeout(() => {
        setCurrentQuestionIndex(currentQuestionIndex + 1);
        setSelectedAnswer(null);
      }, 1000); // Auto-advance after 1 second
    }
  };

  const handleWatchAd = async () => {
    // TODO: Implement ad watching logic
    // For now, just award coins and close popup
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        // Logged in user - award to account
        await authApi.awardCoins(200, 'Watched ad after intro quiz');
        const userData = await authApi.getCurrentUser();
        localStorage.setItem('user', JSON.stringify(userData));
      } else {
        // Guest user - store in localStorage
        const currentGuestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
        localStorage.setItem('guestCoins', (currentGuestCoins + 200).toString());
      }
      setCoinsAwarded(200); // Always show coins in UI
    } catch (err) {
      console.error('Error awarding coins:', err);
      // If API fails but user is guest, still award locally
      if (!localStorage.getItem('user')) {
        const currentGuestCoins = parseInt(localStorage.getItem('guestCoins') || '0');
        localStorage.setItem('guestCoins', (currentGuestCoins + 200).toString());
      }
      setCoinsAwarded(200); // Still show in UI even if API call fails
    }
    setShowPopup(false);
    // You can add actual ad integration here
  };

  const handleClosePopup = () => {
    setShowPopup(false);
  };

  const handlePlayAgain = () => {
    // Reset quiz state (but keep the shown question IDs to avoid showing same questions)
    setQuizCompleted(false);
    setShowPopup(false);
    setCoinsAwarded(0);
    setAnswers([]);
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    // Fetch new questions (will exclude previously shown ones)
    fetchRandomQuestions();
  };

  const currentQuestion = questions[currentQuestionIndex];
  const correctCount = answers.filter(r => r.isCorrect).length;
  const shouldShowPopup = showPopup && correctCount < 2;

  const noQuestions = !loading && questions.length === 0;


  return (<>
    <SEOHead
      title="Play Quiz - Test Your Knowledge & Win Coins | Quizwala"
      description="Play exciting quizzes on Quizwala! Answer questions, test your knowledge, earn coins, and win prizes. Start playing now and challenge yourself!"
      keywords="play quiz, quiz game, test knowledge, quiz questions, earn coins, quiz contest"
    />

    {/* First Advertisement - Above the fold, before quiz content */}
    <div className="min-h-[291px] min-width-[490px] bg-[#2a334d] ">
      <div className="w-full overflow-hidden ">
        <AdsenseAd adSlot="8153775072" adFormat="auto" />
      </div>
      <p className="text-center text-[#414d65] text-xs mt-2 mb-2 font-medium">A D V E R T I S E M E N T</p>
    </div>
    <div className="min-h-screen  from-purple-800 via-purple-700 to-purple-900 px-5 py-0 pb-1 ">

      {/* Question Card Component or Result Card - Fixed height to prevent layout shift */}
      {noQuestions ? (
        <div className="max-w-md mx-auto mb-8 mt-10 text-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="w-full bg-[#FBD457] text-black py-5 rounded-xl font-bold text-lg transition-transform hover:scale-[1.02] active:scale-[0.98] relative overflow-hidden shadow-lg animate-pulse"
          >
            <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent shiny-effect"></span>
            Tap to Play
          </button>
        </div>
      ) : !loading && questions.length > 0 ? (
        <div className="max-w-md mx-auto mb-8 ">
          {quizCompleted ? (
            <QuizResultCard
              correctCount={correctCount}
              coinsAwarded={coinsAwarded}
              onPlayAgain={handlePlayAgain}
            />
          ) : (
            <QuestionCard
              question={currentQuestion.question}
              options={currentQuestion.options}
              correctOption={currentQuestion.correctOption}
              selectedAnswer={selectedAnswer}
              currentQuestionNumber={currentQuestionIndex + 1}
              totalQuestions={questions.length}
              onAnswerSelect={handleAnswerSelect}
              disabled={!!selectedAnswer}
            />
          )}
        </div>
      ) : null}


      {!quizCompleted && (
        <>
          {/* Quiz Platform */}
          <div className="max-w-md mx-auto bg-[#3b4559] rounded-xl p-4 sm:p-5 mb-5">
            <h3 className="text-white font-semibold text-center">Why Choose Our Quiz Platform?</h3>
            <div className="bg-[#1f2438] mt-4 mb-4 p-2 rounded-xl text-center w-full">

              {/* Icon + Title */}
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-2xl">🏆</span>
                <p className="font-semibold text-white text-lg">Daily Rewards</p>
              </div>

              {/* Description */}
              <p className="text-gray-400 text-sm max-w-md mx-auto">Login daily to get bonus coins and special rewards
              </p>

            </div>
            <div className="bg-[#1f2438] mb-4 p-2 rounded-xl text-center w-full">

              {/* Icon + Title */}
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-2xl">📱</span>
                <p className="font-semibold text-white text-lg">Mobile Friendly</p>
              </div>

              {/* Description */}
              <p className="text-gray-400 text-sm max-w-md mx-auto">Play seamlessly on any device – mobile, tablet, or desktop
              </p>

            </div>
            <div className="bg-[#1f2438] mb-2 p-2 rounded-xl text-center w-full">

              {/* Icon + Title */}
              <div className="flex items-center justify-center gap-3 mb-2">
                <span className="text-2xl">⚡</span>
                <p className="font-semibold text-white text-lg">Live Contests</p>
              </div>

              {/* Description */}
              <p className="text-gray-400 text-sm max-w-md mx-auto">Join real-time quiz competitions with players worldwide.
              </p>

            </div>
          </div>
        </>
      )}

      {/* Second Advertisement - Between content sections for engagement */}
      <div className="bg-[#2a334d] rounded-lg  mb-5 shadow-lg">
        <div className="w-full overflow-hidden">
          <AdsenseAd adSlot="8153775072" adFormat="auto" />
        </div>
        <p className="text-center text-[#414d65] text-xs mt-2 mb-2 font-medium">A D V E R T I S E M E N T</p>
      </div>


      {!quizCompleted && (
        <>
          {/* #Fun Fact */}
          <div className="max-w-md mx-auto bg-[#3b4559] rounded-xl p-4 sm:p-5 mb-5">
            <p className="text-center text-white " style={{ fontSize: 18, fontWeight: 600 }}>#Fun Fact</p>
            <p className="text-xs sm:text-sm text-white mt-2 text-center">
              Mahendra Singh Dhoni clenches a title of being the most successful
              captain in the IPL history.
            </p>
          </div>
        </>
      )}

      {!quizCompleted && (
        <div className="max-w-md mx-auto bg-[#3b4559] rounded-xl p-4 sm:p-5 mb-5">
          <p className=" text-white " style={{ fontSize: 30, fontWeight: 500 }}>How to Play?</p>
          <ol className='text-lg text-white mt-2'>
            <li>1. Select your favorite quiz category</li>
            <li>2. Answer questions correctly to earn coins</li>
            <li>3. Compete on leaderboards</li>
            <li>4. Redeem coins for exciting rewards</li>
          </ol>
        </div>
      )}

      {/* Play Quiz and Win Coins! */}
      <div>
        <p className="text-white text-center" style={{ fontSize: 20, fontWeight: 500 }}>Play Quiz and Win Coins!</p>
        <div className="w-63 h-[2px] m-auto bg-white mt-2"></div>
        <ul className="space-y-3 text-left text-sm text-gray-300 m-5">
          <li className="flex gap-3">
            <span className="font-bold">•</span>
            <span>
              Play Quizzes in 25+ categories like GK, Sports, Bollywood,
              Business, Cricket & more!
            </span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold">•</span>
            <span>Compete with lakhs of other players!</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold">•</span>
            <span>Win coins for every game</span>
          </li>
          <li className="flex gap-3">
            <span className="font-bold">•</span>
            <span>
              Trusted by millions of other quiz enthusiasts like YOU!
            </span>
          </li>
        </ul>
      </div>
    </div>
  </>
  );
}
