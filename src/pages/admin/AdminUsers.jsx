// --- /src/pages/admin/AdminUsers.jsx ---
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
const AdminUsers = () => {
    const [users, setUsers] = useState([]);
    useEffect(() => { fetch('/api/admin/users').then(res => res.json()).then(setUsers); }, []);
    return (
        <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-6">User Management</h1>
            <div className="bg-white shadow rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50"><tr><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">User</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">File Count</th><th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th></tr></thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                        {users.map(user => (
                            <tr key={user.userId}>
                                <td className="px-6 py-4 whitespace-nowrap"><Link to={`/admin/users/${user.userId}`} className="flex items-center group"><div className="flex-shrink-0 h-10 w-10"><img className="h-10 w-10 rounded-full" src={user.picture} alt="" /></div><div className="ml-4"><div className="text-sm font-medium text-slate-900 group-hover:text-sky-600">{user.name}</div><div className="text-sm text-slate-500">{user.userId}</div></div></Link></td>
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