import React, { useState, useEffect, useMemo } from 'react';
import { SearchParams, Language } from '../types';
import { getHistory } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface InputViewProps {
  onSearch: (params: SearchParams, isDevMode: boolean) => void;
  isLoading: boolean;
}

// Internal component for background blobs - Memoized
const BackgroundBlobs = React.memo(() => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-purple-300/40 dark:bg-purple-900/30 blur-[100px] animate-blob mix-blend-multiply dark:mix-blend-screen filter" />
    <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-input-primary/40 dark:bg-input-primary/20 blur-[100px] animate-blob animation-delay-2000 mix-blend-multiply dark:mix-blend-screen filter" />
    <div className="absolute bottom-[-20%] left-[20%] w-[50%] h-[50%] rounded-full bg-blue-300/40 dark:bg-blue-900/30 blur-[100px] animate-blob animation-delay-4000 mix-blend-multiply dark:mix-blend-screen filter" />
  </div>
));

// Generate static configuration for food items to prevent re-randomization on re-renders
const FOOD_ICONS = ['🍔', '🍜', '🍕', '🍣', '🍩', '🥐', '🍱', '🌮'];
const STATIC_FOOD_ITEMS = FOOD_ICONS.map((icon) => ({
  icon,
  style: {
    top: `${Math.random() * 100}%`,
    left: `${Math.random() * 100}%`,
    animationDuration: `${20 + Math.random() * 10}s`,
    animationDelay: `${Math.random() * 5}s`,
    opacity: 0.4
  } as React.CSSProperties
}));

// Internal component for floating food emojis - Memoized and using static data
const FloatingFood = React.memo(() => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 opacity-30">
      {STATIC_FOOD_ITEMS.map((item, i) => (
        <div
          key={i}
          className="absolute text-4xl animate-float select-none"
          style={item.style}
        >
          {item.icon}
        </div>
      ))}
    </div>
  );
});

export const InputView: React.FC<InputViewProps> = ({ onSearch, isLoading }) => {
  const { currentUser } = useAuth();
  const [displayLocation, setDisplayLocation] = useState('');
  const [hiddenCoords, setHiddenCoords] = useState<string | null>(null);
  const [keywords, setKeywords] = useState('');
  const [radius, setRadius] = useState('1km');
  const [selectedModel, setSelectedModel] = useState('gemini-3-pro-preview');
  const [selectedLanguage, setSelectedLanguage] = useState<Language>('zh-TW');
  const [isLocating, setIsLocating] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [showError, setShowError] = useState(false);

  const [history, setHistory] = useState<{ searchKeywords: string[], recommendedHistory: string[] }>({ searchKeywords: [], recommendedHistory: [] });

  // Mouse position for Card 3D Tilt effect only
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Calculate normalized position (-1 to 1)
      const x = (e.clientX / window.innerWidth - 0.5) * 2;
      const y = (e.clientY / window.innerHeight - 0.5) * 2;
      setMousePos({ x, y });
    };

    // Only add listener on non-touch devices to save performance
    if (window.matchMedia("(hover: hover)").matches) {
      window.addEventListener('mousemove', handleMouseMove);
    }

    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Fetch history
  useEffect(() => {
    if (currentUser) {
      getHistory().then(data => {
        if (data && (data.recommendedHistory.length > 0 || data.searchKeywords.length > 0)) {
          setHistory(data);
          console.log("History loaded:", data);
        }
      });
    }
  }, [currentUser]);

  // Helper to parse hidden coords string "lat, lng"
  const parseCoords = (coordsStr: string | null) => {
    if (!coordsStr) return { lat: undefined, lng: undefined };
    const [lat, lng] = coordsStr.split(',').map(s => parseFloat(s.trim()));
    return { lat, lng };
  };

  const getCommonParams = () => {
    const locationToSearch = hiddenCoords || displayLocation;
    const { lat, lng } = parseCoords(hiddenCoords);
    return {
      location: locationToSearch,
      keywords,
      userLat: lat,
      userLng: lng,
      radius,
      model: selectedModel,
      language: selectedLanguage
    };
  };

  const validateInput = (): boolean => {
    if (!displayLocation.trim()) {
      setShowError(true);
      alert(selectedLanguage === 'en' ? "Please enter a location" : "請輸入地點");
      return false;
    }
    return true;
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInput()) return;

    onSearch({
      ...getCommonParams(),
      mode: 'list',
    }, isDevMode);
  };

  const handleRandomSearch = () => {
    if (!validateInput()) return;

    onSearch({
      ...getCommonParams(),
      keywords: "",
      mode: 'random',
    }, isDevMode);
  };

  const handleLocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayLocation(e.target.value);
    setHiddenCoords(null);
    if (showError) setShowError(false);
  };

  const handleHistoryClick = (name: string) => {
    setKeywords(name);
    if (!validateInput()) return;

    onSearch({
      ...getCommonParams(),
      keywords: name,
      mode: 'list', // Switch to list first (App defaults to list), user can toggle map.
      // Alternatively, pass 'map' if supported. Let's use list for now as it shows the card.
    }, isDevMode);
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      alert("您的瀏覽器不支援地理定位");
      return;
    }
    setIsLocating(true);
    setShowError(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const coords = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        setHiddenCoords(coords);
        setDisplayLocation(selectedLanguage === 'en' ? "📍 Your Location" : "📍 您的目前位置");
        setIsLocating(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert(selectedLanguage === 'en' ? "Cannot retrieve location" : "無法獲取您的位置");
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const i18n = {
    'zh-TW': {
      title: '尋找您的下一頓美食',
      subtitle: '輸入地點，讓 AI 為您推薦最佳選擇',
      location: '地點',
      placeholderLoc: '輸入地標或地址',
      locate: '定位',
      keyword: '關鍵字 (選填)',
      placeholderKey: '例：拉麵、咖啡、氣氛好',
      radius: '距離範圍',
      aiModel: 'AI 模型',
      language: '語言',
      search: '開始搜尋',
      random: '隨機推薦 (完全沒想法？)',
      nearby: '附近'
    },
    'en': {
      title: 'Find Your Next Meal',
      subtitle: 'Enter a location, let AI recommend the best.',
      location: 'Location',
      placeholderLoc: 'Landmark or address',
      locate: 'Locate',
      keyword: 'Keywords (Optional)',
      placeholderKey: 'e.g., Ramen, Coffee, Cozy',
      radius: 'Radius',
      aiModel: 'AI Model',
      language: 'Language',
      search: 'Start Search',
      random: 'I\'m Feeling Lucky (Random)',
      nearby: 'Nearby'
    },
    'ja': {
      title: '次の食事を見つけよう',
      subtitle: '場所を入力して、AIにおすすめを聞く',
      location: '場所',
      placeholderLoc: 'ランドマークまたは住所',
      locate: '現在地',
      keyword: 'キーワード (任意)',
      placeholderKey: '例：ラーメン、コーヒー',
      radius: '距離',
      aiModel: 'AI モデル',
      language: '言語',
      search: '検索開始',
      random: 'お任せ (ランダム)',
      nearby: '近く'
    }
  };

  const t = i18n[selectedLanguage];

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-gray-50 dark:bg-[#0a0a0a] font-display transition-colors">

      {/* Background Layers - Static and Memoized */}
      <div className="absolute inset-0 pointer-events-none">
        <BackgroundBlobs />
      </div>

      <div className="absolute inset-0 pointer-events-none">
        <FloatingFood />
      </div>

      <div className="layout-container flex h-full grow flex-col justify-center items-center py-6 px-4 z-10">
        <div className="layout-content-container flex flex-col w-full max-w-lg">

          {/* Title Section - Static (Removed Parallax) */}
          <div className="flex flex-col items-center text-center mb-10 sm:mb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            <h1 className="text-4xl sm:text-5xl font-black leading-tight tracking-tighter bg-gradient-to-r from-green-600 via-emerald-500 to-teal-500 dark:from-green-400 dark:via-emerald-300 dark:to-teal-300 bg-clip-text text-transparent drop-shadow-sm">
              {t.title}
            </h1>
            <p className="mt-3 text-base sm:text-lg text-gray-600 dark:text-gray-300 font-medium">
              {t.subtitle}
            </p>
          </div>

          {/* Main Card with 3D Tilt */}
          <div
            className="relative backdrop-blur-xl bg-white/70 dark:bg-black/40 rounded-3xl shadow-2xl border border-white/50 dark:border-white/10 ring-1 ring-black/5 dark:ring-white/5 animate-in zoom-in-95 duration-500 transition-transform duration-100 ease-out will-change-transform"
            style={{
              transformStyle: 'preserve-3d',
              transform: `perspective(1000px) rotateX(${mousePos.y * -1.5}deg) rotateY(${mousePos.x * 1.5}deg)`
            }}
          >

            {/* Top Toolbar: Minimalist Capsule Style (Borderless) */}
            <div
              className="absolute -top-10 right-0 flex items-center gap-2 transition-transform duration-200"
              style={{ transform: `translateZ(20px)` }}
            >
              {/* Language Pill */}
              <div className="flex items-center bg-black/5 dark:bg-white/10 backdrop-blur-md rounded-full pl-2 pr-1 py-1 transition-all hover:bg-black/10 dark:hover:bg-white/20 hover:scale-105">
                <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 text-[14px] mr-1">language</span>
                <select
                  className="bg-transparent text-[11px] font-bold text-gray-600 dark:text-gray-300 cursor-pointer focus:outline-none appearance-none pr-2 border-none ring-0 p-0"
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value as Language)}
                  disabled={isLoading}
                >
                  <option value="zh-TW">繁體中文</option>
                  <option value="en">English</option>
                  <option value="ja">日本語</option>
                </select>
              </div>

              {/* Model Pill */}
              <div className="hidden sm:flex items-center bg-black/5 dark:bg-white/10 backdrop-blur-md rounded-full pl-2 pr-1 py-1 transition-all hover:bg-black/10 dark:hover:bg-white/20 hover:scale-105">
                <span className="material-symbols-outlined text-gray-500 dark:text-gray-400 text-[14px] mr-1">smart_toy</span>
                <select
                  className="bg-transparent text-[11px] font-bold text-gray-600 dark:text-gray-300 cursor-pointer focus:outline-none appearance-none pr-2 border-none ring-0 p-0"
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  disabled={isLoading}
                >
                  <option value="gemini-3-pro-preview">Gemini 3 Pro</option>
                </select>
              </div>

              {/* Dev Mode Pill */}
              <label className="flex items-center bg-black/5 dark:bg-white/10 backdrop-blur-md rounded-full px-2 py-1 cursor-pointer transition-all hover:bg-black/10 dark:hover:bg-white/20 hover:scale-105">
                <input
                  type="checkbox"
                  value=""
                  className="sr-only peer"
                  checked={isDevMode}
                  onChange={() => setIsDevMode(!isDevMode)}
                />
                <div className="relative w-6 h-3 bg-gray-300 peer-focus:outline-none rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[1px] after:left-[1px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-2.5 after:w-2.5 after:transition-all dark:border-gray-500 peer-checked:bg-input-primary"></div>
                <span className="ml-1.5 text-[10px] font-bold text-gray-600 dark:text-gray-300">DEV</span>
              </label>
            </div>

            <form onSubmit={handleSearch} className="flex flex-col gap-6 p-6 sm:p-8">

              {/* Location Input - Staggered entrance */}
              <div
                className="flex flex-col flex-1 group animate-in slide-in-from-bottom-2 fade-in duration-500 fill-mode-backwards"
                style={{ animationDelay: '100ms' }}
              >
                <p className={`text-sm font-bold leading-normal pb-1.5 transition-colors ${showError ? 'text-red-500' : 'text-gray-700 dark:text-gray-200'}`}>
                  {t.location} {showError && <span className="text-xs font-normal ml-1">({selectedLanguage === 'en' ? 'Required' : '必填'})</span>}
                </p>
                <div className={`flex w-full items-stretch rounded-xl shadow-sm transition-all duration-300 ring-1 ${showError ? 'ring-red-400 shadow-red-100' : 'ring-gray-200 dark:ring-white/10 focus-within:ring-2 focus-within:ring-input-primary focus-within:shadow-lg focus-within:shadow-input-primary/20'}`}>
                  <div className="relative flex-grow z-10">
                    <input
                      className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-l-xl bg-transparent h-12 px-4 text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none border-none focus:ring-0"
                      placeholder={t.placeholderLoc}
                      value={displayLocation}
                      onChange={handleLocationChange}
                      disabled={isLoading || isLocating}
                      required
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                      <span className={`material-symbols-outlined text-xl transition-colors ${showError ? 'text-red-400' : 'text-gray-400 group-focus-within:text-input-primary'}`}>location_on</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleUseCurrentLocation}
                    disabled={isLoading || isLocating}
                    className="relative inline-flex items-center justify-center gap-x-2 rounded-r-xl bg-gray-50 dark:bg-white/5 px-4 py-2 text-xs font-bold text-gray-600 dark:text-gray-300 border-l border-gray-200 dark:border-white/10 hover:bg-gray-100 dark:hover:bg-white/10 transition-colors whitespace-nowrap min-w-[50px] sm:min-w-[110px]"
                  >
                    {isLocating ? (
                      <span className="animate-spin h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full"></span>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">my_location</span>
                        <span className="hidden sm:inline">{t.locate}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Keywords Input - Staggered entrance */}
              <div
                className="flex flex-col w-full group animate-in slide-in-from-bottom-2 fade-in duration-500 fill-mode-backwards"
                style={{ animationDelay: '200ms' }}
              >
                <p className="text-sm font-bold leading-normal pb-1.5 text-gray-700 dark:text-gray-200">{t.keyword}</p>
                <div className="relative flex w-full items-center rounded-xl bg-transparent ring-1 ring-gray-200 dark:ring-white/10 shadow-sm focus-within:ring-2 focus-within:ring-input-primary focus-within:shadow-lg focus-within:shadow-input-primary/20 transition-all duration-300">
                  <input
                    className="flex w-full min-w-0 flex-1 bg-transparent h-12 px-4 text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none border-none focus:ring-0 rounded-xl"
                    placeholder={t.placeholderKey}
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                    disabled={isLoading}
                  />
                  <span className="pointer-events-none absolute right-3 text-gray-400 group-focus-within:text-input-primary material-symbols-outlined text-xl transition-colors">search</span>
                </div>
              </div>

              {/* Radius Select - Staggered entrance */}
              <div
                className="flex flex-col flex-1 animate-in slide-in-from-bottom-2 fade-in duration-500 fill-mode-backwards"
                style={{ animationDelay: '300ms' }}
              >
                <p className="text-sm font-bold leading-normal pb-1.5 text-gray-700 dark:text-gray-200">{t.radius}</p>
                <div className="relative group">
                  <select
                    className="appearance-none flex w-full min-w-0 flex-1 bg-transparent ring-1 ring-gray-200 dark:ring-white/10 shadow-sm focus:ring-2 focus:ring-input-primary focus:shadow-lg focus:shadow-input-primary/20 rounded-xl h-12 px-4 text-sm font-medium text-gray-900 dark:text-white pr-4 focus:outline-none border-none focus:ring-0 transition-all duration-300 cursor-pointer text-center"
                    value={radius}
                    onChange={(e) => setRadius(e.target.value)}
                    disabled={isLoading}
                  >
                    <option value="250m">250m</option>
                    <option value="1km">1km</option>
                    <option value="5km">5km</option>
                    <option value="10km">10km</option>
                    <option value="unlimited">{selectedLanguage === 'en' ? 'Unlimited' : '無限制'}</option>
                  </select>
                </div>
              </div>

              {/* Primary Search Button - Staggered entrance + Shimmer */}
              <div
                className="mt-2 animate-in slide-in-from-bottom-2 fade-in duration-500 fill-mode-backwards"
                style={{ animationDelay: '400ms' }}
              >
                <button
                  type="submit"
                  disabled={isLoading}
                  className="group relative flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-input-primary to-green-400 px-6 py-3.5 text-sm font-black text-white shadow-lg shadow-input-primary/30 transition-all hover:scale-[1.02] hover:shadow-input-primary/50 active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden"
                >
                  {/* Shimmer effect */}
                  <div className="absolute inset-0 -translate-x-full group-hover:animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/30 to-transparent z-10" />

                  <span className="relative z-10 flex items-center gap-2">
                    <span>{t.search}</span>
                    <span className="material-symbols-outlined text-lg font-bold group-hover:translate-x-1 transition-transform">arrow_forward</span>
                  </span>
                </button>
              </div>

              {/* Secondary Random Button - Staggered entrance */}
              <div
                className="relative flex py-1 items-center animate-in fade-in duration-500 fill-mode-backwards"
                style={{ animationDelay: '500ms' }}
              >
                <div className="flex-grow border-t border-gray-300/50 dark:border-white/10"></div>
                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-bold uppercase tracking-wider">or</span>
                <div className="flex-grow border-t border-gray-300/50 dark:border-white/10"></div>
              </div>

              <div
                className="animate-in slide-in-from-bottom-2 fade-in duration-500 fill-mode-backwards"
                style={{ animationDelay: '600ms' }}
              >
                <button
                  type="button"
                  onClick={handleRandomSearch}
                  disabled={isLoading}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-100 dark:bg-white/5 border border-transparent hover:border-gray-200 dark:hover:border-white/10 px-6 py-3 text-sm font-bold text-gray-600 dark:text-gray-300 transition-all hover:bg-gray-200 dark:hover:bg-white/10 active:scale-[0.98] disabled:opacity-70"
                >
                  <span className="material-symbols-outlined text-lg">casino</span>
                  <span>{t.random}</span>
                </button>
              </div>

            </form>
          </div>

          {/* History Section - Only visible if logged in and has history */}
          {history.recommendedHistory.length > 0 && (
            <div className="mt-8 mx-auto max-w-[90%] animate-in fade-in slide-in-from-bottom-4 duration-700 delay-700">
              <div className="bg-white/40 dark:bg-black/20 backdrop-blur-md rounded-2xl p-4 border border-white/30 dark:border-white/5">
                <p className="text-xs font-bold text-gray-500 dark:text-gray-400 mb-3 uppercase tracking-wider text-center flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined text-[14px]">history</span>
                  {selectedLanguage === 'en' ? 'Recently Recommended' : '最近推薦'}
                </p>
                <div className="flex flex-wrap justify-center gap-2">
                  {history.recommendedHistory.slice(-8).reverse().map((name, i) => (
                    <span
                      key={i}
                      onClick={() => handleHistoryClick(name)}
                      className="px-3 py-1 bg-white/60 dark:bg-white/5 rounded-full text-xs font-bold text-gray-700 dark:text-gray-300 border border-white/40 dark:border-white/5 shadow-sm hover:scale-105 transition-all cursor-pointer hover:bg-input-primary hover:text-white"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Styles for custom animations */}
      <style>{`
        @keyframes shimmer {
          100% {
            transform: translateX(100%);
          }
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
        .animation-delay-4000 {
          animation-delay: 4s;
        }
        @keyframes float {
          0% { transform: translateY(100vh) rotate(0deg); opacity: 0; }
          10% { opacity: 0.3; }
          90% { opacity: 0.3; }
          100% { transform: translateY(-10vh) rotate(360deg); opacity: 0; }
        }
        .animate-float {
          animation-name: float;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        .fill-mode-backwards {
            animation-fill-mode: backwards;
        }
      `}</style>
    </div>
  );
};