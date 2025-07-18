// --- /src/pages/UserSettings.jsx ---
import React from 'react';
import Header from '../components/layout/Header';
import { useTheme } from '../contexts/ThemeContext';

const UserSettings = () => {
    const { applyTheme } = useTheme();
    return (
        <div>
            <Header />
            <main className="container mx-auto p-4 max-w-2xl">
                <h1 className="text-2xl font-bold mb-6">Settings</h1>
                <div className="bg-white p-6 rounded-lg shadow-lg space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-slate-700">UI Color</label>
                        <select onChange={(e) => applyTheme(e.target.value)} className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm rounded-md">
                            <option value="theme-default">Default Blue</option>
                            <option value="theme-pink">Pink</option>
                            <option value="theme-green">Green</option>
                            <option value="theme-glamorous">Glamorous</option>
                        </select>
                    </div>
                </div>
            </main>
        </div>
    );
};
export default UserSettings;
