// --- /src/contexts/DataContext.jsx ---
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useAuth } from './AuthContext';

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

export const DataProvider = ({ children }) => {
    const { user } = useAuth();
    const [files, setFiles] = useState([]);
    const [lists, setLists] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchData = useCallback(async () => {
        if (user) {
            setIsLoading(true);
            try {
                const [filesRes, listsRes] = await Promise.all([
                    fetch('/api/files'),
                    fetch('/api/lists')
                ]);
                const filesData = await filesRes.json();
                const listsData = await listsRes.json();
                setFiles(filesData);
                setLists(listsData);
            } catch (err) {
                console.error("Failed to fetch data:", err);
            } finally {
                setIsLoading(false);
            }
        }
    }, [user]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const value = { files, lists, isLoading, refreshData: fetchData };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};