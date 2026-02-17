import { useState } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../api/client';

export default function ForgotPassword() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage('');
        setError('');
        setLoading(true);

        try {
            await apiClient.post('/auth/forgot-password', { email });
            setMessage('Si un compte correspond à cet email, un lien de réinitialisation a été envoyé.');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Une erreur est survenue.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8">
                <div className="text-center">
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900">Mot de passe oublié</h2>
                    <p className="mt-2 text-sm text-gray-600">
                        Saisissez votre email pour recevoir un lien de réinitialisation.
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {message && (
                        <div className="rounded-md bg-green-50 p-4 border border-green-200">
                            <p className="text-sm text-green-800">{message}</p>
                        </div>
                    )}
                    {error && (
                        <div className="rounded-md bg-red-50 p-4 border border-red-200">
                            <p className="text-sm text-red-800">{error}</p>
                        </div>
                    )}
                    <div>
                        <label htmlFor="email-address" className="sr-only">Email</label>
                        <input
                            id="email-address"
                            name="email"
                            type="email"
                            required
                            className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                            placeholder="Email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                        >
                            {loading ? 'Envoi...' : 'Envoyer le lien'}
                        </button>
                    </div>
                    <div className="text-center">
                        <Link to="/login" className="text-sm font-medium text-blue-600 hover:text-blue-500">
                            Retour à la connexion
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
