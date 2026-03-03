'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardNav } from '@/components/DashboardNav';
import { Footer } from '@/components/Footer';
import { SEOHead } from '@/components/SEOHead';
import { feedbackApi } from '@/lib/api';

export default function ContactUsPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields are filled
    if (!formData.name.trim()) {
      alert('Name is required');
      return;
    }
    if (!formData.email.trim()) {
      alert('Email is required');
      return;
    }
    if (!formData.message.trim()) {
      alert('Message is required');
      return;
    }

    try {
      setSubmitting(true);
      const response = await feedbackApi.sendContact({
        name: formData.name.trim(),
        email: formData.email.trim(),
        message: formData.message.trim(),
      });
      
      // Show success message
      alert(response.message || 'Thank you for your message! We will get back to you soon.');
      
      // Reset form
      setFormData({ name: '', email: '', message: '' });
    } catch (err: any) {
      console.error('Error sending feedback:', err);
      const errorMessage = err.response?.data?.error || 'Failed to send message. Please try again.';
      alert(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <SEOHead 
        title="Contact Quizwala - Get in Touch With Us"
        description="Have questions or feedback? Contact Quizwala support team. We're here to help with any queries about quizzes, contests, coins, or account issues."
        keywords="contact quizwala, quiz support, quiz help, quiz feedback, quiz customer service"
      />
      <DashboardNav />
      <div className="min-h-screen bg-[#172031] p-5" style={{
        boxShadow: '0px 0px 2px 0px #FFF6D9'
      }}>
        <div className="max-w-4xl mx-auto ">
          {/* Back Button - Outside the div */}
          
          <div className="bg-[#ffffff1c] rounded-xl p-6 mb-5 ">
            
            <div className="space-y-6">

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-white text-sm mb-2">Name</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                    className="w-full bg-white text-black px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-[#BFBAA7]"
                  />
                </div>

                <div>
                  <label className="block text-white text-sm mb-2">Email</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="w-full bg-white text-black px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 border border-[#BFBAA7]"
                  />
                </div>

                <div>
                  <label className="block text-white text-sm mb-2">Message</label>
                  <textarea
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    required
                    rows={2}
                    className="w-full bg-white text-black px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 resize-none border border-[#BFBAA7]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full bg-[#FFB540] text-white font-semibold py-3 px-6 rounded-lg"
                >
                  <span className="relative z-10 text-xl">{submitting ? 'Sending...' : 'Submit'}</span>
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
