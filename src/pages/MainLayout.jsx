import React, { useState, useEffect } from 'react';
import { useData } from '../contexts/DataContext';
import Header from '../components/layout/Header';
import UploadForm from '../components/UploadForm';
import FileTable from '../components/FileTable';
import ListsTable from '../components/ListsTable';
import EditModal from '../components/modals/EditModal';
import CreateListModal from '../components/modals/CreateListModal';
import ConfirmDeleteModal from '../components/modals/ConfirmDeleteModal';
import EditListModal from '../components/modals/EditListModal';

const MainLayout = () => {
    const { files, lists, isLoading, refreshData } = useData();
    const [view, setView] = useState('files');
    
    // State for modals
    const [editingFile, setEditingFile] = useState(null);
    const [deletingFile, setDeletingFile] = useState(null);
    const [selectedFileIds, setSelectedFileIds] = useState([]);
    const [isCreatingList, setIsCreatingList] = useState(false);
    const [editingList, setEditingList] = useState(null);
    const [deletingList, setDeletingList] = useState(null);

    if (isLoading) {
        return (
            <div>
                <Header />
                <div className="min-h-screen flex items-center justify-center">Loading Dashboard...</div>
            </div>
        );
    }

    return (
        <>
            <Header />
            <main className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4">
                        <UploadForm 
                            onUploadComplete={refreshData}
                            onBatchComplete={(newFileIds) => {
                                if (newFileIds.length > 1 && window.confirm(`Successfully uploaded ${newFileIds.length} files. Would you like to create a list from them?`)) {
                                    setSelectedFileIds(newFileIds);
                                    setIsCreatingList(true);
                                }
                            }}
                        />
                    </div>
                    <div className="lg:col-span-8">
                        <div className="mb-4 border-b border-slate-200">
                            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                                <button onClick={() => setView('files')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'files' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>My Files</button>
                                <button onClick={() => setView('lists')} className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${view === 'lists' ? 'border-sky-500 text-sky-600' : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}>My Lists</button>
                                {/* Add Team Tabs Here */}
                            </nav>
                        </div>

                        {view === 'files' && (
                            <FileTable 
                                files={files} 
                                onEditFile={setEditingFile} 
                                onDeleteFile={setDeletingFile} 
                                selectedFileIds={selectedFileIds}
                                setSelectedFileIds={setSelectedFileIds}
                                onOpenCreateList={() => setIsCreatingList(true)}
                            />
                        )}
                        {view === 'lists' && (
                            <ListsTable 
                                lists={lists} 
                                onEditList={setEditingList}
                                onDeleteList={setDeletingList}
                            />
                        )}
                    </div>
                </div>
            </main>
            
            {/* Modals */}
            {editingFile && <EditModal file={editingFile} onClose={() => setEditingFile(null)} onUpdate={refreshData} />}
            {deletingFile && <ConfirmDeleteModal item={deletingFile} type="file" onClose={() => setDeletingFile(null)} onConfirm={() => { fetch('/api/delete', { method: 'POST', body: JSON.stringify({ fileId: deletingFile.fileId, shortUrl: deletingFile.shortUrl }) }).then(() => { refreshData(); setDeletingFile(null); }) }} />}
            {isCreatingList && <CreateListModal fileIds={selectedFileIds} onClose={() => setIsCreatingList(false)} onCreated={() => { refreshData(); setSelectedFileIds([]); setIsCreatingList(false); setView('lists'); }} />}
            {editingList && <EditListModal list={editingList} onClose={() => setEditingList(null)} onUpdate={() => { refreshData(); setEditingList(null); }} />}
            {deletingList && <ConfirmDeleteModal item={deletingList} type="list" onClose={() => setDeletingList(null)} onConfirm={() => { fetch('/api/lists/delete', { method: 'POST', body: JSON.stringify({ shortUrl: deletingList.shortUrl }) }).then(() => { refreshData(); setDeletingList(null); }) }} />}
        </>
    );
};
export default MainLayout;
