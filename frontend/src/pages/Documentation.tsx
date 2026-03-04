import { useState, useMemo } from 'react';

interface DocSection {
  id: string;
  title: string;
  content: string;
}

const SECTIONS: DocSection[] = [
  {
    id: 'presentation',
    title: 'Présentation générale',
    content: `Superviser un entrepôt, c’est évoluer chaque jour à l’intersection de trois réalités : la performance, l’humain et la technologie.

L’Application de Gestion des Plans de Travail a été conçue comme un véritable système d’assistance intelligente. Elle centralise les données, structure l’information et transforme un booking stratégique en un plan de travail opérationnel cohérent.

Grâce à l’intelligence embarquée, le système :
- Prend en compte automatiquement les absences et statuts particuliers
- Applique les règles de rotation définies
- Active les remplaçants selon leur ordre de priorité
- Sécurise les opérations critiques
- Enregistre les mouvements pour assurer la traçabilité
- Facilite la génération de rapports et le suivi des primes`,
  },
  {
    id: 'performance',
    title: 'Indicateurs de performance (KPI)',
    content: `L’application influence directement les indicateurs clés de performance liés à la gestion opérationnelle et aux ressources humaines :

1. Taux de couverture des postes critiques : Les postes stratégiques restent couverts sans interruption grâce au système de remplaçants hiérarchisés.
2. Temps moyen de planification quotidienne : L’assignation automatique réduit le stress décisionnel et libère du temps managérial.
3. Taux d’erreurs d’affectation : Diminution drastique des erreurs humaines (employé absent affecté, double affectation).
4. Équité dans la rotation des postes : Le booking structure l’équilibre pour éviter la sur-sollicitation et les tensions internes.
5. Suivi des primes : Fiabilité totale des données transmises au service paie grâce à l'Etat des Primes.
6. Taux d’anticipation des absences : Meilleure projection des effectifs grâce à l'intégration des dates de retour.
7. Traçabilité des décisions : Chaque mouvement est enregistré pour permettre une analyse post-journée ou un audit interne.`,
  },
  {
    id: 'administration',
    title: 'Administration des données',
    content: `La section Administration est le socle de l'entrepôt. Elle permet de gérer les trois entités piliers :

1. Gestion des travailleurs :
- Créer : Saisissez le nom, l'ancienneté (matricule), le type, le quart et le poste original. Vous pouvez rechercher un employé par son nom dans la liste.
- Modifier/Supprimer : Permet d'actualiser les informations ou de retirer définitivement un profil (action irréversible protégée par confirmation).
- Gestion des préretraites : Cochez l'option et sélectionnez le jour fixe d'absence hebdomadaire pour automatiser l'exclusion de l'employé.

2. Gestion des postes de travail :
- Chaque poste correspond à une fonction stratégique (MET1, Pick, Expédition, etc.).
- Création : Indiquez le nom et une description claire pour faciliter l'identification de la tâche et du secteur.`,
  },
  {
    id: 'quarts-de-travail',
    title: 'Gestion des quarts de travail',
    content: `Cette section permet d’organiser les employés par quart (Jour/Soir) et par statut de présence.

1. Déplacement des employés : Utilisez le glisser-déposer pour changer la zone ou le type d'un travailleur en temps réel.
2. Gestion des absences :
- Statuts : Vacances, Invalidité, Congé parental, Libération externe, etc.
- Date de retour : Lors du passage en absence, le système demande une date. Jusqu'à cette date, l'employé est exclu des affectations.
- Notification : À la date prévue de retour, le système génère une alerte pour confirmer la reprise ou prolonger l'absence.`,
  },
  {
    id: 'booking',
    title: 'Gestion du Booking',
    content: `Le booking consiste à attribuer officiellement des postes pour une période donnée. Un seul booking peut être actif à la fois.

1. Créer un nouveau booking :
- Affectez les employés par glisser-déposer depuis la zone Non assignés.
- Enregistrement : Nommez le booking et définissez sa date d'entrée en vigueur (permet d'anticiper la planification sur plusieurs semaines).

2. Gestion des remplaçants :
- Pour les postes critiques (primes), cliquez sur l’icône + pour sélectionner les remplaçants.
- Ordre de priorité : Définissez la hiérarchie. Le système activera automatiquement le premier disponible si le titulaire est absent.

3. Appliquer : Le bouton Appliquer rend le booking effectif pour les futurs plans de travail.`,
  },
  {
    id: 'plan-de-travail',
    title: 'Plan de travail quotidien',
    content: `C’est l’organisation opérationnelle réelle d’une journée, généralement nommée par la date du jour.

1. Création et Assignement :
- Assignement Automatique : Le système affecte les employés selon le booking actif, gère les exclusions d'absents et active les remplaçants prévus.
- Les profils Mobiles et Occasionnels restent en dehors pour une affectation manuelle stratégique.

2. Ajustements manuels :
- Le superviseur peut déplacer librement un employé pour faire face aux impératifs du moment. Tous les mouvements sont tracés.

3. État des primes :
- Génère instantanément le rapport des employés ayant travaillé sur un poste à prime pour la journée concernée.`,
  },
  {
    id: 'technique',
    title: 'Spécificités techniques',
    content: `L'application web repose sur une architecture moderne (React JS et Node JS) garantissant fluidité et sécurité en environnement multi-utilisateurs.

1. Compatibilité :
- Navigateurs : Chrome, Firefox, Edge, Internet Explorer.
- Systèmes : Compatible Windows 7 et versions supérieures.
- Matériel : Fonctionne sur tout ordinateur de bureau standard (Intel i3 ou équivalent recommandé).

2. Infrastructure et Hébergement :
- Les données sont centralisées sur une base de données sécurisée distante, assurant disponibilité 24/7 et synchronisation en temps réel.
- Sauvegardes : Protection continue contre les pertes d'informations et accès distant sécurisé.`,
  },
  {
    id: 'charges',
    title: 'Charges opérationnelles',
    content: `L'application a été optimisée pour offrir un investissement stratégique à faible charge.

1. Coûts d'exploitation :
- L’hébergement de la base de données représente un coût annuel modéré (environ 84 USD par an pour une disponibilité continue et sécurisée).

2. Retour sur investissement :
- Ce coût est largement compensé par les gains de productivité, la réduction drastique des erreurs d'affectation et la simplification du suivi administratif (primes).`,
  },
  {
    id: 'vision',
    title: 'Synthèse et Vision globale',
    content: `L’application agit sur trois niveaux fondamentaux :

1. Performance opérationnelle : Continuité des postes critiques et optimisation des ressources.
2. Performance managériale : Gain de temps, réduction du stress décisionnel et des tensions.
3. Performance administrative : Exactitude des primes, traçabilité complète et données fiables.

En intégrant cet outil dans son quotidien, le superviseur ne se contente plus d’organiser : il pilote, anticipe et sécurise. C’est un levier de leadership qui professionnalise durablement la gestion d’équipe pour viser l'excellence opérationnelle.`,
  },
];

export default function Documentation() {
  const [search, setSearch] = useState('');

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.content.toLowerCase().includes(q)
    );
  }, [search]);

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Documentation</h1>
      <p className="text-gray-600 mb-8">
        Guide d'utilisation de chaque section de l'application Uniselect.
      </p>

      {/* Table of Contents */}
      <div className="mb-8 p-6 bg-blue-50 rounded-xl border border-blue-100 shadow-sm">
        <h2 className="text-lg font-bold text-blue-900 mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.007 5.25H3.75v.008h.007V12Zm0 5.25H3.75v.008h.007v-.008Z" />
          </svg>
          Sommaire
        </h2>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2">
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a
                href={`#${section.id}`}
                className="text-sm text-blue-700 hover:text-blue-900 hover:underline flex items-center gap-1 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                <span className="text-blue-300">•</span> {section.title}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <div className="mb-10">
        <label htmlFor="doc-search" className="block text-sm font-semibold text-gray-700 mb-2">
          Rechercher dans la documentation
        </label>
        <div className="relative">
          <input
            id="doc-search"
            type="text"
            placeholder="Ex. Plan de travail, booking, absent..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm outline-none transition-all"
          />
          <svg className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {filteredSections.length === 0 ? (
        <div className="text-center py-10 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <p className="text-gray-500">Aucune section ne correspond à votre recherche.</p>
        </div>
      ) : (
        <div className="space-y-12">
          {filteredSections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-6"
            >
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-3">
                <span className="w-1.5 h-8 bg-blue-600 rounded-full"></span>
                {section.title}
              </h2>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 prose prose-blue max-w-none text-gray-700 leading-relaxed">
                {section.content.split('\n').map((line, i) => {
                  if (line.startsWith('- ')) {
                    return (
                      <li key={i} className="ml-6 mb-1 text-gray-600 list-disc list-outside">
                        {line.slice(2)}
                      </li>
                    );
                  }
                  if (line.trim() === '') return <div key={i} className="h-4" />;
                  if (/^\d+\./.test(line)) {
                    return <p key={i} className="font-bold text-gray-900 mt-4 mb-2">{line}</p>;
                  }
                  return <p key={i} className="mb-2">{line}</p>;
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
