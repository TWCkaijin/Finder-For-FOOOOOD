import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

import { getTranslation, LanguageCode } from '../i18n';

interface AuthButtonProps {
    onAvatarClick?: () => void;
    onLogout?: () => void;
    language?: LanguageCode;
}

export const AuthButton: React.FC<AuthButtonProps> = ({ onAvatarClick, onLogout, language }) => {
    const { currentUser, signInWithGoogle, logout } = useAuth();
    const t = getTranslation(language || 'zh-TW');
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        try {
            setError(null);
            await signInWithGoogle();
        } catch (err) {
            setError(t.auth.failedLogin);
            console.error(err);
        }
    };

    const handleLogout = async () => {
        try {
            setError(null);
            await logout();
            if (onLogout) onLogout();
        } catch (err) {
            setError(t.auth.failedLogout);
            console.error(err);
        }
    };

    return (
        <div className="flex flex-col items-end z-50">
            {error && (
                <div className="bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1 rounded-lg text-xs font-bold mb-2 shadow-sm border border-red-200 dark:border-red-800 animate-in fade-in slide-in-from-top-2">
                    {error}
                </div>
            )}

            {currentUser ? (
                <div
                    onClick={onAvatarClick}
                    className="group flex items-center gap-3 bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/60 dark:border-white/10 rounded-full p-1.5 pr-2 shadow-lg hover:shadow-xl transition-all duration-300 hover:bg-white/80 dark:hover:bg-black/60 cursor-pointer"
                >
                    {currentUser.photoURL ? (
                        <img
                            src={currentUser.photoURL}
                            alt="Profile"
                            className="w-9 h-9 rounded-full border-2 border-white dark:border-gray-700 shadow-sm"
                        />
                    ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center text-white font-bold shadow-sm">
                            {currentUser.displayName?.charAt(0) || 'U'}
                        </div>
                    )}

                    <div className="flex flex-col mr-1">
                        <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-bold leading-none mb-0.5">{t.auth.welcome}</span>
                        <span className="text-xs font-bold text-gray-800 dark:text-gray-100 leading-none max-w-[100px] truncate">
                            {currentUser.displayName?.split(' ')[0]}
                        </span>
                    </div>

                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleLogout();
                        }}
                        className="ml-1 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 hover:bg-red-100 hover:text-red-500 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-all duration-200"
                        title={t.auth.signOut}
                    >
                        <span className="material-symbols-outlined text-[18px]">logout</span>
                    </button>
                </div>
            ) : (
                <button
                    onClick={handleLogin}
                    className="group relative flex items-center gap-2.5 px-5 py-2.5 bg-white/70 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-full shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-300 active:scale-95"
                >
                    <span className="absolute inset-0 rounded-full bg-gradient-to-r from-green-400/20 to-emerald-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                    <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center shadow-sm">
                        {/* Simple Google G icon SVG */}
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.84z" fill="#FBBC05" />
                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                        </svg>
                    </div>

                    <span className="text-sm font-bold text-gray-700 dark:text-gray-100 group-hover:text-gray-900 dark:group-hover:text-white transition-colors">
                        Sign In via Google
                    </span>
                </button>
            )}
        </div>
    );
};
