import React, { useState, useRef } from 'react';

const UploadForm = ({ addFileToList, setRecentUploadUrl, onBatchComplete }) => {
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [passcode, setPasscode] = useState('');
    const [expireDate, setExpireDate] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [error, setError] = useState('');
    const [uploadProgress, setUploadProgress] = useState({});
    const [dragActive, setDragActive] = useState(false);
    const [lastResults, setLastResults] = useState([]);
    const inputRef = useRef(null);
    
    const handleFileChange = (files) => {
        if (files && files.length > 0) {
            setSelectedFiles(Array.from(files));
            setLastResults([]);
            setError('');
            setUploadProgress({});
        }
    }
    
    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") {
            setDragActive(true);
        } else if (e.type === "dragleave") {
            setDragActive(false);
        }
    };
    
    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileChange(e.dataTransfer.files);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (selectedFiles.length === 0) {
            setError('Please select one or more files to upload.');
            return;
        }
        setIsUploading(true);
        setError('');
        setLastResults([]);
        
        try {
            const filesToInitiate = selectedFiles.map(f => ({ fileName: f.name, fileType: f.type }));
            const initResponse = await fetch('/api/upload/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ files: filesToInitiate })
            });
            if (!initResponse.ok) throw new Error('Could not start upload session.');
            const { sessions } = await initResponse.json();

            const uploadPromises = sessions.map(session => {
                const file = selectedFiles.find(f => f.name === session.originalName);
                return new Promise((resolve, reject) => {
                     const xhr = new XMLHttpRequest();
                    xhr.open('PUT', session.uploadUrl, true);
                    xhr.setRequestHeader('Content-Type', file.type);
                    xhr.upload.onprogress = (event) => {
                        if (event.lengthComputable) {
                            const percent = Math.round((event.loaded / event.total) * 100);
                            setUploadProgress(prev => ({ ...prev, [file.name]: percent }));
                        }
                    };
                    xhr.onload = () => {
                        if (xhr.status === 200 || xhr.status === 201) {
                            fetch(session.uploadUrl, { 
                                method: 'PUT', 
                                headers: { 'Content-Range': `bytes */${file.size}` }
                            })
                            .then(res => res.json())
                            .then(finalState => resolve({ uploadedFile: finalState, session, file }))
                            .catch(reject);
                        } else {
                            reject(new Error(`Upload failed for ${file.name} with status: ${xhr.status}`));
                        }
                    };
                    xhr.onerror = () => reject(new Error(`Network error during upload for ${file.name}.`));
                    xhr.send(file);
                });
            });

            const settledUploads = await Promise.allSettled(uploadPromises);
            
            const newFileIds = [];
            const newResults = [];
            for (const result of settledUploads) {
                if (result.status === 'fulfilled') {
                    const { uploadedFile, session, file } = result.value;
                    const finalizeResponse = await fetch('/api/upload/finalize', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            fileId: uploadedFile.id, fileName: session.newFileName, originalName: file.name,
                            passcode, expireDate, fileSize: file.size
                        })
                    });
                    const finalResult = await finalizeResponse.json();
                    if (finalizeResponse.ok) {
                        addFileToList(finalResult.fileMeta);
                        setRecentUploadUrl(finalResult.shortUrl);
                        newResults.push(finalResult);
                        newFileIds.push(finalResult.fileMeta.fileId);
                    } else {
                        setError(prev => `${prev}\nFailed to finalize: ${file.name}`);
                    }
                } else {
                     setError(prev => `${prev}\n${result.reason.message}`);
                }
            }

            setLastResults(newResults);
            if (newFileIds.length > 0) {
                onBatchComplete(newFileIds);
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setIsUploading(false);
            setSelectedFiles([]);
            setPasscode('');
            setExpireDate('');
        }
    };

    return (
        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
            <h3 className="text-xl font-bold text-slate-800 mb-4">Upload New File(s)</h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div 
                    onDragEnter={handleDrag} 
                    onDragLeave={handleDrag} 
                    onDragOver={handleDrag} 
                    onDrop={handleDrop}
                    onClick={() => inputRef.current.click()}
                    className={`flex justify-center items-center w-full h-32 px-6 transition bg-slate-50 border-2 ${dragActive ? "border-sky-500" : "border-slate-300"} border-dashed rounded-lg cursor-pointer hover:border-sky-400`}>
                    <div className="space-y-1 text-center">
                        <svg className="mx-auto h-10 w-10 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true"><path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        <p className="text-sm text-slate-600">
                            <span className="font-semibold text-sky-600">Click to upload</span> or drag and drop
                        </p>
                        {selectedFiles.length > 0 ? 
                            <p className="text-xs text-slate-500">{selectedFiles.length} file(s) selected</p> :
                            <p className="text-xs text-slate-500">Any file up to 5TB</p>
                        }
                    </div>
                    <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => handleFileChange(e.target.files)} />
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-700">Passcode (Optional)</label>
                    <input type="password" value={passcode} onChange={e => setPasscode(e.target.value)} placeholder="Protect your file(s)" className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"/>
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700">Expiration Date (Optional)</label>
                    <input type="date" value={expireDate} onChange={e => setExpireDate(e.target.value)} className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-sky-500 focus:border-sky-500"/>
                </div>
                
                {error && <p className="text-sm text-red-600 p-2 bg-red-100 rounded-md whitespace-pre-wrap">{error}</p>}
                
                {isUploading && (
                    <div className="space-y-2">
                        {selectedFiles.map(file => (
                            <div key={file.name}>
                                <div className="flex justify-between text-sm text-slate-600">
                                    <p className="truncate w-4/5">{file.name}</p>
                                    <p>{uploadProgress[file.name] || 0}%</p>
                                </div>
                                <div className="w-full bg-slate-200 rounded-full h-2.5">
                                    <div className="bg-sky-500 h-2.5 rounded-full" style={{width: `${uploadProgress[file.name] || 0}%`}}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <button 
                    type="submit" 
                    disabled={isUploading || selectedFiles.length === 0} 
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-slate-400 disabled:text-slate-200"
                >
                    {isUploading ? 'Uploading...' : `Upload ${selectedFiles.length} File(s)`}
                </button>
                
                {lastResults.length > 0 && (
                    <div className="mt-4 p-3 bg-sky-100 border border-sky-300 rounded-md animate-fade-in space-y-2">
                        <label className="block text-sm font-medium text-sky-800">Upload(s) Complete!</label>
                        {lastResults.map((result, index) => (
                            <div key={index} className="flex rounded-md shadow-sm">
                                <input type="text" readOnly value={result.shortUrl} className="flex-1 block w-full rounded-none rounded-l-md sm:text-sm border-slate-300 bg-slate-50 text-slate-700 p-2"/>
                                <button type="button" onClick={() => navigator.clipboard.writeText(result.shortUrl)} className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200">
                                    Copy
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </form>
        </div>
    );
}

export default UploadForm;