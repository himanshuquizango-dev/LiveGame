'use client';

import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';

export default function AboutUsPage() {
  const router = useRouter();
  
  return (
    <>
      <SEOHead 
        title="About Quizwala - Learn More About Our Quiz Platform"
        description="Learn about Quizwala - India's leading quiz platform. Discover our mission to make learning fun and rewarding through engaging quizzes, contests, and coin rewards."
        keywords="about quizwala, quiz platform, quiz app, online quiz, quiz company, quiz mission"
      />
      <DashboardNav />
      <div className="min-h-screen bg-[#172031] p-5">
        <div className="max-w-4xl mx-auto">
          <div>
            <h1 className="text-white text-2xl font-semibold text-center">About Us</h1>
            
            <div className="space-y-6 text-[#0D0009]">
              <div>
                <h2 className="text-xl font-semibold mb-3 text-white">Welcome to Quizwala</h2>
                <p className="text-white leading-relaxed">
                  Quizwinz is a fun and engaging quiz platform where you can test your knowledge, 
                  compete with others, and earn rewards. We offer a wide range of quiz topics 
                  to challenge your mind and help you learn new things every day.
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-white">Our Mission</h2>
                <p className="text-white leading-relaxed">
                  Our mission is to make learning fun and rewarding. We believe that quizzes 
                  are a great way to expand knowledge, improve cognitive skills, and have 
                  fun at the same time. Join thousands of players from around the world 
                  and start your quiz journey today!
                </p>
              </div>

              <div>
                <h2 className="text-xl font-semibold mb-3 text-white">Features</h2>
                <ul className="space-y-2 list-disc list-inside text-white">
                  <li>Wide variety of quiz categories</li>
                  <li>Compete with players worldwide</li>
                  <li>Earn coins and rewards</li>
                  <li>Track your progress and achievements</li>
                  <li>Regular contests and challenges</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

