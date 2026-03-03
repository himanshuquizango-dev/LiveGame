'use client';

import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import AdsenseAd from '@/components/AdsenseAd';

export default function QuizRulesPage() {
  const router = useRouter();
  
  return (
    <>
      <SEOHead 
        title="Quiz Rules - How to Play Quizzes on Quizwala"
        description="Learn the rules and guidelines for playing quizzes on Quizwala. Understand scoring, time limits, coin rewards, and how to maximize your quiz performance."
        keywords="quiz rules, how to play quiz, quiz guidelines, quiz instructions, quiz scoring"
      />
      <DashboardNav />
      <div className="min-h-screen bg-[#172031]">
        <div className="max-w-4xl mx-auto p-5">
          {/* Contest Rules Content */}
          <div className="">
            <div className="text-center mb-8">
              <h1 className="text-white text-2xl font-semibold mb-2">Contest Rules!</h1>
            </div>
            
            {/* Rules Content */}
            <div className="space-y-4 text-white">
              <ul className="space-y-3 list-none">
                <li className="flex items-start">
                  <span className="text-white mr-2">•</span>
                  <span>The winners for each quiz will be declared based on the scores they obtain during the participation in the quiz</span>
                </li>
                <li className="flex items-start">
                  <span className="text-white mr-2">•</span>
                  <span>There will be a fixed time for declaring the winners of each quiz.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-white mr-2">•</span>
                  <span>You will have overall 60 seconds to solve as many as questions from 20 questions in quiz.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-white mr-2">•</span>
                  <span>There will be 4 options given below each question and one will be the answer for it out of them.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-white mr-2">•</span>
                  <span>Each right answer fetches you 25 points.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-white mr-2">•</span>
                  <span>Each wrong answer gives you (-) 10 points.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-white mr-2">•</span>
                  <span>Do not forget to use the lifelines in case if you are stuck during the contest.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-white mr-2">•</span>
                  <span>Remember users can use each lifeline once during the each contest. Use a given amount of coins from your coin bank or watch an ad for a few secs to use the lifeline for free!</span>
                </li>
                <li className="flex items-start">
                  <span className="text-white mr-2">•</span>
                  <span>You would have 4 different lifelines to use:</span>
                </li>
                <li className="flex items-start pl-5">
                  <span className="text-white mr-2">•</span>
                  <span>50:50 – On using it, two incorrect answers will be eliminated from the screen.</span>
                </li>
                <li className="flex items-start pl-5">
                  <span className="text-white mr-2">•</span>
                  <span>Freezer Time – A pause for the ongoing timer will take place for 30 seconds while allowing the users get more time to answer the question.</span>
                </li>
                <li className="flex items-start pl-5">
                  <span className="text-white mr-2">•</span>
                  <span>Audience Poll – You can use this option to choose the right answer out of 4 options by using the intelligence of the smart audience.</span>
                </li>
                <li className="flex items-start pl-5">
                  <span className="text-white mr-2">•</span>
                  <span>Flip Question – A new question will interchange the question currently showing on the screen.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Advertisement Section - Optimally placed after rules content */}
          {/* <div>
            <div className="w-full overflow-hidden">
              <AdsenseAd adSlot="8153775072" adFormat="auto" />
            <p className="text-center text-[#FFF6D9] text-xs  font-medium">ADVERTISEMENT</p>
            </div>
          </div> */}

        </div>
      </div>
    </>
  );
}

