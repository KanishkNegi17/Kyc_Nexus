import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    
    try {
      // 1. Send credentials to Django
      const response = await api.post('/login/', {
        username: username,
        password: password
      });

      // 2. Save the returned Token securely
      localStorage.setItem('token', response.data.token);

      // 3. Route based on role (Simple check for our testing setup)
      if (username === 'admin') {
        navigate('/reviewer');
      } else {
        navigate('/merchant');
      }
      
      // Force a quick refresh to update the global isAuthenticated state in App.jsx
      window.location.reload();
      
    } catch (err) {
      console.error("Login failed:", err);
      setError('Invalid credentials. Please check your username and password.');
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 bg-white p-8 border border-gray-200 rounded-lg shadow-sm">
      <h2 className="text-2xl font-bold text-center text-gray-800 mb-6">Portal Login</h2>
      
      {error && (
        <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm text-center">
          {error}
        </div>
      )}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input 
            type="text" 
            className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input 
            type="password" 
            className="w-full border border-gray-300 p-2 rounded focus:ring-2 focus:ring-blue-500 outline-none"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button 
          type="submit" 
          className="w-full bg-blue-600 text-white font-semibold py-2 rounded hover:bg-blue-700 transition duration-200"
        >
          Sign In
        </button>
      </form>
      {/* Add this block right below your </form> tag */}
      <div className="mt-4 text-center text-sm">
        <span className="text-gray-600">Don't have an account? </span>
        <Link to="/signup" className="text-blue-600 hover:underline font-semibold">Sign up here</Link>
      </div>
    </div>
  );
}