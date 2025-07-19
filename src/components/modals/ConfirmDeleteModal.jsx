import React, { useState } from 'react';

const ConfirmDeleteModal = ({ file, onClose, onConfirm }) => {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const response = await fetch('/api/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileId: file.fileId, shortUrl: file.shortUrl })
            });
            if (!response.ok) {
                throw new Error('Failed to delete the file.');
            }
            onConfirm();
        } catch (err) {
            alert(err.message);
            setIsDeleting(false);
        }
    };

    return (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold text-gray-800">Confirm Deletion</h3>
                <p className="my-4 text-gray-600">Are you sure you want to delete <span className="font-semibold">{file.fileName}</span>? This action cannot be undone.</p>
                <div className="flex justify-end space-x-3">
                    <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2 px-4 rounded-lg text-sm transition">Cancel</button>
                    <button onClick={handleDelete} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition disabled:bg-slate-400">
                        {isDeleting ? 'Deleting...' : 'Delete File'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmDeleteModal;