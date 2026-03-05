"use client";

import { useState } from "react";

interface RewardModalProps {
    isOpen: boolean;
    coinsAmount: number;
    onClaim: () => void;
    onClose: () => void;
}

export const RewardModal = ({ isOpen, coinsAmount, onClaim, onClose }: RewardModalProps) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-[#172031] z-50 flex items-center justify-center p-4">
            <div className="bg-[#111827] rounded-3xl w-full max-w-[750px] p-8 text-center shadow-2xl border border-white/20 relative">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 text-white/70 hover:text-white text-3xl font-light transition-colors"
                >
                    ×
                </button>

                {/* Coin Icon */}
                <style>{`
                  @keyframes spinCoin {
                    from { transform: rotateY(0deg); }
                    to { transform: rotateY(360deg); }
                  }
                  .coin-spin {
                    animation: spinCoin 2s linear infinite;
                  }
                `}</style>
                <div className="flex justify-center">
                    <div className="relative w-40 h-40 mx-auto coin-spin" style={{ perspective: '1000px' }}>
                        <img src="/coin1.png" alt="winner" className="w-full h-full object-contain" />
                    </div>
                </div>

                {/* Header Text */}
                <p className="text-[#FFB540] text-2xl  mb-4">New Reward Available</p>

                {/* Main Heading */}
                <h2 className="text-white text-4xl  mb-4">
                    Get Instant {coinsAmount} Coins!
                </h2>

                {/* Description */}
                <p className="text-gray-400 text-base mb-8">
                    Watch a simple ad and get rewarded
                </p>

                {/* Claim Button */}
                <button
                    onClick={onClaim}
                    className="w- bg-[#FFB540]  text-black font-bold text-lg py-3 px-6 rounded-full w-[50%]"
                >
                    Claim
                </button>
            </div>
        </div>
    );
};
