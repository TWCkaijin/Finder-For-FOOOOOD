import React, { useEffect, useRef, useState } from 'react';
import { Language } from '../types';

const FOOD_ICONS = ['🍔', '🍕', '🍜', '🍣', '🍩', '🍦', '☕️', '🍱', '🌭', '🍗', '🥞', '🥗'];

interface LoadingOverlayProps {
  message: string;
  error: string | null;
  isDevMode: boolean;
  streamOutput: string;
  language: Language;
  onClose: () => void;
  onCancel: () => void;
  isFinishing?: boolean;
}

// Background Blobs (Reused Logic for consistency)
const BackgroundBlobs = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <div className="absolute top-[20%] left-[20%] w-[40%] h-[40%] rounded-full bg-purple-500/30 blur-[120px] animate-blob mix-blend-screen filter" />
    <div className="absolute bottom-[20%] right-[20%] w-[40%] h-[40%] rounded-full bg-input-primary/30 blur-[120px] animate-blob animation-delay-2000 mix-blend-screen filter" />
  </div>
);

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  message: baseMessage,
  error,
  isDevMode,
  streamOutput,
  language,
  onClose,
  onCancel,
  isFinishing
}) => {
  const scrollRef = useRef<HTMLPreElement>(null);
  const [funnyMessage, setFunnyMessage] = useState(baseMessage);
  const [msgIndex, setMsgIndex] = useState(0);

  const [foodIndex, setFoodIndex] = useState(0);
  const [isEntering, setIsEntering] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const handleCancel = () => {
    setIsExiting(true);
    setTimeout(() => onCancel(), 500);
  };

  useEffect(() => {
    if (isFinishing) setIsExiting(true);
  }, [isFinishing]);

  useEffect(() => {
    requestAnimationFrame(() => setIsVisible(true));
    // Trigger "Big to Small" animation on mount
    const t = setTimeout(() => setIsEntering(false), 500);
    return () => clearTimeout(t);
  }, []);

  const [iconVisible, setIconVisible] = useState(true);

  // Rotate Food Icon with Fade Effect
  useEffect(() => {
    if (error) return;
    const interval = setInterval(() => {
      setIconVisible(false);
      setTimeout(() => {
        setFoodIndex(prev => (prev + 1) % FOOD_ICONS.length);
        setIconVisible(true);
      }, 300);
    }, 1500);
    return () => clearInterval(interval);
  }, [error]);

  // Auto-scroll to bottom of terminal
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamOutput]);

  // Funny messages data
  const funnyMessages: Record<Language, string[]> = {
    'zh-TW': [
      "正在聞聞附近店家的香味...",
      "正在為你試吃中...",
      "這間不行，幫你換一間...",
      "正在偷看別人的食記...",
      "正在計算卡路里 (誤)...",
      "正在跟老闆殺價 (並不會)...",
      "AI 正在流口水...",
      "正在尋找隱藏版美食..."
    ],
    'en': [
      "Smelling the delicious food nearby...",
      "Tasting it for you virtually...",
      "Skipping the bad ones...",
      "Peeking at customer reviews...",
      "Calculating calories (just kidding)...",
      "Asking the chef for recommendations...",
      "AI is drooling right now...",
      "Hunting for hidden gems..."
    ],
    'ja': [
      "近くの美味しい匂いを嗅いでいます...",
      "あなたのために味見中...",
      "ハズレのお店は除外しています...",
      "こっそりレビューを覗き見中...",
      "カロリー計算中（嘘です）...",
      "シェフにおすすめを聞いています...",
      "AIもよだれを垂らしています...",
      "隠れた名店を探しています..."
    ]
  };

  // Cycle messages
  useEffect(() => {
    if (error) return;

    // Set initial message
    setFunnyMessage(funnyMessages[language][0]);

    const interval = setInterval(() => {
      setMsgIndex((prev) => {
        const next = (prev + 1) % funnyMessages[language].length;
        setFunnyMessage(funnyMessages[language][next]);
        return next;
      });
    }, 5000); // Change every 5 seconds

    return () => clearInterval(interval);
  }, [language, error]);

  const isErrorState = error !== null;

  return (
    <div className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md transition-opacity duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] overflow-hidden ${(isVisible && !isExiting) ? 'opacity-100' : 'opacity-0'}`}>

      {/* Dynamic Background */}
      <BackgroundBlobs />

      <div className={`relative z-10 flex flex-col items-center w-full mx-4 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${isDevMode ? 'bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl border border-white/20 dark:border-white/10 max-w-4xl h-[80vh]' : 'max-w-sm animate-float-slow'}`}>

        {/* Icon (Loading or Error) */}
        <div
          className={`relative w-28 h-28 mb-6 shrink-0 transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${(isEntering || isExiting) ? 'opacity-0' : 'opacity-100'}`}
          style={{ transform: (isEntering || isExiting) ? 'scale(15)' : 'scale(1)' }}
        >
          <div className={`absolute inset-0 border-4 rounded-full opacity-30 ${isErrorState ? 'border-red-500' : 'border-white/20'}`}></div>

          {!isErrorState && (
            <div className={`absolute inset-0 border-4 rounded-full transition-all duration-500 ${isFinishing ? 'border-green-500 opacity-0' : 'border-input-primary border-t-transparent animate-spin'}`}></div>
          )}

          <div className="absolute inset-0 flex items-center justify-center">
            {isErrorState ? (
              <span className="material-symbols-outlined text-3xl text-red-500">error_outline</span>
            ) : isFinishing ? (
              <span className="material-symbols-outlined text-6xl text-green-500 animate-in zoom-in duration-300">check_circle</span>
            ) : (
              <div className={`text-6xl filter drop-shadow-sm transition-all duration-500 ease-out ${iconVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}>
                {FOOD_ICONS[foodIndex]}
              </div>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className={`text-xl font-bold mb-2 shrink-0 drop-shadow-md ${isErrorState ? 'text-red-400' : 'text-white'}`}>
          {isErrorState ? (language === 'en' ? 'Error Occurred' : '發生錯誤') : (language === 'en' ? 'Searching...' : '正在搜尋美食...')}
        </h3>

        {/* Message / Error Description */}
        <p className={`text-sm text-center mb-6 shrink-0 whitespace-pre-line h-6 transition-all duration-500 font-medium drop-shadow-sm ${isErrorState ? 'text-gray-200' : 'text-gray-300'}`}>
          {isErrorState ? error : funnyMessage}
        </p>

        {/* Error Action Button */}
        {isErrorState && (
          <button
            onClick={onClose}
            className="mb-4 px-6 py-2 bg-red-100 hover:bg-red-200 text-red-700 dark:bg-red-900/30 dark:text-red-300 dark:hover:bg-red-900/50 rounded-lg font-bold transition-colors"
          >
            {language === 'en' ? 'Close & Retry' : '關閉並重試'}
          </button>
        )}

        {/* Developer Terminal */}
        {isDevMode && (
          <div className={`w-full flex-grow flex flex-col bg-gray-950 rounded-xl overflow-hidden font-mono text-xs shadow-inner border ${isErrorState ? 'border-red-900' : 'border-gray-700'}`}>
            <div className="bg-gray-800 px-4 py-2 text-gray-400 flex items-center justify-between border-b border-gray-700">
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[14px]">terminal</span>
                Gemini Stream Output
              </span>
              {isErrorState ? (
                <span className="text-[10px] bg-red-900 text-red-300 px-1.5 rounded">ERROR</span>
              ) : (
                <span className="text-[10px] bg-green-900 text-green-300 px-1.5 rounded">LIVE</span>
              )}
            </div>
            <pre ref={scrollRef} className={`flex-grow p-4 overflow-y-auto whitespace-pre-wrap break-all leading-relaxed ${isErrorState ? 'text-red-300' : 'text-green-400'}`}>
              {streamOutput || <span className="text-gray-600 animate-pulse">Waiting for stream...</span>}
            </pre>
          </div>
        )}



        {/* Cancel Button (Only when loading) */}
        {!isErrorState && (
          <button
            onClick={handleCancel}
            className="mt-2 text-xs font-bold text-gray-400 hover:text-red-500 transition-colors uppercase tracking-wider"
          >
            {language === 'en' ? 'Cancel' : '取消搜尋'}
          </button>
        )}

      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(200%); }
        }
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob {
          animation: blob 10s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        @keyframes float-slow {
             0% { transform: translateY(0px); }
             50% { transform: translateY(-10px); }
             100% { transform: translateY(0px); }
        }
        .animate-float-slow {
            animation: float-slow 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};
