import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import apiClient from '../api/client';
import { useStore } from '../store/useStore';
import { Booking, BookingReplacement, WorkerType, WorkerTypeLabels } from '../types';
import { formatLocalDate } from '../utils/dateUtils';
import { useAuthStore } from '../store/useAuthStore';

export default function PremiumState() {
    const [searchParams] = useSearchParams();
    const planId = searchParams.get('planId');

    const { posts, plans, fetchPlans, fetchPosts } = useStore();
    const [bookings, setBookings] = useState<Booking[]>([]);
    const [replacements, setReplacements] = useState<BookingReplacement[]>([]);
    const [loading, setLoading] = useState(false);
    const [isInitialized, setIsInitialized] = useState(false);
    const { user } = useAuthStore();

    // Date range state
    const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

    // Fetch initial data once
    useEffect(() => {
        fetchPlans();
        fetchPosts();
        apiClient.get<Booking[]>('/bookings').then(res => setBookings(res.data || []));
    }, [fetchPlans, fetchPosts]);

    // Initialize dates from planId
    useEffect(() => {
        if (planId && plans.length > 0 && !isInitialized) {
            const p = plans.find(plan => plan.id === planId);
            if (p?.date) {
                const d = new Date(p.date).toISOString().split('T')[0];
                setStartDate(d);
                setEndDate(d);
                setIsInitialized(true);
            }
        }
    }, [planId, plans, isInitialized]);

    // Find the "Current Booking" - defined as the latest active one
    const currentBooking = useMemo(() => {
        if (bookings.length === 0) return null;
        const active = bookings.find(b => b.isActive);
        if (active) return active;
        // Fallback to most recent by effectiveDate
        return [...bookings].sort((a, b) =>
            new Date(b.effectiveDate).getTime() - new Date(a.effectiveDate).getTime()
        )[0];
    }, [bookings]);

    useEffect(() => {
        if (currentBooking) {
            setLoading(true);
            apiClient.get<BookingReplacement[]>(`/bookings/${currentBooking.id}/replacements`)
                .then(res => setReplacements(res.data || []))
                .catch(() => setReplacements([]))
                .finally(() => setLoading(false));
        }
    }, [currentBooking?.id]);

    // Posts that qualify for premiums (have any replacement configured in the master booking)
    const premiumPostIds = useMemo(() => {
        return replacements
            .filter(r =>
                r.replacement1WorkerId || r.replacement2WorkerId || r.replacement3WorkerId || r.replacement4WorkerId ||
                r.replacement5WorkerId || r.replacement6WorkerId || r.replacement7WorkerId || r.replacement8WorkerId
            )
            .map(r => r.postId);
    }, [replacements]);

    // Filter plans in range
    const plansInRange = useMemo(() => {
        return plans.filter(p => {
            if (!p.date) return false;
            const pdString = new Date(p.date).toISOString().split('T')[0];
            return pdString >= startDate && pdString <= endDate;
        }).sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime());
    }, [plans, startDate, endDate]);

    // Generate table data: who worked on premium posts for each day
    const reportData = useMemo(() => {
        const rows: any[] = [];
        plansInRange.forEach(plan => {
            const planAssignments = plan.assignments || [];
            premiumPostIds.forEach(postId => {
                const post = posts.find(p => p.id === postId);
                const assignmentsOnPost = planAssignments.filter(a => a.postId === postId);

                if (assignmentsOnPost.length > 0) {
                    assignmentsOnPost.forEach(a => {
                        rows.push({
                            date: plan.date,
                            planName: plan.name,
                            postName: post?.name || postId,
                            workerName: a.worker?.name || 'Inconnu',
                            matricule: a.worker?.anciennete || '-',
                            type: a.worker?.type || WorkerType.PERMANENT_JOUR,
                            shift: (a.worker?.type && (a.worker.type.includes('SOIR') || a.worker.type === 'SOIR')) ? 'Soir' : 'Jour'
                        });
                    });
                } else {
                    // Even if no one worked there, we might want to show it as empty?
                    // User said "check all the people who worked", so we only show worked.
                }
            });
        });
        return rows;
    }, [plansInRange, premiumPostIds, posts]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="p-6 max-w-6xl mx-auto min-h-screen">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 no-print gap-4">
                <div className="flex items-center gap-4">
                    <Link to="/" className="p-2 text-gray-400 hover:text-gray-900 transition-colors">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </Link>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">État de Prime</h1>
                </div>

                <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Du</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="text-sm border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Au</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="text-sm border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>

                    <button
                        onClick={async () => {
                            setLoading(true);
                            await fetchPlans();
                            // Small delay to ensure state updates if needed
                            setTimeout(() => setLoading(false), 300);
                        }}
                        className="flex items-center gap-2 px-6 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 transition-all shadow-md active:scale-95"
                    >
                        <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        Générer
                    </button>

                    {user?.canPrint && (
                        <button
                            onClick={handlePrint}
                            className="ml-auto flex items-center gap-2 px-5 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-all shadow-indigo-200 shadow-lg active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            Imprimer
                        </button>
                    )}
                </div>
            </div>

            <div className="print-section bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
                <div className="p-8 bg-gradient-to-r from-gray-50 to-white border-b border-gray-200">
                    <div className="flex justify-between items-start">
                        <div>
                            <h2 className="text-2xl font-extrabold text-gray-900 mb-1">Résumé de l&apos;État de Prime</h2>
                            <p className="text-gray-500 text-sm">Basé sur les postes à remplacement du booking : <span className="text-indigo-600 font-semibold">{currentBooking?.name || 'Inconnu'}</span></p>
                        </div>
                        <div className="text-right">
                            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Période du Rapport</div>
                            <div className="text-gray-900 font-medium">
                                {formatLocalDate(startDate)} — {formatLocalDate(endDate)}
                            </div>
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="p-20 text-center">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-4"></div>
                        <p className="text-gray-500 animate-pulse font-medium">Traitement des données de présence...</p>
                    </div>
                ) : reportData.length === 0 ? (
                    <div className="p-20 text-center">
                        <div className="bg-gray-50 inline-flex p-4 rounded-full mb-4">
                            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                        <p className="text-gray-400 italic">Aucune donnée trouvée pour cette période. Assurez-vous que des plans existent pour les dates sélectionnées.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead>
                                <tr className="bg-gray-50">
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Poste</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Quart</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Nom du Travailleur</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Matricule</th>
                                    <th className="px-6 py-4 text-left text-xs font-bold text-gray-500 uppercase tracking-wider">Type</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {reportData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-indigo-50/30 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {formatLocalDate(row.date, 'fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-700">
                                            {row.postName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase ${row.shift === 'Soir' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {row.shift}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800 font-medium">
                                            {row.workerName}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            {row.matricule}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {WorkerTypeLabels[row.type as WorkerType] || row.type}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <div className="p-6 bg-gray-50 border-t border-gray-200 text-right text-xs text-gray-400 italic">
                    Généré le {new Date().toLocaleString('fr-FR')} — UNI SELECT 2.0
                </div>
            </div>

            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { background: white !important; margin: 0 !important; padding: 0 !important; }
                    .print-section { 
                        box-shadow: none !important; 
                        border: none !important;
                        width: 100% !important;
                        border-radius: 0 !important;
                    }
                    table { page-break-inside: auto; }
                    @page { 
                        size: landscape;
                        margin: 1.5cm; 
                    }
                }
            `}</style>
        </div>
    );
}
