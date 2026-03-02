"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

interface QuizResultCardProps {
  correctCount: number;
  coinsAwarded: number;
  onPlayAgain: () => void;
}

export const QuizResultCard = ({ correctCount, coinsAwarded, onPlayAgain }: QuizResultCardProps) => {
  const router = useRouter();
  const isPerfect = correctCount === 2;
  const gifRef = useRef<HTMLImageElement>(null);

  // Force GIF to loop by reloading it periodically
  useEffect(() => {
    if (isPerfect && gifRef.current) {
      const img = gifRef.current;
      const interval = setInterval(() => {
        // Reload the GIF to restart animation
        const currentSrc = img.src;
        // img.src = '';
        setTimeout(() => {
          img.src = currentSrc.split('?')[0] + '?t=' + Date.now();
        }, 0);
      }, 2000); // Reload every 2 seconds (adjust based on your GIF duration)

      return () => clearInterval(interval);
    }
  }, [isPerfect]);

  return (
    <div className="max-w-md mx-auto mt-0 bg-white rounded-xl">
      <div className="relative w-40 h-40 mx-auto">
        <img src="/won.gif" alt="winner" className="w-full h-full object-contain" />
      </div>
      <div className=" rounded-xl pt-0 p-4 text-center">
        <div className="rounded-lg ">
          <p className="text-lg font-bold text-black">You have got <span className="text-yellow-400">{coinsAwarded} </span>coins</p>
        </div>
<button
  onClick={() => router.push('/dashboard')}
  className="bg-[#ffb540] text-white rounded-sm font-bold text-[20px] mt-[25px] w-[305px] p-[12px] border-2 border-transparent transition-all duration-300 hover:bg-white hover:text-[#ffb540] hover:border-[#ffb540]"
>
  Play Now
</button>
      </div>
    </div>
  );
};











