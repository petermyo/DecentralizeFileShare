import React from 'react';

const CreateListModal = ({ fileIds, onClose, onCreated }) => {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-6 rounded shadow-lg min-w-[300px]">
                <h2 className="text-lg font-bold mb-4">Create List</h2>
                <p className="mb-4">Creating a list from {fileIds ? fileIds.length : 0} files.</p>
                {/* Add form fields here as needed */}
                <div className="flex justify-end space-x-2">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-300 rounded hover:bg-slate-400">Cancel</button>
                    <button onClick={onCreated} className="px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700">Create</button>
                </div>
            </div>
        </div>
    );
};

export default CreateListModal;