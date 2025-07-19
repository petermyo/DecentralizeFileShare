import React, { useState } from 'react';

const EditListModal = ({ list, onClose, onUpdate }) => {
    const [passcode, setPasscode] = useState(list.passcode || '');
    const [expireDate, setExpireDate] = useState(list.expireDate || '');
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setError('');
        try {
            const response = await fetch('/api/lists/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shortUrl: list.shortUrl,
                    passcode: passcode,
                    expireDate: expireDate
                })
            });
            if (!response.ok) throw new Error('Failed to update list.');
            onUpdate({ ...list, passcode: !!passcode, expireDate: expireDate });
        } catch(err) {
            setError(err.message);
        } finally {
            setIsSaving(false);
        }
    };
    
    return (
         <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 animate-fade-in">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold text-gray-800 mb-4">Edit List</h3>
                <p className="text-sm text-slate-600 mb-4">You are editing a list with {list.fileCount} file(s).</p>
                <form onSubmit={handleSave} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Passcode (Optional)</label>
                        <input type="text" value={passcode} onChange={e => setPasscode(e.target.value)} placeholder="Leave blank to remove" className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Expiration Date (Optional)</label>
                        <input type="date" value={expireDate} onChange={e => setExpireDate(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"/>
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                    <div className="flex justify-end space-x-3 pt-4">
                        <button type="button" onClick={onClose} className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-semibold py-2 px-4 rounded-lg text-sm transition">Cancel</button>
                        <button type="submit" disabled={isSaving} className="bg-sky-600 hover:bg-sky-700 text-white font-semibold py-2 px-4 rounded-lg text-sm transition disabled:bg-slate-400">
                            {isSaving ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    )
};

export default EditListModal;