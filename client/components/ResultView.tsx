import React, { useEffect, useRef, useState } from 'react';
import { Restaurant, SearchParams } from '../types';
import { getPreferences, savePreferences } from '../services/api';
import { useAuth } from '../contexts/AuthContext';

// Leaflet types hack
declare global {
  interface Window {
    L: any;
  }
}

interface ResultViewProps {
  restaurants: Restaurant[];
  params: SearchParams;
  onBack: () => void;
  onNext: () => void;
  isExhausted: boolean;
  isBackgroundFetching: boolean;
}

export const ResultView: React.FC<ResultViewProps> = ({
  restaurants,
  params,
  onBack,
  onNext,
  isExhausted,
  isBackgroundFetching
}) => {
  const isRandomMode = params.mode === 'random';
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routingControlRef = useRef<any>(null);
  const { currentUser } = useAuth();
  const [checkinLoading, setCheckinLoading] = useState(false);

  // Check-in Handler
  const handleVisit = async (r: Restaurant) => {
    if (!currentUser) {
      alert("Please log in to track visits.");
      return;
    }
    setCheckinLoading(true);
    try {
      const data = await getPreferences();
      const prefs = data?.preferences || {};
      const pending = prefs.pendingReviews || [];

      // Avoid duplicates
      if (!pending.some((p: any) => p.id === r.id)) {
        pending.push({ id: r.id, name: r.name, timestamp: Date.now() });
        await savePreferences({ preferences: { ...prefs, pendingReviews: pending } });
        alert(params.language === 'en' ? "Added to Pending Reviews!" : "已加入待評分清單！");
      } else {
        alert(params.language === 'en' ? "Already check-in pending." : "已經在清單中了");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setCheckinLoading(false);
    }
  };

  // Carousel State for Random Mode
  const [currentCardIndex, setCurrentCardIndex] = useState(0);

  // Modal State
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalRestaurant, setModalRestaurant] = useState<Restaurant | null>(null);

  // Sync selectedId with Carousel Index in Random Mode
  useEffect(() => {
    if (isRandomMode && restaurants[currentCardIndex]) {
      setSelectedId(restaurants[currentCardIndex].id);
    }
  }, [isRandomMode, currentCardIndex, restaurants]);

  // Handle Carousel Next logic
  const handleCarouselNext = () => {
    if (currentCardIndex < restaurants.length - 1) {
      setCurrentCardIndex(prev => prev + 1);
    } else {
      // At the end, load more
      onNext();
      // If items are added immediately (not async here), effect will catch up.
      // But usually it takes a moment. Ideally, we just call onNext. 
      // User clicks again to see new ones or we auto-advance? 
      // Let's rely on user clicking next again after data arrives, or auto move if data length changes.
    }
  };

  const handleCarouselPrev = () => {
    if (currentCardIndex > 0) {
      setCurrentCardIndex(prev => prev - 1);
    }
  };

  // Map Initialization
  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    if (!mapInstance.current) {
      const initialLat = params.userLat || restaurants[0]?.lat || 25.0330;
      const initialLng = params.userLng || restaurants[0]?.lng || 121.5654;

      mapInstance.current = window.L.map(mapRef.current).setView([initialLat, initialLng], 14);

      window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19
      }).addTo(mapInstance.current);
    }
  }, [params.userLat, params.userLng]);

  // Update Markers & Routing
  useEffect(() => {
    if (!mapInstance.current || !window.L) return;

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    const group = window.L.featureGroup();

    // User Marker
    if (params.userLat && params.userLng) {
      const userIcon = window.L.divIcon({ className: 'user-pin', iconSize: [16, 16] });
      const userMarker = window.L.marker([params.userLat, params.userLng], { icon: userIcon })
        .bindPopup("您的位置")
        .addTo(mapInstance.current);
      markersRef.current.push(userMarker);
      group.addLayer(userMarker);
    }

    // Restaurant Markers
    restaurants.forEach((r, idx) => {
      if (r.lat && r.lng) {
        const isSelected = r.id === selectedId;
        const color = isSelected ? '#D32F2F' : '#FF6B6B';
        const zIndex = isSelected ? 1000 : 0;

        const iconHtml = `
          <div style="position: relative; width: 24px; height: 24px;">
            <div style="background-color: ${color}; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 11px; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3); transform: ${isSelected ? 'scale(1.2)' : 'scale(1)'}; transition: all 0.2s ease; position: relative; z-index: 10;">
              ${idx + 1}
            </div>
            <div style="position: absolute; top: 26px; left: 50%; transform: translateX(-50%); background-color: rgba(255, 255, 255, 0.95); backdrop-filter: blur(4px); color: #333; padding: 2px 6px; border-radius: 6px; font-size: 10px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.2); white-space: nowrap; border: 1px solid rgba(0,0,0,0.1); z-index: 0; pointer-events: none;">
              ${r.name}
            </div>
          </div>
        `;
        const icon = window.L.divIcon({ className: 'custom-pin', html: iconHtml, iconSize: [24, 24], iconAnchor: [12, 12] });
        const marker = window.L.marker([r.lat, r.lng], { icon, zIndexOffset: zIndex })
          .bindPopup(`<b>${r.name}</b>`)
          .on('click', () => {
            setSelectedId(r.id);
            // In random mode, clicking a pin should probably jump carousel to that index?
            if (isRandomMode) {
              setCurrentCardIndex(idx);
            } else {
              setModalRestaurant(r);
            }
          })
          .addTo(mapInstance.current);
        markersRef.current.push(marker);
        group.addLayer(marker);
      }
    });

    if (markersRef.current.length > 0 && !selectedId) {
      mapInstance.current.fitBounds(group.getBounds(), { padding: [100, 100] });
    }

    // Routing Logic
    if (routingControlRef.current) {
      mapInstance.current.removeControl(routingControlRef.current);
      routingControlRef.current = null;
    }
    const targetRestaurant = selectedId ? restaurants.find(r => r.id === selectedId) : null;

    if (params.userLat && params.userLng && targetRestaurant?.lat && targetRestaurant?.lng && window.L.Routing) {
      try {
        routingControlRef.current = window.L.Routing.control({
          waypoints: [
            window.L.latLng(params.userLat, params.userLng),
            window.L.latLng(targetRestaurant.lat, targetRestaurant.lng)
          ],
          router: window.L.Routing.osrmv1({ serviceUrl: 'https://router.project-osrm.org/route/v1' }),
          lineOptions: { styles: [{ color: '#4A90E2', opacity: 0.7, weight: 5 }] },
          addWaypoints: false,
          draggableWaypoints: false,
          fitSelectedRoutes: false,
          showAlternatives: false,
          createMarker: () => null
        })
          .on('routesfound', (e: any) => {
            const routes = e.routes;
            const line = window.L.polyline(routes[0].coordinates);
            mapInstance.current.fitBounds(line.getBounds(), { padding: [100, 100] });
          })
          .addTo(mapInstance.current);
      } catch (e) { console.warn("Routing error", e); }
    }
  }, [restaurants, selectedId, params.userLat, params.userLng, isRandomMode]);

  // Coordinate display string
  const coordsDisplay = params.userLat && params.userLng
    ? `${params.userLat.toFixed(4)}, ${params.userLng.toFixed(4)}`
    : (restaurants[0]?.lat ? `${restaurants[0].lat.toFixed(4)}, ${restaurants[0].lng.toFixed(4)}` : "未知座標");

  // Helper for Random Mode Carousel Card
  const currentRestaurant = restaurants[currentCardIndex];

  return (
    <div className="flex flex-col h-screen bg-result-bg-light dark:bg-result-bg-dark text-result-text-light dark:text-white font-display overflow-hidden relative">

      {/* Detail Modal (Shared) */}
      {modalRestaurant && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-gray-800 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="relative p-6 border-b border-gray-100 dark:border-gray-700">
              <button
                onClick={() => setModalRestaurant(null)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
              <h2 className="text-2xl font-black text-gray-900 dark:text-white pr-8 leading-tight">
                {modalRestaurant.name}
              </h2>
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                <span className="flex items-center text-orange-500 font-bold">
                  {modalRestaurant.rating} <span className="material-symbols-outlined text-sm fill-1 ml-0.5">star</span>
                </span>
                <span>•</span>
                <span>{modalRestaurant.priceLevel}</span>
                <span>•</span>
                <span className="text-green-600 dark:text-green-400 font-medium">{modalRestaurant.isOpen ? "營業中" : "休息中"}</span>
              </div>
            </div>

            <div className="overflow-y-auto p-6 space-y-6">
              {/* Description */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl">
                <h3 className="text-sm font-bold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg">info</span> 餐廳介紹
                </h3>
                <p className="text-gray-700 dark:text-gray-200 text-sm leading-relaxed">
                  {modalRestaurant.description}
                </p>
              </div>

              {/* Recommended Dishes */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-lg text-result-primary">restaurant_menu</span>
                  必點推薦
                </h3>
                <div className="flex flex-wrap gap-2">
                  {modalRestaurant.recommendedDishes.map((dish, i) => (
                    <span key={i} className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 text-sm rounded-lg font-medium border border-gray-200 dark:border-gray-600">
                      👍 {dish}
                    </span>
                  ))}
                </div>
              </div>

              {/* Address & Navigation */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-2">地址</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">{modalRestaurant.address}</p>
                <div className="flex gap-2">
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(modalRestaurant.name + " " + modalRestaurant.address)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 flex items-center justify-center gap-2 bg-result-primary text-white py-3 rounded-xl font-bold shadow hover:bg-red-500 transition-colors"
                  >
                    <span className="material-symbols-outlined">directions</span>
                    Google Maps
                  </a>
                  <button
                    onClick={() => handleVisit(modalRestaurant)}
                    disabled={checkinLoading}
                    className="px-6 flex items-center justify-center gap-2 bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-3 rounded-xl font-bold shadow hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {checkinLoading ? (
                      <span className="material-symbols-outlined animate-spin">sync</span>
                    ) : (
                      <span className="material-symbols-outlined">storefront</span>
                    )}
                    <span className="hidden sm:inline">{params.language === 'en' ? 'Check In' : '前往該餐廳'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="flex items-center justify-between border-b border-black/10 dark:border-white/10 px-4 py-2 bg-white dark:bg-result-bg-dark shadow-sm z-10 shrink-0 h-14">
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1 cursor-pointer text-gray-500 hover:text-gray-800" onClick={onBack}>
            <span className="material-symbols-outlined text-2xl">arrow_back</span>
          </button>
          <div className="flex flex-col">
            <h2 className="text-base font-bold leading-tight">
              {params.location} {isRandomMode ? "(隨機推薦)" : ""}
            </h2>
          </div>
        </div>
      </header>

      <main className="flex-grow grid grid-cols-1 md:grid-cols-12 overflow-hidden">
        {/* Left Sidebar */}
        <div className="md:col-span-4 lg:col-span-4 xl:col-span-3 flex flex-col h-full overflow-hidden border-r border-black/10 dark:border-white/10 bg-white dark:bg-result-bg-dark z-0 relative">

          {/* Top Info Bar (Coordinates) */}
          <div className="bg-gray-50 dark:bg-black/20 px-4 py-2 text-xs font-mono text-gray-500 border-b border-gray-100 dark:border-white/5 flex items-center justify-between">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">radar</span>
              {coordsDisplay}
            </span>
            <span>{restaurants.length} results</span>
          </div>

          {/* Content Area: Random Mode vs List Mode */}
          {isRandomMode ? (
            // --- Random Mode Carousel UI ---
            <div className="flex-grow flex flex-col relative overflow-hidden bg-gray-50 dark:bg-black/10">

              {/* Card Container */}
              <div className="flex-grow flex items-center justify-center p-4">
                {currentRestaurant ? (
                  <div className="w-full h-full max-h-[500px] flex flex-col bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden relative">

                    {/* Card Badge */}
                    <div className="absolute top-4 left-4 z-10 bg-result-primary text-white text-xs font-bold px-2 py-1 rounded shadow">
                      推薦 #{currentCardIndex + 1}
                    </div>

                    {/* Card Header Pattern */}
                    <div className="h-24 bg-gradient-to-r from-result-primary to-orange-400 opacity-90 shrink-0 flex items-end p-4">
                      <h3 className="text-2xl font-black text-white drop-shadow-md leading-none truncate w-full">
                        {currentRestaurant.name}
                      </h3>
                    </div>

                    {/* Card Body */}
                    <div className="p-6 flex flex-col flex-grow overflow-y-auto">
                      <div className="flex items-center gap-2 mb-4">
                        <span className="text-xl font-bold text-orange-500 flex items-center">
                          {currentRestaurant.rating} <span className="material-symbols-outlined text-lg fill-1 ml-1">star</span>
                        </span>
                        <span className="text-gray-300">|</span>
                        <span className="text-gray-600 dark:text-gray-300 font-medium">{currentRestaurant.priceLevel}</span>
                      </div>

                      <p className="text-gray-600 dark:text-gray-300 text-sm leading-relaxed mb-4 flex-grow">
                        {currentRestaurant.description}
                      </p>

                      <div className="flex flex-wrap gap-2 mb-6">
                        {currentRestaurant.tags.map(t => (
                          <span key={t} className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-1 rounded">#{t}</span>
                        ))}
                      </div>

                      <button
                        onClick={() => setModalRestaurant(currentRestaurant)}
                        className="w-full py-3 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-xl font-bold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
                      >
                        <span className="material-symbols-outlined text-sm">visibility</span>
                        查看詳情
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center text-gray-400">
                    <span className="material-symbols-outlined text-4xl mb-2">search_off</span>
                    <p>暫無資料</p>
                  </div>
                )}
              </div>

              {/* Carousel Controls */}
              <div className="p-4 flex items-center justify-between bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
                <button
                  onClick={handleCarouselPrev}
                  disabled={currentCardIndex === 0}
                  className="w-12 h-12 rounded-full flex items-center justify-center border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                  <span className="material-symbols-outlined">arrow_back</span>
                </button>

                <div className="flex gap-1">
                  {restaurants.map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-1.5 h-1.5 rounded-full transition-all ${idx === currentCardIndex ? 'bg-result-primary w-4' : 'bg-gray-300 dark:bg-gray-600'}`}
                    />
                  )).slice(0, 10)}
                  {restaurants.length > 10 && <span className="text-xs text-gray-400 ml-1">...</span>}
                </div>

                <button
                  onClick={handleCarouselNext}
                  disabled={isBackgroundFetching && currentCardIndex >= restaurants.length - 1}
                  className={`h-12 px-6 rounded-full flex items-center justify-center gap-2 font-bold transition-all shadow-sm ${currentCardIndex === restaurants.length - 1
                    ? 'bg-result-primary text-white hover:bg-red-500' // "Fetch More" style
                    : 'border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800' // "Next" style
                    }`}
                >
                  {currentCardIndex === restaurants.length - 1 ? (
                    isBackgroundFetching ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-lg">sync</span>
                        <span className="text-sm">尋找中...</span>
                      </>
                    ) : (
                      <>
                        <span className="text-sm">尋找更多</span>
                        <span className="material-symbols-outlined text-lg">arrow_forward</span>
                      </>
                    )
                  ) : (
                    <span className="material-symbols-outlined">arrow_forward</span>
                  )}
                </button>
              </div>
            </div>
          ) : (
            // --- List Mode UI (Existing) ---
            <div className="flex-grow overflow-y-auto p-3 space-y-3">
              {restaurants.length === 0 ? (
                <div className="text-center p-8 opacity-60">
                  <p>暫無資料</p>
                </div>
              ) : (
                restaurants.map((item, index) => {
                  const isSelected = item.id === selectedId;
                  return (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedId(item.id);
                      }}
                      className={`group flex flex-col p-4 bg-white dark:bg-white/5 rounded-lg border shadow-sm hover:shadow-md transition-all cursor-pointer ${isSelected ? 'border-result-primary ring-1 ring-result-primary' : 'border-gray-100 dark:border-white/5 hover:border-result-primary'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-base text-gray-900 dark:text-white flex-1 pr-2">
                          <span className="text-result-primary mr-2">{index + 1}.</span>
                          {item.name}
                        </h3>
                        <span className="shrink-0 text-xs font-bold px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                          {item.rating} ★
                        </span>
                      </div>

                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2 line-clamp-2 leading-relaxed">
                        {item.description}
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs mt-auto">
                        <span className="font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-white/10 px-1.5 py-0.5 rounded border border-gray-200 dark:border-white/10">{item.priceLevel}</span>
                        {item.tags.map(t => (
                          <span key={t} className="text-gray-500 dark:text-gray-500">#{t}</span>
                        ))}
                      </div>

                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedId(item.id);
                          setModalRestaurant(item);
                        }}
                        className="mt-3 pt-3 border-t border-gray-100 dark:border-white/5 flex items-center text-xs text-result-primary font-bold hover:bg-result-primary/5 rounded px-2 -mx-2 transition-colors"
                      >
                        <span className="material-symbols-outlined text-[16px] mr-1">visibility</span>
                        點擊查看詳情與菜單
                      </div>
                    </div>
                  )
                })
              )}

              {/* Footer Action */}
              <div className="pt-2 pb-6">
                {isExhausted && !isBackgroundFetching ? (
                  <div className="text-center p-2 rounded bg-gray-50 dark:bg-white/5">
                    <p className="text-xs opacity-70">已無更多店家</p>
                  </div>
                ) : (
                  <button
                    onClick={onNext}
                    disabled={isBackgroundFetching && restaurants.length >= 6 && restaurants.length < 15}
                    className="w-full py-3 rounded-lg bg-white border-2 border-result-primary text-result-primary hover:bg-result-primary hover:text-white text-sm font-bold shadow-sm active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-wait"
                  >
                    {isBackgroundFetching ? (
                      <>
                        <span className="material-symbols-outlined text-lg animate-spin">sync</span>
                        正在搜尋更多店家...
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-lg">add_circle</span>
                        顯示更多店家
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Right Map */}
        <div className="hidden md:block md:col-span-8 lg:col-span-8 xl:col-span-9 h-full w-full bg-gray-100 relative">
          <div ref={mapRef} className="absolute inset-0 z-0" />
          <div className="absolute bottom-4 left-4 z-[400] pointer-events-none flex flex-col gap-2">
            {params.userLat && (
              <div className="bg-blue-600/90 text-white backdrop-blur px-3 py-1.5 rounded-md shadow text-xs font-bold">
                點選店家可預覽路徑
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};