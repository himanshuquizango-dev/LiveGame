'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';

export default function ReportIssuePage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    type: 'bug',
    description: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle form submission here
    alert('Thank you for reporting the issue! We will investigate and get back to you soon.');
    setFormData({ type: 'bug', description: '' });
  };

  return (
    <>
      <SEOHead
        title=" - Quizwala Support & Feedback"
        description="Report bugs, issues, or provide feedback to Quizwala. Help us improve the platform by reporting any problems you encounter while playing quizzes."
        keywords="report issue, quiz bug report, quiz feedback, quiz support, report problem"
      />
      <DashboardNav />
      <div className="min-h-screen bg-[#0D0009] p-5" style={{
        boxShadow: '0px 0px 2px 0px #FFF6D9'
      }}>
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#111827] rounded-2xl p-6 mb-5">
            <h1 className="text-white text-2xl font-bold mb-4 text-center">Report an Issue</h1>

            <form onSubmit={handleSubmit} className="space-y-4">
              <select
                value={formData.type}
                onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                className="w-full bg-white text-black px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400"
              >
                <option value="bug">It Stopped Working</option>
                <option value="delayed">Delayed Loading</option>
                <option value="not_responding">Quiz Not Responding</option>
                <option value="instruction">Instruction Not Clear</option>
                <option value="other">Other</option>
              </select>

              {formData.type === 'other' && (
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={4}
                  placeholder="Describe the problem..."
                  className="w-full bg-white text-black px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none"
                />
              )}

              <button
                type="submit"
                className="w-full bg-[#FFB540] text-black font-bold py-3 rounded-lg hover:bg-yellow-500 transition-colors"
              >
                Submit
              </button>
            </form>
          </div>
        </div>
      </div>
      <Footer />
    </>
  );
}

