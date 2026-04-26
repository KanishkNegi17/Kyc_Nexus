import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Signup from './components/Signup'; // <-- New Import
import MerchantPortal from './components/MerchantPortal';
import ReviewerDashboard from './components/ReviewerDashboard';

function App() {
  const isAuthenticated = !!localStorage.getItem('token');

  return (
    <Router>
      <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
        <header className="bg-white shadow-sm p-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-600">KYC Service Portal</h1>
          {isAuthenticated && (
            <button 
              onClick={() => { localStorage.clear(); window.location.href='/'; }}
              className="text-sm text-gray-500 hover:text-gray-800"
            >
              Logout
            </button>
          )}
        </header>

        <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Login />} />
            <Route path="/signup" element={<Signup />} /> {/* <-- New Route */}
            
            {/* Protected Routes */}
            <Route 
              path="/merchant" 
              element={isAuthenticated ? <MerchantPortal /> : <Navigate to="/" />} 
            />
            <Route 
              path="/reviewer" 
              element={isAuthenticated ? <ReviewerDashboard /> : <Navigate to="/" />} 
            />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;