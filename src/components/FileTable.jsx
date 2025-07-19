import React from 'react';

const FileTable = ({ files, onFileDelete, onEditFile, onDeleteFile, recentUploadUrl, selectedFileIds, setSelectedFileIds, onOpenCreateList }) => {
    return (
        <div className="overflow-x-auto bg-white rounded-xl shadow border border-slate-200 p-4">
            <h2 className="text-lg font-bold mb-4">Files</h2>
            {recentUploadUrl && (
                <div className="mb-4 p-2 bg-sky-100 border border-sky-300 rounded text-sky-800">Recent upload: <a href={recentUploadUrl} className="underline" target="_blank" rel="noopener noreferrer">{recentUploadUrl}</a></div>
            )}
            <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">File Name</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                    {files && files.length > 0 ? (
                        files.map((file) => (
                            <tr key={file.fileId || file.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{file.name || file.fileName || 'Untitled'}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                    <button onClick={() => onEditFile(file)} className="text-sky-600 hover:text-sky-900 mr-4">Edit</button>
                                    <button onClick={() => onDeleteFile(file)} className="text-red-600 hover:text-red-900">Delete</button>
                                </td>
                            </tr>
                        ))
                    ) : (
                        <tr>
                            <td colSpan="2" className="px-6 py-4 text-center text-slate-500">No files found.</td>
                        </tr>
                    )}
                </tbody>
            </table>
            <button onClick={onOpenCreateList} className="mt-4 px-4 py-2 bg-sky-600 text-white rounded hover:bg-sky-700">Create List from Selected</button>
        </div>
    );
};

export default FileTable;