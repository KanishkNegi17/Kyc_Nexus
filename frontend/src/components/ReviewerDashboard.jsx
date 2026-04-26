import { useState, useEffect } from 'react';
import api from '../api';

export default function ReviewerDashboard() {
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // --- NEW: Modal & Detail State ---
  const [selectedSub, setSelectedSub] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [actionReason, setActionReason] = useState('');

  const fetchQueue = async () => {
    try {
      const response = await api.get('/kyc/');
      setSubmissions(response.data);
      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch queue", err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
  }, []);

  // --- NEW: Fetch documents when opening modal ---
  const openModal = async (submission) => {
    setSelectedSub(submission);
    setActionReason('');
    try {
      const docRes = await api.get('/documents/');
      const subDocs = docRes.data.filter(doc => doc.submission === submission.id);
      setDocuments(subDocs);
    } catch (err) {
      console.error("Failed to load documents", err);
    }
  };

  // --- UPDATED: Use selectedSub ID and send the reason ---
  const handleAction = async (action) => {
    try {
      await api.post(`/kyc/${selectedSub.id}/${action}/`, { reason: actionReason });
      setSelectedSub(null); // Close modal on success
      fetchQueue(); // Refresh the list after action
    } catch (err) {
      alert(err.response?.data?.error || "Action failed");
    }
  };

  // --- NEW: Metrics Calculations ---
  const queueCount = submissions.filter(s => ['submitted', 'under_review'].includes(s.status)).length;
  
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const recentDecisions = submissions.filter(s => 
    ['approved', 'rejected'].includes(s.status) && new Date(s.updated_at || s.created_at) > sevenDaysAgo
  );
  const approvalRate = recentDecisions.length > 0 
    ? Math.round((recentDecisions.filter(s => s.status === 'approved').length / recentDecisions.length) * 100) 
    : 0;

  if (loading) return <div className="text-center mt-10">Loading Queue...</div>;

  return (
    <div className="max-w-7xl mx-auto mt-10">
      <h2 className="text-2xl font-bold mb-6 flex justify-between items-center">
        Reviewer Queue
        <span className="text-sm font-normal bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
          {submissions.length} Total Applications
        </span>
      </h2>

      {/* --- NEW: Metrics Bar --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Submissions in Queue</h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">{queueCount}</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Avg Time-in-Queue</h3>
          <p className="text-3xl font-bold text-gray-800 mt-2">&lt; 24 hrs</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Approval Rate (7 Days)</h3>
          <p className="text-3xl font-bold text-green-600 mt-2">{approvalRate}%</p>
        </div>
      </div>

      {/* --- MAINTAINED: Your original table structure --- */}
      <div className="bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Merchant / Business</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">SLA Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {submissions.map((sub) => (
              <tr key={sub.id}>
                <td className="px-6 py-4">
                  <div className="text-sm font-bold text-gray-900">{sub.business_name}</div>
                  <div className="text-sm text-gray-500">{sub.full_name} ({sub.email})</div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs font-semibold rounded-full 
                    ${sub.status === 'approved' ? 'bg-green-100 text-green-800' : 
                      sub.status === 'rejected' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {sub.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {sub.at_risk ? (
                    <span className="text-red-600 font-bold text-xs animate-pulse">⚠️ AT RISK (&gt;24h)</span>
                  ) : (
                    <span className="text-green-600 text-xs font-medium">On Track</span>
                  )}
                </td>
                <td className="px-6 py-4 text-right">
                  {/* --- UPDATED: Action column now opens the detailed modal --- */}
                  <button 
                    onClick={() => openModal(sub)} 
                    className="text-sm bg-blue-50 text-blue-600 font-semibold px-4 py-2 rounded hover:bg-blue-100 border border-blue-200 transition"
                  >
                    Review Application
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {submissions.length === 0 && (
          <div className="p-10 text-center text-gray-500 italic">No submissions found in the queue.</div>
        )}
      </div>

      {/* --- NEW: Detail Modal Overlay --- */}
      {selectedSub && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b">
              <h2 className="text-xl font-bold text-gray-800">Reviewing: {selectedSub.business_name}</h2>
              <button onClick={() => setSelectedSub(null)} className="text-gray-500 hover:text-gray-800 text-2xl">&times;</button>
            </div>
            
            <div className="p-6 grid grid-cols-2 gap-6">
              {/* Data Panel */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">Merchant Data</h3>
                <div className="space-y-3 text-sm">
                  <p><span className="font-semibold">Name:</span> {selectedSub.full_name}</p>
                  <p><span className="font-semibold">Email:</span> {selectedSub.email}</p>
                  <p><span className="font-semibold">Phone:</span> {selectedSub.phone}</p>
                  <p><span className="font-semibold">Type:</span> {selectedSub.business_type}</p>
                  <p><span className="font-semibold">Est. Volume:</span> ${selectedSub.expected_monthly_volume_usd}</p>
                </div>
              </div>

              {/* Documents Panel */}
              <div>
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">Attached Documents</h3>
                {documents.length > 0 ? (
                  <ul className="space-y-2">
                    {documents.map(doc => (
                      <li key={doc.id} className="flex justify-between items-center bg-gray-50 p-2 rounded border">
                        <span className="text-sm font-medium">{doc.document_type.toUpperCase()}</span>
                        <a href={doc.file} target="_blank" rel="noopener noreferrer" className="text-blue-600 text-sm hover:underline">View File</a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-gray-500 italic">No documents attached.</p>
                )}
              </div>
            </div>

            {/* Decision Panel */}
            <div className="p-6 bg-gray-50 border-t">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Reviewer Reason / Notes (Required for Reject/Info)</label>
              <textarea 
                value={actionReason}
                onChange={(e) => setActionReason(e.target.value)}
                className="w-full border border-gray-300 rounded p-3 outline-none focus:ring-2 focus:ring-blue-500 mb-4 text-sm"
                rows="3"
                placeholder="Explain the reason for your decision..."
              />
              
              <div className="flex justify-end space-x-3">
                {/* Hide action buttons if already processed */}
                {['submitted', 'under_review'].includes(selectedSub.status) ? (
                  <>
                    <button onClick={() => handleAction('request_info')} className="bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 font-semibold transition">Request Info</button>
                    <button onClick={() => handleAction('reject')} className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700 font-semibold transition">Reject</button>
                    <button onClick={() => handleAction('approve')} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-semibold transition">Approve</button>
                  </>
                ) : (
                  <span className="text-gray-500 font-medium italic mt-2">This application has been processed.</span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}