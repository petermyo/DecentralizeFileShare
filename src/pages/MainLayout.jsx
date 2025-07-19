// --- /src/pages/MainLayout.jsx ---
import React from 'react';
import Header from '../components/layout/Header';
import { useData } from '../contexts/DataContext';

const MainLayout = () => {
    const { files, lists, isLoading, refreshData } = useData();

    if (isLoading) {
        return <div>Loading dashboard...</div>;
    }

    return (
        <div>
            <Header />
            <main className="container mx-auto p-4">
                <h1 className="text-2xl font-bold mb-6">My Dashboard</h1>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4">
                        <div className="bg-white p-6 rounded-lg shadow-lg">Upload Form Here</div>
                    </div>
                    <div className="lg:col-span-8">
                        <div className="bg-white p-6 rounded-lg shadow-lg mb-8">Files Table Here</div>
                        <div className="bg-white p-6 rounded-lg shadow-lg">Lists Table Here</div>
                    </div>
                </div>
            </main>
        </div>
    );
};
export default MainLayout;