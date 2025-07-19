import React from 'react';

const ListsTable = ({ lists, onEditList, onDeleteList }) => {
     if (lists.length === 0) {
        return (
            <div className="bg-white p-6 rounded-xl shadow-lg text-center border border-slate-200">
                <h3 className="text-xl font-bold text-slate-800 mb-2">My Lists</h3>
                <p className="text-slate-500">You haven't created any lists yet. Go to "My Files" to select some files and create a new list.</p>
            </div>
        );
    }
    return (
         <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
            <h3 className="text-xl font-bold text-slate-800 mb-4">My Lists</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Created</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider"># of Files</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Link</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Expires</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Protection</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                     <tbody className="bg-white divide-y divide-slate-200">
                        {lists.map((list, index) => (
                            <tr key={index}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{new Date(list.createdAt).toLocaleDateString()}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{list.fileCount}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500"><a href={list.shortUrl} target="_blank" className="text-sky-600 hover:text-sky-800 font-semibold">View List</a></td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{list.expireDate || 'Never'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                                    {list.passcode ? 
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-yellow-100 text-yellow-800">Passcode</span> : 
                                        <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">None</span>}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 flex items-center space-x-3">
                                    <button onClick={() => onEditList(list)} title="Edit" className="text-slate-400 hover:text-sky-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                    </button>
                                    <button onClick={() => onDeleteList(list)} title="Delete" className="text-slate-400 hover:text-red-600">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default ListsTable;