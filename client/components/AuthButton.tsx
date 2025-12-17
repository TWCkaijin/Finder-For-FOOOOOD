import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export const AuthButton: React.FC = () => {
    const { currentUser, signInWithGoogle, logout } = useAuth();
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async () => {
        try {
            setError(null);
            await signInWithGoogle();
        } catch (err) {
            setError('Failed to log in');
            console.error(err);
        }
    };

    const handleLogout = async () => {
        try {
            setError(null);
            await logout();
        } catch (err) {
            setError('Failed to log out');
            console.error(err);
        }
    };

    return (
        <div className="flex flex-col items-end">
            {error && <span className="text-red-500 text-xs mb-1">{error}</span>}
            {currentUser ? (
                <div className="flex items-center gap-2">
                    {currentUser.photoURL && (
                        <img
                            src={currentUser.photoURL}
                            alt="Profile"
                            className="w-8 h-8 rounded-full border border-gray-300 dark:border-gray-600"
                        />
                    )}
                    <span className="text-sm dark:text-gray-300 hidden sm:block">{currentUser.displayName}</span>
                    <button
                        onClick={handleLogout}
                        className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 rounded-md transition-colors"
                    >
                        Sign Out
                    </button>
                </div>
            ) : (
                <button
                    onClick={handleLogin}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm font-medium"
                >
                    Sign In
                </button>
            )}
        </div>
    );
};
