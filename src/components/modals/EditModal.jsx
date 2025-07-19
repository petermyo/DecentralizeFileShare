import React from 'react';

const EditModal = ({ file, onClose, onUpdate }) => {
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-6 rounded shadow-lg min-w-[300px]">
                <h2 className="text-lg font-bold mb-4">Edit File</h2>
                <p className="mb-4">Editing: {file ? (file.name || file.fileName || 'Untitled') : ''}</p>
                {/* Add form fields here as needed */}
                <div className="flex justify-end space-x-2">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-300 rounded hover:bg-slate-400">Cancel</button>
                    <button onClick={() => onUpdate(file)} className="px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700">Save</button>
                </div>
            </div>
        </div>
    );
};

export default EditModal;