// --- /src/pages/admin/AdminLayout.jsx ---
import React from 'react';
import { Link, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const AdminLayout = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const handleLogout = async () => {
        await fetch('/api/logout');
        navigate('/');
        window.location.reload(); 
    };
    return (
        <div className="flex h-screen bg-slate-100">
            <aside className="w-64 bg-slate-800 text-white flex flex-col">
                <div className="h-16 flex items-center justify-center text-xl font-bold border-b border-slate-700">Admin Panel</div>
                <nav className="flex-1 px-2 py-4 space-y-1">
                    <Link to="/admin" className="w-full flex items-center px-2 py-2 text-sm font-medium rounded-md hover:bg-slate-700">Dashboard</Link>
                    <Link to="/admin/users" className="w-full flex items-center px-2 py-2 text-sm font-medium rounded-md hover:bg-slate-700">Users</Link>
                    <Link to="/admin/files" className="w-full flex items-center px-2 py-2 text-sm font-medium rounded-md hover:bg-slate-700">Files</Link>
                    <Link to="/admin/lists" className="w-full flex items-center px-2 py-2 text-sm font-medium rounded-md hover:bg-slate-700">Lists</Link>
                </nav>
                 <div className="px-2 py-4 border-t border-slate-700 space-y-2">
                    <a href="/" className="w-full flex items-center px-2 py-2 text-sm font-medium rounded-md hover:bg-slate-700">Go to Main Site</a>
                    <button onClick={handleLogout} className="w-full flex items-center px-2 py-2 text-sm font-medium rounded-md hover:bg-slate-700">Logout</button>
                </div>
            </aside>
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white shadow-sm h-16 flex justify-end items-center px-6">
                     <div className="flex items-center space-x-3">
                        <img className="h-8 w-8 rounded-full" src={user?.picture} alt="Admin" />
                        <span>{user?.name}</span>
                    </div>
                </header>
                <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-100 p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};
export default AdminLayout;
