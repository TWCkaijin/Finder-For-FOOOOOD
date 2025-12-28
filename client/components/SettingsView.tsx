import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getPreferences, savePreferences } from '../services/api';
import { UserPreferences, RestaurantRating } from '../types';
import { getTranslation, LanguageCode } from '../i18n';

interface SettingsViewProps {
    onUiBack: () => void;
    onLogout: () => void;
}

const MODELS = [
    { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
    { id: 'gemini-3.0-pro', name: 'Gemini 3.0 Pro' },
];

const LANGUAGES = [
    { id: 'zh-TW', name: '繁體中文' },
    { id: 'en', name: 'English' },
    { id: 'ja', name: '日本語' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({ onUiBack, onLogout, currentLanguage, onLanguageChange }) => {
    const { currentUser, logout } = useAuth();
    const [loading, setLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [prefs, setPrefs] = useState<UserPreferences>({});
    const [newBlacklist, setNewBlacklist] = useState('');

    const t = getTranslation(currentLanguage || (prefs.language as LanguageCode) || 'zh-TW');

    // State for rating flow
    const [ratingTarget, setRatingTarget] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        if (currentUser) {
            getPreferences().then(data => {
                if (data && data.preferences) {
                    // Handle legacy double-nesting bug
                    if ((data.preferences as any).preferences) {
                        setPrefs((data.preferences as any).preferences);
                    } else {
                        setPrefs(data.preferences);
                    }
                }
                setLoading(false);
            }).catch(err => {
                console.error(err);
                setLoading(false);
            });
        }
    }, [currentUser]);

    const handleSave = async (newPrefs: UserPreferences) => {
        setPrefs(newPrefs);
        setIsSaving(true);
        try {
            await savePreferences({ preferences: newPrefs });
        } catch (e) {
            console.error("Save failed", e);
        } finally {
            setIsSaving(false);
        }
    };

    const updateField = (field: keyof UserPreferences, value: any) => {
        const updated = { ...prefs, [field]: value };
        handleSave(updated);
    };

    const handleLogout = async () => {
        try {
            await logout();
        } catch (e) {
            console.error("Logout failed", e);
        } finally {
            onLogout();
        }
    };

    // Blacklist Logic
    const handleAddBlacklist = () => {
        if (!newBlacklist.trim()) return;
        const current = prefs.blacklist || [];
        if (!current.includes(newBlacklist.trim())) {
            updateField('blacklist', [...current, newBlacklist.trim()]);
        }
        setNewBlacklist('');
    };

    const removeBlacklist = (item: string) => {
        const current = prefs.blacklist || [];
        updateField('blacklist', current.filter(i => i !== item));
    };

    // Rating Logic
    const submitRating = (rating: number) => {
        if (!ratingTarget) return;

        const { id, name } = ratingTarget;
        const timestamp = Date.now();

        // Add to rated map
        const newRatings = { ...prefs.ratings, [id]: { restaurantId: id, name, rating, timestamp } };

        // Remove from pending
        const currentPending = prefs.pendingReviews || [];
        const newPending = currentPending.filter(item => item.id !== id);

        const updated = { ...prefs, ratings: newRatings, pendingReviews: newPending };
        handleSave(updated);
        setRatingTarget(null);
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-black font-display flex flex-col items-center py-12 px-4 animate-in slide-in-from-right duration-500 overflow-y-auto">
            <div className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-3xl shadow-xl border border-gray-100 dark:border-white/5 relative overflow-hidden flex flex-col mb-10">

                {/* Header */}
                <div className="p-6 border-b border-gray-100 dark:border-white/5 flex items-center justify-between bg-white/50 dark:bg-black/20 backdrop-blur-sm sticky top-0 z-20">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onUiBack}
                            className="w-10 h-10 rounded-full bg-gray-100 dark:bg-white/10 flex items-center justify-center hover:bg-gray-200 dark:hover:bg-white/20 transition-colors"
                        >
                            <span className="material-symbols-outlined text-gray-600 dark:text-gray-300">arrow_back</span>
                        </button>
                        <h1 className="text-2xl font-black text-gray-900 dark:text-white">{t.settings.title}</h1>
                    </div>
                    <div className="flex items-center gap-3">
                        {isSaving && <span className="text-xs text-gray-400 flex items-center gap-1"><span className="animate-spin material-symbols-outlined text-sm">sync</span> {t.settings.saving}</span>}
                        <button
                            onClick={handleLogout}
                            className="w-10 h-10 rounded-full bg-gray-100 dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400 transition-colors flex items-center justify-center"
                        >
                            <span className="material-symbols-outlined text-[20px]">logout</span>
                        </button>
                    </div>
                </div>

                <div className="p-8 space-y-10">

                    {/* 1. General Settings (Language & Model) */}
                    <section>
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">{t.settings.general}</h2>
                        <div className="space-y-4">
                            {/* Language */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-gray-50 dark:bg-black/20 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-gray-500">language</span>
                                    <span className="font-bold text-gray-700 dark:text-gray-200">{t.settings.language}</span>
                                </div>
                                <select
                                    value={prefs.language || 'zh-TW'}
                                    onChange={(e) => {
                                        const newLang = e.target.value as LanguageCode;
                                        setPrefs(prev => ({ ...prev, language: newLang }));
                                        savePreferences({ preferences: { ...prefs, language: newLang } });
                                        if (onLanguageChange) onLanguageChange(newLang);
                                    }}
                                    className="bg-gray-100 dark:bg-black/40 border-none rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200 px-3 py-2 outline-none cursor-pointer"
                                >
                                    <option value="zh-TW">繁體中文</option>
                                    <option value="en">English</option>
                                    <option value="ja">日本語</option>
                                </select>
                            </div>

                            {/* Model */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-gray-50 dark:bg-black/20 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-gray-500">smart_toy</span>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-700 dark:text-gray-200">{t.settings.aiModel}</span>
                                        <span className="text-xs text-gray-400">{t.settings.aiDesc}</span>
                                    </div>
                                </div>
                                <select
                                    value={prefs.defaultModel || 'gemini-2.5-flash'}
                                    onChange={(e) => updateField('defaultModel', e.target.value)}
                                    className="bg-white dark:bg-zinc-800 border-none rounded-lg py-2 px-4 pr-8 text-sm font-bold focus:ring-2 focus:ring-input-primary outline-none max-w-[200px]"
                                >
                                    {MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>

                            {/* Dev Mode */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-4 bg-gray-50 dark:bg-black/20 rounded-xl">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-gray-500">code</span>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-gray-700 dark:text-gray-200">{t.settings.devMode}</span>
                                        <span className="text-xs text-gray-400">{t.settings.devDesc}</span>
                                    </div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={prefs.devMode || false}
                                        onChange={(e) => updateField('devMode', e.target.checked)}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none dark:bg-gray-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-input-primary"></div>
                                </label>
                            </div>
                        </div>
                    </section>

                    {/* 2. History & Blacklist */}
                    <section>
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">{t.settings.historyAndBlacklist}</h2>
                        <div className="p-6 bg-gray-50 dark:bg-black/20 rounded-xl border border-gray-100 dark:border-white/5">
                            <div className="flex items-center gap-2 mb-4">
                                <span className="material-symbols-outlined text-red-400">block</span>
                                <h3 className="font-bold text-gray-800 dark:text-gray-100">{t.settings.blacklist}</h3>
                            </div>
                            <div className="flex gap-2 mb-4">
                                <input
                                    type="text"
                                    value={newBlacklist}
                                    onChange={(e) => setNewBlacklist(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAddBlacklist()}
                                    placeholder={t.settings.blacklistPlaceholder}
                                    className="flex-grow px-4 py-2 rounded-lg bg-white dark:bg-zinc-800 border-none focus:ring-2 focus:ring-red-400 outline-none text-sm"
                                />
                                <button
                                    onClick={handleAddBlacklist}
                                    className="px-4 py-2 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 rounded-lg font-bold text-gray-600 dark:text-gray-300 transition-colors"
                                >
                                    {t.settings.add}
                                </button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {(!prefs.blacklist || prefs.blacklist.length === 0) && (
                                    <span className="text-xs text-gray-400 italic">{t.settings.noBlacklist}</span>
                                )}
                                {prefs.blacklist?.map(item => (
                                    <span key={item} className="inline-flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300 rounded-full text-xs font-medium group">
                                        {item}
                                        <button onClick={() => removeBlacklist(item)} className="hover:text-red-800 dark:hover:text-white transition-colors">
                                            <span className="material-symbols-outlined text-[14px]">close</span>
                                        </button>
                                    </span>
                                ))}
                            </div>
                        </div>
                    </section>

                    {/* 3. Pending Reviews */}
                    <section>
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider">{t.settings.pendingReviews}</h2>
                            {(prefs.pendingReviews?.length || 0) > 0 && (
                                <span className="bg-yellow-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                                    {prefs.pendingReviews?.length} {t.settings.todo}
                                </span>
                            )}
                        </div>

                        {(!prefs.pendingReviews || prefs.pendingReviews.length === 0) ? (
                            <div className="p-8 text-center bg-gray-50 dark:bg-black/10 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                                <span className="material-symbols-outlined text-gray-300 text-4xl mb-2">rate_review</span>
                                <p className="text-gray-400 text-sm">{t.settings.noPending}</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {prefs.pendingReviews.map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-4 bg-white dark:bg-zinc-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700">
                                        <span className="font-bold text-gray-800 dark:text-gray-100">{item.name}</span>
                                        <button
                                            onClick={() => setRatingTarget(item)}
                                            className="px-4 py-1.5 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 rounded-lg text-sm font-bold transition-colors shadow-sm"
                                        >
                                            {t.settings.rateNow}
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>

                    {/* 4. Rated Restaurants (Brief List) */}
                    <section>
                        <h2 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4">{t.settings.myRatings}</h2>
                        {(!prefs.ratings || Object.keys(prefs.ratings).length === 0) ? (
                            <p className="text-xs text-gray-400 ml-2">{t.settings.noRatings}</p>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {(Object.values(prefs.ratings || {}) as RestaurantRating[])
                                    .sort((a, b) => b.timestamp - a.timestamp)
                                    .map((r) => (
                                        <div key={r.restaurantId} className="p-3 bg-gray-50 dark:bg-zinc-900/50 rounded-lg border border-gray-100 dark:border-white/5 flex flex-col">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="font-bold text-sm truncate">{r.name}</span>
                                                <span className={`text-xs font-bold px-1.5 rounded ${r.rating >= 4 ? 'bg-green-100 text-green-700' : r.rating <= 2 ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-700'}`}>
                                                    {r.rating} ★
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-gray-400">{new Date(r.timestamp).toLocaleDateString()}</span>
                                        </div>
                                    ))}
                            </div>
                        )}
                    </section>
                </div>

                {/* Footer Logout */}
                <div className="p-6 bg-gray-50 dark:bg-black/20 border-t border-gray-100 dark:border-white/5 mt-auto">
                    <button
                        onClick={handleLogout}
                        className="w-full py-3 bg-white dark:bg-zinc-800 hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 dark:text-red-400 rounded-xl font-bold transition-colors flex items-center justify-center gap-2 border border-gray-200 dark:border-gray-700"
                    >
                        <span className="material-symbols-outlined">logout</span>
                        {t.settings.logout}
                    </button>
                </div>

                {/* Rating Modal */}
                {ratingTarget && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
                        <div className="bg-white dark:bg-zinc-900 w-full max-w-sm rounded-2xl p-6 shadow-2xl relative">
                            <button onClick={() => setRatingTarget(null)} className="absolute top-4 right-4 p-2 text-gray-400 hover:text-gray-800 dark:hover:text-white">
                                <span className="material-symbols-outlined">close</span>
                            </button>

                            <h3 className="text-xl font-black text-center mb-1">{t.settings.rateExperience}</h3>
                            <p className="text-center text-gray-500 mb-6">{ratingTarget.name}</p>

                            <div className="flex justify-center gap-2 mb-8">
                                {[1, 2, 3, 4, 5].map(star => (
                                    <button
                                        key={star}
                                        onClick={() => submitRating(star)}
                                        className="group p-2 hover:scale-110 transition-transform"
                                    >
                                        <span className={`material-symbols-outlined text-4xl ${star <= 3 ? 'text-gray-200 hover:text-yellow-400' : 'text-gray-200 hover:text-yellow-400'} fill-1`}>star</span>
                                        {/* Hover effect logic in CSS is tricky here without state, so I'll simplify: Click to rate immediately? Or Click to select? */}
                                        {/* User asked for score 1-5. Let's make it simple: 5 buttons. */}
                                    </button>
                                ))}
                                {/* Better implementation: Hover state. */}
                            </div>

                            {/* Alternative: Star Rating Input */}
                            <div className="grid grid-cols-5 gap-2">
                                {[1, 2, 3, 4, 5].map(score => (
                                    <button
                                        key={score}
                                        onClick={() => submitRating(score)}
                                        className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${score >= 4 ? 'border-green-100 bg-green-50 hover:border-green-500 hover:bg-green-100' :
                                            score <= 2 ? 'border-red-100 bg-red-50 hover:border-red-500 hover:bg-red-100' :
                                                'border-yellow-100 bg-yellow-50 hover:border-yellow-400 hover:bg-yellow-100'
                                            }`}
                                    >
                                        <span className={`text-2xl font-bold ${score >= 4 ? 'text-green-600' : score <= 2 ? 'text-red-600' : 'text-yellow-600'
                                            }`}>{score}</span>
                                        <span className="text-[10px] uppercase font-bold text-gray-400">Stars</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
