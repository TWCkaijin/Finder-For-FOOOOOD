import React, { useState, useEffect, useMemo } from 'react';
import { SearchParams } from '../types';
import { getTranslation, LanguageCode } from '../i18n';
import { getHistory, getPreferences } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface InputViewProps {
  onSearch: (params: SearchParams, isDevMode: boolean) => void;
  onHistoryClick: (keywords: string) => void;
  onGoToSettings: () => void; // Added based on the component destructuring
  isLoading: boolean;
  startWithLogoutAnimation?: boolean;
  currentLanguage?: LanguageCode;
  onLanguageChange?: (lang: LanguageCode) => void;
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

const HistoryBubbles = React.memo(({ items, phase, onSelect, title }: { items: string[], phase: 'hidden' | 'dropped' | 'sides', onSelect: (n: string) => void, title: string }) => {
  // Slots state: Fixed 20 slots. Each has text and visibility status.
  const [slots, setSlots] = useState<{ text: string, visible: boolean }[]>([]);

  // Initialize slots
  useEffect(() => {
    if (items.length === 0) return;
    // Take up to 6 items for initial slots (3 per side)
    const initialSlots = Array.from({ length: 6 }).map((_, i) => ({
      text: items[i % items.length],
      visible: i < items.length
    }));
    setSlots(initialSlots);
  }, [items]); // Only rebuild if items list radically changes

  // Rotation Logic
  const lastSideRef = React.useRef<'left' | 'right'>('right');
  const slotsRef = React.useRef(slots);

  useEffect(() => {
    slotsRef.current = slots;
  }, [slots]);

  useEffect(() => {
    if (phase !== 'sides' || items.length <= 6) return;

    let timeoutId: NodeJS.Timeout | null = null;

    const interval = setInterval(() => {
      const currentSlots = slotsRef.current;
      // Toggle side
      const targetSide = lastSideRef.current === 'left' ? 'right' : 'left';
      lastSideRef.current = targetSide;

      const availableIndices = currentSlots
        .map((_, i) => i)
        .filter(i => (targetSide === 'left' ? i % 2 === 0 : i % 2 !== 0));

      if (availableIndices.length === 0) return;

      const targetIdx = availableIndices[Math.floor(Math.random() * availableIndices.length)];

      // 1. Fade Out
      setSlots(prev => {
        const next = [...prev];
        if (!next[targetIdx]) return next; // Safety
        next[targetIdx] = { ...next[targetIdx], visible: false };
        return next;
      });

      // 2. Schedule Swap
      timeoutId = setTimeout(() => {
        setSlots(prev => {
          const next = [...prev];
          if (!next[targetIdx]) return next; // Safety

          const displayedSet = new Set(next.map(s => s.text));
          const candidates = items.filter(item => !displayedSet.has(item));

          let newItem;
          if (candidates.length > 0) {
            newItem = candidates[Math.floor(Math.random() * candidates.length)];
          } else {
            newItem = items[Math.floor(Math.random() * items.length)]; // Fallback
          }

          next[targetIdx] = { text: newItem, visible: true };
          return next;
        });
      }, 900);
    }, 5000);

    return () => {
      clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [phase, items]);

  if (items.length === 0 || phase === 'hidden') return null;

  return (
    <>
      {/* Desktop: Floating Interactive Bubbles */}
      <div className="hidden md:block">
        {slots.map((slot, i) => (
          slot.text && (
            <Bubble
              key={i} // Key is index: Slot is fixed position
              item={slot.text}
              index={i}
              total={6} // Fixed context for positioning
              phase={phase}
              isVisible={slot.visible}
              onClick={() => onSelect(slot.text)}
            />
          )
        ))}
      </div>

      {/* Mobile: Fixed Horizontal Scroll List */}
      <div className={`md:hidden fixed bottom-6 left-0 right-0 z-40 flex flex-col gap-2 transition-all duration-700 ${phase === 'sides' ? 'translate-y-0 opacity-100' : 'translate-y-10 opacity-0 pointer-events-none'}`}>
        <div className="flex items-center gap-2 px-6">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent"></div>
          <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{title}</span>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-700 to-transparent"></div>
        </div>

        <div className="flex gap-2 overflow-x-auto px-6 pb-4 pt-1 snap-x no-scrollbar">
          {items.map((item, idx) => (
            <button
              key={`${item}-${idx}`}
              onClick={() => onSelect(item)}
              className="snap-start flex-shrink-0 bg-white/90 dark:bg-zinc-800/90 backdrop-blur-md border border-gray-100 dark:border-white/10 px-5 py-2.5 rounded-2xl text-sm font-bold text-gray-700 dark:text-gray-200 shadow-[0_2px_8px_rgba(0,0,0,0.08)] active:scale-95 transition-all text-nowrap"
            >
              {item}
            </button>
          ))}
        </div>
      </div>
    </>
  );
});

const Bubble = React.memo(({ item, index, total, phase, isVisible, onClick }: any) => {
  const isDropped = phase === 'dropped';
  const isSides = phase === 'sides';

  // Deterministic "Randomness" based on index to ensure separation
  const { side, topPct, sideOffsetPct, duration, delay } = useMemo(() => {
    const side = index % 2 === 0 ? 'left' : 'right';

    // Calculate vertical slot: 3 per side
    const itemsPerSide = 3;
    const sideIndex = Math.floor(index / 2);

    // Constrained height distribution (20% to 80%) per user request
    const slotSize = 60 / itemsPerSide;

    // Base position starts at 20%
    const baseTop = 20 + (sideIndex * slotSize) + (Math.random() * (slotSize * 0.6));

    return {
      side,
      topPct: Math.min(Math.max(baseTop, 20), 80),
      // User wanted offset: use 2% - 8%
      sideOffsetPct: 10 + Math.random() * 6,
      duration: 5 + Math.random() * 5,
      delay: Math.random() * -5
    };
  }, [index]);

  // Scale Logic:
  // Dropped: 0.01
  // Invisible (Rotation): 0.01
  // Visible + Sides: 1
  const scale = (isSides && isVisible) ? 1 : 0.01;
  const opacity = (isSides && isVisible) ? 1 : 0;

  const style: React.CSSProperties = {
    top: isDropped ? '50%' : (isSides ? `${topPct}%` : '50%'),
    left: isDropped ? '50%' : (isSides ? (side === 'left' ? `${sideOffsetPct}%` : 'auto') : '50%'),
    right: isDropped ? 'auto' : (isSides ? (side === 'right' ? `${sideOffsetPct}%` : 'auto') : 'auto'),
    transform: isDropped
      ? 'translate(-50%, -50%) scale(0.01)'
      : `translateY(-50%) scale(${scale})`,
    opacity: opacity,

    pointerEvents: (isSides && isVisible) ? 'auto' : 'none',
    transformOrigin: 'center',

    // Explicit transitions to avoid 'all' causing issues with auto/fixed positioning
    transitionProperty: 'transform, opacity',
    transitionDuration: '0.8s',
    transitionTimingFunction: 'cubic-bezier(0.17, 0.67, 0.44, 1.03)',
    transitionDelay: (isSides && isVisible) ? `${index * 30}ms` : '0ms',

    maxWidth: '10rem',
    willChange: 'transform, opacity',
  };

  return (
    <div
      onClick={onClick}
      className="fixed cursor-pointer z-30 group"
      style={style}
    >
      <div
        className={`bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm px-3 py-2 rounded-2xl shadow-[0_4px_20px_rgb(0,0,0,0.08)] dark:shadow-[0_4px_20px_rgb(255,255,255,0.05)] border border-white/20 dark:border-white/10 text-xs font-bold text-gray-700 dark:text-gray-200 hover:scale-110 hover:bg-input-primary hover:text-white transition-all duration-300 flex items-center justify-center gap-1 text-center whitespace-normal break-words leading-tight min-h-[2.5rem] ${isSides ? 'animate-float-bubble' : ''}`}
        style={{
          animationDuration: `${duration}s`,
          animationDelay: `${delay}s`
        }}
      >
        {item}
      </div>
    </div>
  );
}, (prev, next) => {
  return prev.item === next.item &&
    prev.phase === next.phase &&
    prev.isVisible === next.isVisible &&
    prev.index === next.index;
});

const INTRO_ICONS = ['🍔', '🍕', '🍜', '🍣', '🍩', '🍦', '☕️', '🍱', '🌭', '🍗', '🥞', '🥗'];

export const InputView: React.FC<InputViewProps> = ({
  onSearch,
  onGoToSettings,
  onHistoryClick,
  isLoading,
  startWithLogoutAnimation,
  currentLanguage,
  onLanguageChange
}) => {
  const { currentUser, signInWithGoogle, loading: authLoading } = useAuth();
  const [displayLocation, setDisplayLocation] = useState('');
  const [hiddenCoords, setHiddenCoords] = useState<string | null>(null);
  const [keywords, setKeywords] = useState('');
  const [radius, setRadius] = useState('1km');
  const [introIconIndex, setIntroIconIndex] = useState(() => Math.floor(Math.random() * INTRO_ICONS.length));


  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>(currentLanguage || 'zh-TW');
  const [isLocating, setIsLocating] = useState(false);
  const [isDevMode, setIsDevMode] = useState(false);
  const [showError, setShowError] = useState(false);

  // Intro Animation State
  const [isIntro, setIsIntro] = useState(true);
  const [isAnimatingOut, setIsAnimatingOut] = useState(startWithLogoutAnimation);
  const [isEntering, setIsEntering] = useState(false); // User clicked enter, waiting for conditions
  const [isHistoryReady, setIsHistoryReady] = useState(false);

  const [history, setHistory] = useState<{ searchKeywords: string[], recommendedHistory: string[] }>({ searchKeywords: [], recommendedHistory: [] });
  const [removeHistory, setRemoveHistory] = useState(false);
  const [bubblePhase, setBubblePhase] = useState<'hidden' | 'dropped' | 'sides'>('hidden');

  // Rotate Intro Icon
  useEffect(() => {
    if (!isIntro || isEntering || isAnimatingOut) return;
    const interval = setInterval(() => {
      setIntroIconIndex(prev => (prev + 1) % INTRO_ICONS.length);
    }, 1500);
    return () => clearInterval(interval);
  }, [isIntro, isEntering, isAnimatingOut]);

  // Sync selectedLanguage with currentLanguage prop
  useEffect(() => {
    if (currentLanguage) {
      setSelectedLanguage(currentLanguage);
    }
  }, [currentLanguage]);

  // Handle Start with Logout Animation
  useEffect(() => {
    if (startWithLogoutAnimation) {
      setIsAnimatingOut(true); // We start with isAnimatingOut = true (from state init).
      // Now schedule the collapse to normal state.
      // This creates the "Implode" effect (Scale 5 -> Scale 1).
      const t = setTimeout(() => {
        setIsAnimatingOut(false);
      }, 50); // Short delay to ensure browser renders the initial frame
      return () => clearTimeout(t);
    }
  }, [startWithLogoutAnimation]);

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

  // Auto Geolocate on Mount
  useEffect(() => {
    // Only auto-locate if location is empty and not already locating
    if (!displayLocation && !hiddenCoords && !isLocating) {
      handleUseCurrentLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount

  // Fetch history & Manage Ready State
  useEffect(() => {
    if (currentUser) {
      setIsHistoryReady(false); // Reset readiness when user changes/reloads
      getHistory().then(data => {
        if (data && (data.recommendedHistory.length > 0 || data.searchKeywords.length > 0)) {
          setHistory(data);
          console.log("History loaded:", data);
        }
        setIsHistoryReady(true);
      }).catch(err => {
        console.error("History fetch error:", err);
        setIsHistoryReady(true);
      });

      // Load Preferences
      getPreferences().then(data => {
        if (data?.preferences) {
          if (data.preferences.language) {
            const lang = data.preferences.language as LanguageCode;
            setSelectedLanguage(lang);
            if (onLanguageChange) onLanguageChange(lang);
          }
          if (data.preferences.defaultModel) setSelectedModel(data.preferences.defaultModel);
          if (data.preferences.devMode !== undefined) setIsDevMode(data.preferences.devMode);
        }
      }).catch(console.error);
    } else {
      // If no user, we are "ready" (nothing to load)
      // But for the purpose of the Intro flow, if we require login, we wait for user.
      // However, this effect runs on mount too.
      setIsHistoryReady(true);
    }
  }, [currentUser]);

  // Handle Intro Transition Trigger
  useEffect(() => {
    if (isEntering && currentUser && isHistoryReady) {
      // All conditions met: Animate out
      performExitAnimation();
    }
  }, [isEntering, currentUser, isHistoryReady]);

  const performExitAnimation = () => {
    setIsAnimatingOut(true);
    // Wait for animation frame or short delay to allow "opening" feel
    setTimeout(() => {
      setIsIntro(false);
      setIsEntering(false);
      // Trigger auto-locate if needed
      if (!displayLocation && !hiddenCoords && !isLocating) {
        handleUseCurrentLocation();
      }
    }, 600); // Scale animation duration
  };

  // Handle Bubble Animation
  useEffect(() => {
    // Only start bubbles when intro is done (and expanding)
    if (!isIntro && history.recommendedHistory.length > 0) {
      setBubblePhase('dropped'); // Start at center (but hidden/small)
      // Rapidly transition to sides to create "fly out" effect without lingering
      const t = setTimeout(() => setBubblePhase('sides'), 100);
      return () => clearTimeout(t);
    }
  }, [history.recommendedHistory, isIntro]);

  const handleIntroComplete = async () => {
    if (isEntering) return;

    setIsEntering(true);

    if (!currentUser) {
      try {
        await signInWithGoogle();
        // Wait for auth state change & history effect to trigger exit
      } catch (e) {
        console.error("Login failed", e);
        setIsEntering(false); // Reset allows retry
      }
    } else {
      // Already logged in.
      // If history is ready, effect will pick it up immediately.
      // If history is loading, effect will pick it up when ready.
    }
  };

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
      language: selectedLanguage,
      excludedNames: removeHistory ? history.recommendedHistory : []
    };
  };

  const validateInput = (): boolean => {
    if (!displayLocation.trim()) {
      setShowError(true);
      alert(t.input.required);
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
      alert("Browser does not support geolocation");
      return;
    }
    setIsLocating(true);
    setShowError(false);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const coords = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
        setHiddenCoords(coords);
        setDisplayLocation(t.input.yourLocation);
        setIsLocating(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        alert(t.input.cannotRetrieve);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  // Handle Logout / Auth Expiry - Trigger Reverse Animation
  useEffect(() => {
    // Only trigger if we were previously logged in (isIntro is false)
    if (!authLoading && !currentUser && !isIntro) {
      // 1. Re-enable Intro Overlay (It starts in 'exploded' state because isAnimatingOut is true)
      setIsIntro(true);
      setBubblePhase('hidden');

      // 2. Trigger the collapse animation (Exploded -> Normal)
      setTimeout(() => {
        setIsAnimatingOut(false);
        setIsEntering(false);
      }, 50);
    }
  }, [currentUser, isIntro, authLoading]);

  const t = getTranslation(selectedLanguage);

  return (
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-gray-50 dark:bg-[#0a0a0a] font-display transition-colors animate-in fade-in zoom-in-95 duration-1000">

      {/* Background Layers - Static and Memoized */}
      <div className="absolute inset-0 pointer-events-none">
        <BackgroundBlobs />
      </div>

      <div className="absolute inset-0 pointer-events-none">
        <FloatingFood />
      </div>

      {/* Giant Background Title "FOOOOD" */}
      <div className={`absolute inset-0 flex items-center justify-center overflow-hidden pointer-events-none transition-all duration-1000 ${isIntro ? 'opacity-100 scale-100' : 'opacity-0 scale-150'}`}>
        <span className="text-[20vw] font-black leading-none text-gray-900/5 dark:text-white/5 tracking-tighter select-none">
          FOOOOD
        </span>
      </div>

      <div className="layout-container flex h-full grow flex-col justify-center items-center py-6 px-4 z-10">
        <div className="layout-content-container flex flex-col w-full max-w-lg relative z-50">

          {/* Intro Overlay */}
          {isIntro && (
            <div
              className={`absolute inset-0 flex flex-col items-center justify-center z-50 transition-all duration-700 ease-[cubic-bezier(0.76,0,0.24,1)] ${isAnimatingOut ? 'opacity-0 scale-[5] pointer-events-none' : 'opacity-100 scale-100'}`}
            >
              <div
                onClick={handleIntroComplete}
                className="cursor-pointer group relative flex flex-col items-center justify-center"
              >
                <div className="text-[100px] sm:text-[150px] leading-none filter drop-shadow-2xl group-hover:scale-110 transition-transform duration-300 animate-bounce-slow animate-in zoom-in duration-1000">
                  {INTRO_ICONS[introIconIndex]}
                </div>
                <button
                  disabled={isEntering}
                  className="mt-8 px-8 py-3 bg-white/90 dark:bg-black/80 backdrop-blur-md rounded-full font-black text-lg shadow-xl ring-4 ring-white/30 dark:ring-white/10 group-hover:ring-input-primary/50 transition-all hover:scale-105 active:scale-95 text-gray-800 dark:text-white flex items-center gap-2 disabled:opacity-80 disabled:cursor-wait"
                >
                  {isEntering ? (
                    <>
                      <span className="animate-spin h-5 w-5 border-2 border-current border-t-transparent rounded-full"></span>
                      <span>{t.input.loading}</span>
                    </>
                  ) : (
                    currentUser ? t.input.enter : t.input.loginToStart
                  )}
                </button>
                <p className="mt-4 text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                  {currentUser ? t.input.welcomeBack : t.input.loginToSync}
                </p>
              </div>
            </div>
          )}

          {/* Main Content - Scaled down during intro or loading */}
          <div className={`transition-all duration-1000 ease-[cubic-bezier(0.76,0,0.24,1)] origin-center ${(isIntro || isLoading) ? (isIntro ? 'scale-0 opacity-0 blur-xl' : 'scale-95 opacity-0 blur-md pointer-events-none') : 'scale-100 opacity-100 blur-0'}`}>

            {/* Title Section - Static (Removed Parallax) */}
            <div className="flex flex-col items-center text-center mb-10 sm:mb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <h1 className="flex items-center justify-center gap-3 text-4xl sm:text-5xl font-black leading-tight tracking-tighter drop-shadow-sm">
                <span className="filter drop-shadow-md">{INTRO_ICONS[introIconIndex]}</span>
                <span className="bg-gradient-to-r from-green-600 via-emerald-500 to-teal-500 dark:from-green-400 dark:via-emerald-300 dark:to-teal-300 bg-clip-text text-transparent">
                  {t.app.title}
                </span>
              </h1>
              <p className="mt-3 text-base sm:text-lg text-gray-600 dark:text-gray-300 font-medium">
                {t.app.subtitle}
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



              </div>

              <form onSubmit={handleSearch} className="flex flex-col gap-6 p-6 sm:p-8">

                {/* Location Input - Staggered entrance */}
                <div
                  className="flex flex-col flex-1 group animate-in slide-in-from-bottom-2 fade-in duration-500 fill-mode-backwards"
                  style={{ animationDelay: '100ms' }}
                >
                  <p className={`text-sm font-bold leading-normal pb-1.5 transition-colors ${showError ? 'text-red-500' : 'text-gray-700 dark:text-gray-200'}`}>
                    {t.input.location} {showError && <span className="text-xs font-normal ml-1">({t.input.required})</span>}
                  </p>
                  <div className={`flex w-full items-stretch rounded-xl shadow-sm transition-all duration-300 ring-1 ${showError ? 'ring-red-400 shadow-red-100' : 'ring-gray-200 dark:ring-white/10 focus-within:ring-2 focus-within:ring-input-primary focus-within:shadow-lg focus-within:shadow-input-primary/20'}`}>
                    <div className="relative flex-grow z-10">
                      <input
                        className="flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-l-xl bg-transparent h-12 px-4 text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none border-none focus:ring-0"
                        placeholder={t.input.placeholderLoc}
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
                          <span className="hidden sm:inline">{t.input.locate}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Keywords Input - Staggered entrance */}
                <div
                  style={{ animationDelay: '200ms' }}
                >
                  <div className="flex justify-between items-center pb-1.5">
                    <p className="text-sm font-bold leading-normal text-gray-700 dark:text-gray-200">{t.input.keyword}</p>
                    <label className="flex items-center cursor-pointer gap-2 group/toggle">
                      <span className="text-xs font-medium text-gray-400 group-hover/toggle:text-input-primary transition-colors duration-300">
                        {t.input.removeHistory}
                      </span>
                      <div className="relative">
                        <input
                          type="checkbox"
                          className="sr-only peer"
                          checked={removeHistory}
                          onChange={(e) => setRemoveHistory(e.target.checked)}
                        />
                        <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-input-primary"></div>
                      </div>
                    </label>
                  </div>
                  <div className="relative flex w-full items-center rounded-xl bg-transparent ring-1 ring-gray-200 dark:ring-white/10 shadow-sm focus-within:ring-2 focus-within:ring-input-primary focus-within:shadow-lg focus-within:shadow-input-primary/20 transition-all duration-300">
                    <input
                      className="flex w-full min-w-0 flex-1 bg-transparent h-12 px-4 text-sm font-medium text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none border-none focus:ring-0 rounded-xl"
                      placeholder={t.input.placeholderKey}
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
                  <p className="text-sm font-bold leading-normal pb-1.5 text-gray-700 dark:text-gray-200">{t.input.radius}</p>
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
                      <option value="unlimited">{t.input.unlimited}</option>
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
                      <span>{t.input.search}</span>
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
                    <span>{t.input.random}</span>
                  </button>
                </div>

              </form>
            </div>

          </div>
        </div>

        {/* History Bubbles - Moved to root to ensure viewport-relative fixed positioning */}
        <HistoryBubbles
          items={history.recommendedHistory}
          phase={isLoading ? 'hidden' : bubblePhase}
          onSelect={handleHistoryClick}
          title={t.input.historyTitle}
        />

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
        @keyframes floatBubble {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        .animate-float-bubble {
          animation: floatBubble 4s ease-in-out infinite;
        }
        .animate-bounce-slow {
          animation: bounce 3s infinite;
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(-5%); animation-timing-function: cubic-bezier(0.8,0,1,1); }
          50% { transform: translateY(0); animation-timing-function: cubic-bezier(0,0,0.2,1); }
        }
        .fill-mode-backwards {
            animation-fill-mode: backwards;
        }
      `}</style>
      </div>
    </div>
  );
};