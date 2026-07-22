import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import { Mail, Lock, User, ShieldAlert, Eye, EyeOff, ChevronDown } from 'lucide-react';

export const Register: React.FC = () => {
  const { registerUser, error, clearError, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('ENGINEER');
  const [experienceLevel, setExperienceLevel] = useState('UNKNOWN');
  
  const [formError, setFormError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    clearError();
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!name || !email || !password) {
      setFormError('Please fill in all required fields.');
      return;
    }

    if (name.trim().length < 2) {
      setFormError('Name must be at least 2 characters long.');
      return;
    }

    if (password.length < 6) {
      setFormError('Password must be at least 6 characters long.');
      return;
    }

    try {
      await registerUser(email, name, password, role, experienceLevel);
      navigate('/dashboard');
    } catch (err: any) {
      // Handled by context
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="w-full max-w-lg flex flex-col items-center">
        {/* Header */}
        <div className="flex flex-col items-center gap-2 mb-8 text-center">
          <h1 className="font-extrabold text-3xl tracking-tight text-slate-900">
            Create an Account on <span className="text-blue-600">INDRA</span>
          </h1>
          <p className="text-slate-500 text-sm">
            Sign up to access core operations and intelligence dashboards.
          </p>
        </div>

        {/* Panel Card */}
        <div className="w-full bg-white border border-slate-200 rounded-2xl shadow-xl p-8 md:p-10">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Error handling alert */}
            {(formError || error) && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-sm">
                <ShieldAlert className="h-5 w-5 shrink-0 mt-0.5" />
                <span>{formError || error}</span>
              </div>
            )}

            {/* Grid for credentials */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Name Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Full Name</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="h-4 w-4" />
                  </div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
                    required
                  />
                </div>
              </div>

              {/* Email Input */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Email Address</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="h-4 w-4" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@company.com"
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
                    required
                  />
                </div>
              </div>
            </div>

            {/* Password Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="h-4 w-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full pl-10 pr-10 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 text-sm focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Grid for dropdown roles & levels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Role Dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Security Role</label>
                <div className="relative">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm appearance-none cursor-pointer focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all pr-10"
                  >
                    <option value="ENGINEER">Engineer (Workspace)</option>
                    <option value="MANAGER">Manager (Intelligence)</option>
                    <option value="ADMIN">System Administrator</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>

              {/* Experience Dropdown */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700">Experience Level</label>
                <div className="relative">
                  <select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-900 text-sm appearance-none cursor-pointer focus:outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-600/20 transition-all pr-10"
                  >
                    <option value="SENIOR">Senior Specialist (0.9)</option>
                    <option value="JUNIOR">Junior Assistant (0.6)</option>
                    <option value="UNKNOWN">Unspecified / Guest (0.3)</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none text-slate-400">
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </div>
              </div>
            </div>

            {/* Register Action button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-4 rounded-xl shadow-md shadow-blue-500/10 transition-all duration-200 disabled:opacity-50 text-sm tracking-wide active:scale-[0.99]"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Creating Account...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          {/* Prompt to login */}
          <div className="text-center mt-6 text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold underline underline-offset-4">
              Sign in here
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
