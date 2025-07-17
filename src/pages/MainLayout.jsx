// --- /src/pages/MainLayout.jsx ---
import React from 'react';
import Header from '../components/layout/Header';

const MainLayout = () => {
    // This will be expanded with the full dashboard UI later
    return (
        <div>
            <Header />
            <main className="container mx-auto p-4">
                <h1 className="text-2xl font-bold">My Dashboard</h1>
                <p>Your file and list management components will go here.</p>
            </main>
        </div>
    );
};
export default MainLayout;
