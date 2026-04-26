import { useState, useEffect } from 'react';
import api from '../api';

export default function MerchantPortal() {
  const [step, setStep] = useState(1);
  const [submissionId, setSubmissionId] = useState(null);
  const [status, setStatus] = useState('draft');
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedFiles, setSelectedFiles] = useState({
   pan: null,             // Changed from IDENTITY_PROOF
   aadhaar: null,         // Changed from IDENTITY_PROOF
   bank_statement: null
});
  const [formData, setFormData] = useState({
    full_name: '', email: '', phone: '',
    business_name: '', business_type: '', expected_monthly_volume_usd: ''
  });

  // Fetch existing draft on component mount
  useEffect(() => {
    const fetchSubmission = async () => {
      try {
        const response = await api.get('/kyc/');
        if (response.data.length > 0) {
          const current = response.data[0]; // Get the most recent submission
          setSubmissionId(current.id);
          setStatus(current.status);
          setFormData({
            full_name: current.full_name || '',
            email: current.email || '',
            phone: current.phone || '',
            business_name: current.business_name || '',
            business_type: current.business_type || '',
            expected_monthly_volume_usd: current.expected_monthly_volume_usd || ''
          });
        }
      } catch (err) {
        console.error("Error fetching data", err);
      }
    };
    fetchSubmission();
  }, []);

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSaveDraft = async () => {
    setError(''); setSuccessMsg('');
    try {
      if (submissionId) {
        // Update existing draft
        await api.patch(`/kyc/${submissionId}/`, formData);
      } else {
        // Create new draft
        const response = await api.post('/kyc/', formData);
        setSubmissionId(response.data.id);
      }
      setSuccessMsg('Draft saved successfully!');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      setError('Failed to save draft.');
    }
  };

  const handleSubmit = async () => {
    setError(''); setSuccessMsg('');
    try {
      // First save the latest data
      await handleSaveDraft();
      await handleFileUpload();
      // Then trigger the state transition
      await api.post(`/kyc/${submissionId}/submit/`);
      setStatus('submitted');
      setSuccessMsg('KYC Submitted Successfully!');
    } catch (err) {
      let rawError = err.response?.data?.error || 'Validation failed. Please fill all fields.';
      
      // Make database field names user-friendly (e.g., "business_name" -> "Business Name")
      if (rawError.includes('Missing fields:')) {
        rawError = rawError
          .replace(/_/g, ' ') // Replace all underscores with spaces
          .replace(/\b\w/g, char => char.toUpperCase()); // Capitalize the first letter of each word
      }
      
      setError(rawError);
    }
  };

const handleFileUpload = async () => {
  // Map our local state names to the exact keys in your Django Model
  const typeMapping = {
    pan: 'pan',
    aadhaar: 'aadhaar',
    bank_statement: 'bank_statement'
  };

  for (const [key, file] of Object.entries(selectedFiles)) {
    // Only attempt upload if a file was actually selected
    if (file && file instanceof File) {
      const formData = new FormData();
      formData.append('submission', submissionId);
      
      // Use the mapping to ensure we send 'pan' or 'bank_statement'
      const djangoType = typeMapping[key]; 
      
      if (!djangoType) continue; // Skip if it's an old key like 'BUSINESS_REGISTRATION'

      formData.append('document_type', djangoType);
      formData.append('file', file);

      try {
        await api.post('/documents/', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
      } catch (err) {
        console.error(`Upload failed for ${djangoType}:`, err.response?.data);
        throw err;
      }
    }
  }
};

  // Lock the form if it's already in the review queue
  if (status === 'submitted' || status === 'under_review' || status === 'approved') {
    return (
      <div className="max-w-2xl mx-auto mt-10 bg-white p-8 border border-gray-200 rounded-lg shadow-sm text-center">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Submission Status: {status.toUpperCase()}</h2>
        <p className="text-gray-600">Your KYC application is currently in the system. You cannot edit it at this time.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto mt-10 bg-white p-8 border border-gray-200 rounded-lg shadow-sm">
        {status === 'more_info_requested' && (
            <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-6 shadow-sm">
                <p className="font-bold">Action Required</p>
                <p>The reviewer has requested more information. Please update your details and re-submit.</p>
            </div>
        )}
        {status === 'rejected' && (
            <div className="bg-orange-100 border-l-4 border-orange-500 text-orange-700 p-4 mb-6 shadow-sm">
                <p className="font-bold">Action Required</p>
                <p>The reviewer has rejected your form. Please correct your details and re-submit.</p>
            </div>
        )}
      <div className="flex justify-between items-center mb-8 border-b pb-4">
        <h2 className="text-2xl font-bold text-gray-800">KYC Application</h2>
        <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded text-sm font-semibold">Step {step} of 3</span>
      </div>

      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
      {successMsg && <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm">{successMsg}</div>}

      <div className="space-y-6">
        {step === 1 && (
          <div className="animate-fade-in">
            <h3 className="text-lg font-semibold mb-4 text-blue-600">Personal Details</h3>
            <div className="grid grid-cols-1 gap-4">
              <input type="text" name="full_name" value={formData.full_name} onChange={handleInputChange} placeholder="Full Name" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="email" name="email" value={formData.email} onChange={handleInputChange} placeholder="Email Address" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="text" name="phone" value={formData.phone} onChange={handleInputChange} placeholder="Phone Number" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <h3 className="text-lg font-semibold mb-4 text-blue-600">Business Details</h3>
            <div className="grid grid-cols-1 gap-4">
              <input type="text" name="business_name" value={formData.business_name} onChange={handleInputChange} placeholder="Business Name" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="text" name="business_type" value={formData.business_type} onChange={handleInputChange} placeholder="Business Type (e.g., LLC, Sole Proprietor)" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" />
              <input type="number" name="expected_monthly_volume_usd" value={formData.expected_monthly_volume_usd} onChange={handleInputChange} placeholder="Expected Monthly Volume (USD)" className="w-full border p-2 rounded outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>
        )}

        {step === 3 && (
  <div className="animate-fade-in">
    <h3 className="text-lg font-semibold mb-4 text-blue-600">Document Uploads</h3>
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Pan card</label>
        <input 
          type="file" 
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setSelectedFiles({...selectedFiles, pan: e.target.files[0]})}
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Aadhar Card</label>
        <input 
          type="file" 
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setSelectedFiles({...selectedFiles, aadhaar: e.target.files[0]})}
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Bank Statement</label>
        <input 
          type="file" 
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={(e) => setSelectedFiles({...selectedFiles, bank_statement: e.target.files[0]})}
          className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
        />
      </div>
    </div>
  </div>
)}
      </div>

      <div className="mt-8 flex justify-between pt-4 border-t">
        <div>
          {step > 1 && (
            <button onClick={() => setStep(step - 1)} className="text-gray-600 font-semibold px-4 py-2 rounded hover:bg-gray-100 transition">Back</button>
          )}
        </div>
        <div className="space-x-3">
          <button onClick={handleSaveDraft} className="bg-gray-200 text-gray-800 font-semibold px-4 py-2 rounded hover:bg-gray-300 transition">Save Draft</button>
          
          {step < 3 ? (
            <button onClick={() => setStep(step + 1)} className="bg-blue-600 text-white font-semibold px-4 py-2 rounded hover:bg-blue-700 transition">Next</button>
          ) : (
            <button onClick={handleSubmit} className="bg-green-600 text-white font-semibold px-6 py-2 rounded hover:bg-green-700 transition shadow-sm">Submit for Review</button>
          )}
        </div>
      </div>
    </div>
  );
}