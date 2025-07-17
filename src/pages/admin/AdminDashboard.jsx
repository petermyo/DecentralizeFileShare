// --- /src/pages/admin/AdminDashboard.jsx ---
import React, { useState, useEffect } from 'react';

const AdminDashboard = () => {
    const [stats, setStats] = useState(null);
    useEffect(() => {
        fetch('/api/admin/stats').then(res => res.json()).then(setStats);
    }, []);

    return (
        <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-6">Dashboard</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-lg shadow"><h3 className="text-sm font-medium text-slate-500">Total Users</h3><p className="mt-1 text-3xl font-semibold text-slate-900">{stats?.totalUsers ?? '...'}</p></div>
                <div className="bg-white p-6 rounded-lg shadow"><h3 className="text-sm font-medium text-slate-500">Total Files Shared</h3><p className="mt-1 text-3xl font-semibold text-slate-900">{stats?.totalFiles ?? '...'}</p></div>
                <div className="bg-white p-6 rounded-lg shadow"><h3 className="text-sm font-medium text-slate-500">Total Lists Created</h3><p className="mt-1 text-3xl font-semibold text-slate-900">{stats?.totalLists ?? '...'}</p></div>
            </div>
        </div>
    );
};
export default AdminDashboard;
