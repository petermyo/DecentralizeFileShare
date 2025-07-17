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


// --- /src/pages/admin/AdminUsers.jsx ---
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const AdminUsers = () => {
    const [users, setUsers] = useState([]);
    useEffect(() => {
        fetch('/api/admin/users').then(res => res.json()).then(setUsers);
    }, []);

    return (
        <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-6">User Management</h1>
            <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">File Count</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th></tr></thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {users.map(user => (
                            <tr key={user.userId}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <Link to={`/admin/users/${user.userId}`} className="flex items-center group">
                                        <div className="flex-shrink-0 h-10 w-10"><img className="h-10 w-10 rounded-full" src={user.picture} alt="" /></div>
                                        <div className="ml-4"><div className="text-sm font-medium text-slate-900 group-hover:text-sky-600">{user.name}</div><div className="text-sm text-slate-500">{user.userId}</div></div>
                                    </Link>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{user.fileCount}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium"><button className="text-red-600 hover:text-red-900">Revoke Access</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
export default AdminUsers;

// --- /src/pages/admin/AdminUserDetail.jsx ---
import React from 'react';
import { useParams } from 'react-router-dom';

const AdminUserDetail = () => {
    const { userId } = useParams();
    // In a real app, you'd fetch this user's files and lists from new API endpoints
    // e.g., /api/admin/user-files?id=${userId}
    return (
        <div>
            <h1 className="text-2xl font-bold">Files and Lists for User:</h1>
            <p className="text-slate-600">{userId}</p>
            {/* Here you would render the FileTable and ListsTable components, passing the fetched data */}
        </div>
    );
};
export default AdminUserDetail;

// Other admin pages would be similar...
