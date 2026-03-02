import { style } from "framer-motion/client";

interface QuestionCardProps {
  question: string;
  options: string[];
  correctOption: string;
  selectedAnswer: string | null;
  currentQuestionNumber: number;
  totalQuestions: number;
  onAnswerSelect: (option: string) => void;
  disabled?: boolean;
}

export const QuestionCard = ({
  question,
  options,
  correctOption,
  selectedAnswer,
  currentQuestionNumber,
  totalQuestions,
  onAnswerSelect,
  disabled = false,
}: QuestionCardProps) => {
  // Ensure options and correctOption are strings (API/Excel may return numbers)
  const safeOptions = (options || []).map((o) => (o != null ? String(o) : ''));
  const safeCorrectOption = correctOption != null ? String(correctOption) : '';

  return (
    <div className="w-full">
      {/* Top Banner */}
      <div className="text-center pt-4 font-bold text-2xl">
        <h1 className="text-white">Quick Start!</h1>
      </div>
      <div className="flex items-center justify-center whitespace-nowrap gap-x-2 text-md sm:text-base md:text-xl pb-8">
        <p className="font-normal text-[#FFFFFFA3]">
          Answer Two Questions & Win Upto 200.
        </p>
      </div>



      {/* Question Card */}
      <div className="bg-[#3b4559] rounded-xl p-3 pb-12 shadow-lg relative ">
        <div className="rounded-xl py-3 px-1 mb-4">
          <h2 className="text-lg font-semibold text-white text-center leading-relaxed">
            {question}
          </h2>
        </div>

        {/* Options */}
        <div className="grid grid-cols-2 gap-3 ">
          {safeOptions.map((option, index) => {
            const isSelected = selectedAnswer === option;
            const isCorrect = option === safeCorrectOption;
            const showCorrectAnswer = selectedAnswer !== null; // Show correct answer after selection
            let buttonClass =
              'py-1 px-4 rounded-md  text-white font-semibold text-center shadow-md transition overflow-hidden break-words whitespace-normal min-h-[3rem] flex items-center justify-center';

            // If an answer has been selected, show feedback
            if (showCorrectAnswer) {
              if (isCorrect) {
                // Correct answer - always show in green
                buttonClass += ' bg-[#34A853] text-white border-[#34A853]';
              } else if (isSelected) {
                // Wrong selected answer - show in red
                buttonClass += ' bg-[#ED4762] text-white border-[#ED4762]';
              } else {
                // Not selected and not correct - show as normal but slightly dimmed
                buttonClass += ' bg-[#172031] text-white border-gray-300 opacity-60';
              }
            } else {
              // No answer selected yet - normal state
              buttonClass +=
                ' bg-[#172031] text-black  hover:bg-[#E9B44C]';
            }

            if (disabled || selectedAnswer) {
              buttonClass += ' cursor-not-allowed opacity-95';
            } else {
              buttonClass += ' cursor-pointer active:scale-95';
            }

            return (
              <button
                key={index}
                className={buttonClass}
                onClick={() =>
                  !disabled && !selectedAnswer && onAnswerSelect(option)
                }
                disabled={disabled || !!selectedAnswer}
              >
                <span className="block w-full break-words">{option}</span>
              </button>
            );
          })}
        </div>

        {/* Progress Indicator (HALF INSIDE / HALF OUTSIDE) */}
        <div className="absolute left-1/2 -top-4 -translate-x-1/2">
          <div className="bg-[#172031] border-2 border-[#3b4559] rounded-4xl px-4 py-1.5 shadow-md w-fit">
            <span className="text-sm font-medium text-white ">
              {currentQuestionNumber} <b>/</b> <span className="font-bold">
                {totalQuestions}
              </span> Questions
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};









