import React from 'react';

const ListsTable = ({ lists, onEditList, onDeleteList }) => {
    return (
        <div className="overflow-x-auto bg-white rounded-xl shadow border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">List Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Created</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Files</th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                    {lists && lists.length > 0 ? (
                        lists.map((list) => (
                            <tr key={list.shortUrl || list.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{list.name || list.title || 'Untitled'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{list.createdAt ? new Date(list.createdAt).toLocaleString() : '-'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">{list.fileIds ? list.fileIds.length : (list.files ? list.files.length : 0)}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button onClick={() => onEditList(list)} className="text-sky-600 hover:text-sky-900 mr-4">Edit</button>
                                    <button onClick={() => onDeleteList(list)} className="text-red-600 hover:text-red-900">Delete</button>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="4" className="px-6 py-4 text-center text-slate-500">No lists found.</td>
                        </tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

export default ListsTable;