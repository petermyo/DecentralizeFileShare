// --- /src/pages/LoginScreen.jsx ---
import React from 'react';

const LoginScreen = () => {
  return (
    <div className="text-center max-w-4xl mx-auto mt-10 md:mt-16 p-8 animate-fade-in">
        <h1 className="text-6xl md:text-8xl font-bold text-theme-primary mb-4 tracking-tighter">ဒီဖိုင်</h1>
        <h2 className="text-2xl md:text-3xl font-medium text-slate-700 mb-6">Your Files, Your Privacy, Your Drive.</h2>
        <p className="text-slate-600 max-w-2xl mx-auto mb-10">
            Securely store files on your own Google Drive and create beautiful, shareable links.
            <span className="font-semibold text-theme-primary"> ဒီဖိုင်</span> enhances your file sharing to be better & more secure.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left mb-12">
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200"><h4 className="font-bold text-slate-800 mb-2">Complete Control</h4><p className="text-sm text-slate-600">Files are stored in a dedicated folder on your own Google Drive, not our servers.</p></div>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200"><h4 className="font-bold text-slate-800 mb-2">Large File Support</h4><p className="text-sm text-slate-600">Upload any file up to 5TB, with a generous 750GB daily limit.</p></div>
            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200"><h4 className="font-bold text-slate-800 mb-2">Secure Sharing</h4><p className="text-sm text-slate-600">Protect your links with optional passcodes and expiration dates.</p></div>
        </div>

        <a href="/api/auth/google/login" className="inline-block bg-theme-primary hover:bg-theme-secondary text-white font-bold py-4 px-10 rounded-lg transition duration-300 ease-in-out transform hover:scale-105 text-lg shadow-xl hover:shadow-2xl">
          Login with Google & Share Instantly
        </a>
    </div>
  );
};
export default LoginScreen;
