import React, { useState } from 'react';

const CreateListModal = ({ fileIds, onClose, onCreated }) => {
    const [passcode, setPasscode] = useState('');
    const [expireDate, setExpireDate] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setError('');
        try {
            const response = await fetch('/api/lists/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fileIds, passcode, expireDate })
            });
            if (!response.ok) throw new Error('Failed to create list.');
            onCreated();
        } catch(err) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Create New File List</h3>
                <p className="text-sm text-slate-600 mb-4">You are creating a shared list with {fileIds.length} file(s). You can set a passcode and expiration date for the entire list.</p>
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Passcode (Optional)</label>
                        <input type="password" value={passcode} onChange={e => setPasscode(e.target.value)} placeholder="Protect this list" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Expiration Date (Optional)</label>
                        <input type="date" value={expireDate} onChange={e => setExpireDate(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"/>
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2 px-4 rounded-lg text-sm transition">Cancel</button>
                        <button type="submit" disabled={isSaving} className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition disabled:bg-slate-400">
                            {isSaving ? 'Creating...' : 'Create List'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
}

export default CreateListModal;