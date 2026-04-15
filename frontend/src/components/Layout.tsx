import { useState, useRef, useEffect } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { useAuthStore } from '../store/useAuthStore';
import ChangePasswordModal from './ChangePasswordModal';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { fetchWorkers, fetchPosts } = useStore();
  const { isFullScreen } = useStore();
  const { logout } = useAuthStore();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchWorkers();
    fetchPosts();
  }, [fetchWorkers, fetchPosts]);

  useEffect(() => {
    setDropdownOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 flex flex-col">
      {!isFullScreen && (
        <nav className="bg-white shadow-sm border-b w-full shrink-0">
          <div className="w-full px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center" ref={dropdownRef}>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setDropdownOpen((v) => !v)}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 border border-gray-300 rounded-md"
                  >
                    Paramètres
                    <svg className="ml-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {dropdownOpen && (
                    <div className="absolute left-0 mt-1 w-56 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-50">
                      <Link
                        to="/"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setDropdownOpen(false)}
                      >
                        Plan de travail
                      </Link>
                      <Link
                        to="/work-allocation"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setDropdownOpen(false)}
                      >
                        Booking
                      </Link>
                      <Link
                        to="/worker-types"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setDropdownOpen(false)}
                      >
                        Quart de travail
                      </Link>
                      <Link
                        to="/documentation"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setDropdownOpen(false)}
                      >
                        Documentation
                      </Link>
                      <Link
                        to="/machinery-checkup"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setDropdownOpen(false)}
                      >
                        Inspection des engins roulant
                      </Link>
                      <Link
                        to="/admin"
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                        onClick={() => setDropdownOpen(false)}
                      >
                        Administration
                      </Link>
                      <div className="border-t border-gray-100 my-1"></div>
                      <button
                        onClick={() => {
                          setShowChangePassword(true);
                          setDropdownOpen(false);
                        }}
                        className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      >
                        Changer mon mot de passe
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center">
                <button
                  onClick={handleLogout}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Déconnexion
                </button>
              </div>
            </div>
          </div>
        </nav>
      )}
      <main className={`w-full flex-1 min-w-0 ${isFullScreen ? 'p-2' : 'py-6 px-4 sm:px-6 lg:px-8'}`}>
        <Outlet />
      </main>

      {showChangePassword && (
        <ChangePasswordModal onClose={() => setShowChangePassword(false)} />
      )}
    </div>
  );
}

