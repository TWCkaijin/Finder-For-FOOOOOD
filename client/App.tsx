import React, { useState, useCallback, useRef } from 'react';
import { AppState, Restaurant, SearchParams } from './types';
import { InputView } from './components/InputView';
import { ResultView } from './components/ResultView';
import { SettingsView } from './components/SettingsView';
import { LoadingOverlay } from './components/LoadingOverlay';
import { fetchRestaurants } from './services/geminiService';
import { AuthButton } from './components/AuthButton';
import { useAuth } from './contexts/AuthContext';
import { getPreferences, savePreferences, addToHistory } from './services/api';
import { ActionLogger } from './components/ActionLogger';
import { useEffect } from 'react';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    view: 'input',
    loading: false,
    loadingMessage: '',
    loadingError: null,
    error: null,
    params: { location: '', keywords: '', mode: 'random', radius: '1km', model: 'gemini-3-pro-preview', language: 'zh-TW' },
    allRestaurants: [],
    shownRestaurantIds: new Set(),
    displayedRestaurants: [],
    isBackgroundFetching: false,
    isDeveloperMode: false,
    streamOutput: ''
  });

  // Ref to hold the AbortController
  const abortControllerRef = useRef<AbortController | null>(null);

  const { currentUser, logout } = useAuth();

  // Load preferences when user logs in
  useEffect(() => {
    if (currentUser) {
      getPreferences().then(prefs => {
        if (prefs && prefs.preferences) {
          console.log("Loaded preferences:", prefs);
          // Optional: merge prefs into state.params if you want to restore last search
          // setState(prev => ({ ...prev, params: { ...prev.params, ...prefs.preferences } }));
        }
      }).catch(err => console.error("Failed to load prefs", err));
    }
  }, [currentUser]);


  const handleSearch = useCallback(async (params: SearchParams, isDevMode: boolean) => {
    // Create new controller for this search
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setState(prev => ({
      ...prev,
      loading: true,
      loadingMessage: `Searching...`, // This base message is less important now, Overlay handles it
      loadingError: null,
      params,
      allRestaurants: [],
      displayedRestaurants: [],
      shownRestaurantIds: new Set(),
      isDeveloperMode: isDevMode,
      streamOutput: '',
      isLogoutTransition: false
    }));

    if (currentUser) {
      savePreferences({ preferences: params }).catch(e => console.error("Failed to save preferences", e));
    }

    try {
      // Phase 1: Fetch initial 6
      const limit = 6;

      const onStreamUpdate = (chunk: string) => {
        // If aborted, stop updating stream output to avoid state updates on unmounted/hidden components
        if (controller.signal.aborted) return;

        setState(prev => ({
          ...prev,
          streamOutput: prev.streamOutput + chunk
        }));
      };

      // Pass the selected model, language and the signal to the service
      const results = await fetchRestaurants(
        params.location,
        params.keywords,
        params.radius,
        limit,
        params.model,
        params.language,
        params.excludedNames || [],
        isDevMode ? onStreamUpdate : undefined,
        controller.signal
      );

      // Critical check: If aborted during fetch, stop here.
      if (controller.signal.aborted) return;

      if (results.length === 0) {
        throw new Error(params.language === 'en' ? "No restaurants found." : "找不到符合條件的餐廳");
      }

      const initialShownIds = new Set<string>();

      // For both List and Random mode, we now display all initial results (initially 6).
      // Random mode will handle the visual presentation (carousel) in ResultView.
      const initialDisplay = results;
      results.forEach(r => initialShownIds.add(r.id));

      // Trigger "Finishing" animation
      setState(prev => ({
        ...prev,
        isFinishing: true,
        pendingResults: initialDisplay
      }));

      setTimeout(() => {
        if (controller.signal.aborted) return;

        setState(prev => ({
          ...prev,
          view: 'result',
          loading: false,
          isFinishing: false,
          pendingResults: undefined,
          allRestaurants: results,
          shownRestaurantIds: initialShownIds,
          displayedRestaurants: initialDisplay,
          error: null,
          isBackgroundFetching: true
        }));

        // Track history
        if (currentUser) {
          addToHistory(params.keywords, initialDisplay.map(r => r.name));
        }
      }, 500);

      // Phase 2: Background Fetch (Fetching more without user waiting)
      // Note: We use existing results names to try to find DIFFERENT ones, but Schema mode is stricter.
      const excludeNames = results.map(r => r.name).concat(params.excludedNames || []);

      fetchRestaurants(params.location, params.keywords, params.radius, 9, params.model, params.language, excludeNames).then((moreResults) => {
        // Only update if the user hasn't started a new search or cancelled
        if (abortControllerRef.current === controller && !controller.signal.aborted) {
          setState(current => {
            return {
              ...current,
              allRestaurants: [...current.allRestaurants, ...moreResults],
              isBackgroundFetching: false
            };
          });
        }
      }).catch(e => {
        console.log("Background fetch ended/aborted", e);
      });

    } catch (err: any) {
      // If aborted, do nothing (state already reset by handleCancelSearch)
      if (controller.signal.aborted) {
        return;
      }

      // Instead of alert, set loadingError to show in Overlay
      const errorMsg = (err as Error).message;
      setState(prev => ({
        ...prev,
        loading: true,
        loadingError: errorMsg
      }));
    }
  }, []);

  const handleCancelSearch = useCallback(() => {
    // 1. Abort the underlying request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    // 2. Immediately update UI to stop loading and return to input view
    setState(prev => ({
      ...prev,
      loading: false,
      loadingError: null,
    }));
  }, []);

  const handleCloseLoading = useCallback(() => {
    setState(prev => ({ ...prev, loading: false, loadingError: null }));
  }, []);

  const handleNext = useCallback(() => {
    setState(prev => {
      const { allRestaurants, shownRestaurantIds, params, displayedRestaurants } = prev;

      const available = allRestaurants.filter(r => !shownRestaurantIds.has(r.id));

      if (available.length === 0) {
        return prev;
      }

      const newShownIds = new Set(shownRestaurantIds);
      let newDisplay = [...displayedRestaurants];

      // In both modes now, "Next" appends the available items.
      // The carousel component will handle accessing these new indices.
      available.forEach(r => newShownIds.add(r.id));
      newDisplay = [...displayedRestaurants, ...available];

      return {
        ...prev,
        shownRestaurantIds: newShownIds,
        displayedRestaurants: newDisplay
      };
    });
  }, []);

  const handleBack = useCallback(() => {
    // Abort any ongoing background fetch when going back
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setState(prev => ({
      ...prev,
      view: 'input',
      allRestaurants: [],
      displayedRestaurants: [],
      isBackgroundFetching: false,
      isLogoutTransition: false
    }));
  }, []);

  const handleGoToSettings = useCallback(() => {
    setState(prev => ({
      ...prev,
      view: 'settings',
      lastView: (prev.view === 'input' || prev.view === 'result') ? prev.view : prev.lastView,
      isLogoutTransition: false
    }));
  }, []);

  const handleBackFromSettings = useCallback(() => {
    setState(prev => ({ ...prev, view: prev.lastView || 'input' }));
  }, []);

  const handleLogoutFromSettings = useCallback(async () => {
    try {
      await logout();
    } catch (e) {
      console.error("Logout failed", e);
    }
    setState(prev => ({
      ...prev,
      view: 'input',
      allRestaurants: [],
      displayedRestaurants: [],
      shownRestaurantIds: new Set(),
      lastView: undefined,
      isLogoutTransition: true
    }));
  }, [logout]);

  const isExhausted = !state.isBackgroundFetching &&
    state.allRestaurants.length > 0 &&
    state.allRestaurants.every(r => state.shownRestaurantIds.has(r.id));

  return (
    <div className="antialiased text-gray-900 bg-white dark:bg-gray-900 min-h-screen relative">
      <ActionLogger />
      <div className="absolute top-4 right-4 z-50">
        <AuthButton
          onAvatarClick={state.view === 'settings' ? handleLogoutFromSettings : handleGoToSettings}
          onLogout={handleLogoutFromSettings}
        />
      </div>
      {state.loading && (
        <LoadingOverlay
          message={state.loadingMessage}
          error={state.loadingError}
          isDevMode={state.isDeveloperMode}
          streamOutput={state.streamOutput}
          language={state.params.language}
          onClose={handleCloseLoading}
          onCancel={handleCancelSearch}
          isFinishing={state.isFinishing}
        />
      )}

      {state.view === 'settings' ? (
        <SettingsView onUiBack={handleBackFromSettings} onLogout={handleLogoutFromSettings} />
      ) : state.view === 'input' ? (
        <InputView onSearch={handleSearch} isLoading={state.loading} startWithLogoutAnimation={state.isLogoutTransition} />
      ) : (
        <ResultView
          restaurants={state.displayedRestaurants}
          params={state.params}
          onBack={handleBack}
          onNext={handleNext}
          isExhausted={isExhausted}
          isBackgroundFetching={state.isBackgroundFetching}
        />
      )}
    </div>
  );
};

export default App;