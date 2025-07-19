import React from 'react';

const ConfirmDeleteModal = ({ file, item, type, onClose, onConfirm }) => {
    const label = file ? (file.name || file.fileName || 'Untitled') : (item ? (item.name || item.title || 'Untitled') : '');
    return (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
            <div className="bg-white p-6 rounded shadow-lg min-w-[300px]">
                <h2 className="text-lg font-bold mb-4">Confirm Delete</h2>
                <p className="mb-4">Are you sure you want to delete {type || 'this item'}: <span className="font-semibold">{label}</span>?</p>
                <div className="flex justify-end space-x-2">
                    <button onClick={onClose} className="px-4 py-2 bg-slate-300 rounded hover:bg-slate-400">Cancel</button>
                    <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">Delete</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDeleteModal;