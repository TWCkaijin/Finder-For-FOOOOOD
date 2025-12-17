import React, { useEffect, useRef, useState } from 'react';
import { Language } from '../types';

interface LoadingOverlayProps {
  message: string;
  error: string | null;
  isDevMode: boolean;
  streamOutput: string;
  language: Language;
  onClose: () => void;
  onCancel: () => void;
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
    onCancel
}) => {
  const scrollRef = useRef<HTMLPreElement>(null);
  const [funnyMessage, setFunnyMessage] = useState(baseMessage);
  const [msgIndex, setMsgIndex] = useState(0);

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
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-md transition-opacity overflow-hidden">
      
      {/* Dynamic Background */}
      <BackgroundBlobs />

      <div className={`relative z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl p-8 rounded-3xl shadow-2xl flex flex-col items-center w-full mx-4 border border-white/20 dark:border-white/10 transition-all duration-500 ${isDevMode ? 'max-w-4xl h-[80vh]' : 'max-w-sm animate-float-slow'}`}>
        
        {/* Icon (Loading or Error) */}
        <div className="relative w-20 h-20 mb-6 shrink-0">
          <div className={`absolute inset-0 border-4 rounded-full opacity-30 ${isErrorState ? 'border-red-500' : 'border-gray-300'}`}></div>
          
          {!isErrorState && (
            <div className="absolute inset-0 border-4 border-input-primary rounded-full border-t-transparent animate-spin"></div>
          )}

          <span className={`material-symbols-outlined absolute inset-0 flex items-center justify-center text-3xl ${isErrorState ? 'text-red-500' : 'text-input-primary animate-pulse'}`}>
            {isErrorState ? 'error_outline' : 'restaurant'}
          </span>
        </div>
        
        {/* Title */}
        <h3 className={`text-xl font-bold mb-2 shrink-0 ${isErrorState ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-white'}`}>
          {isErrorState ? (language === 'en' ? 'Error Occurred' : '發生錯誤') : (language === 'en' ? 'Searching...' : '正在搜尋美食...')}
        </h3>
        
        {/* Message / Error Description */}
        <p className="text-gray-500 dark:text-gray-300 text-sm text-center mb-6 shrink-0 whitespace-pre-line h-6 transition-all duration-500 font-medium">
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
        
        {/* Progress Bar (Only when loading, not on error) */}
        {!isDevMode && !isErrorState && (
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 overflow-hidden mb-4">
            <div className="bg-input-primary h-1.5 rounded-full animate-[loading_2s_ease-in-out_infinite] w-1/2"></div>
          </div>
        )}

        {/* Cancel Button (Only when loading) */}
        {!isErrorState && (
            <button
                onClick={onCancel}
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
