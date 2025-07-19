// --- /src/pages/admin/AdminUserDetail.jsx ---
import React from 'react';
import { useParams } from 'react-router-dom';
const AdminUserDetail = () => {
    const { userId } = useParams();
    return (
        <div><h1 className="text-2xl font-bold">Files and Lists for User:</h1><p className="text-slate-600">{userId}</p></div>
    );
};
export default AdminUserDetail;