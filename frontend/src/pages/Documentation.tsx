import { useState, useMemo } from 'react';

interface DocSection {
  id: string;
  title: string;
  content: string;
}

const SECTIONS: DocSection[] = [
  {
    id: 'plan-de-travail',
    title: 'Plan de travail',
    content: `Cette section permet de gérer les plans de travail et d'assigner les travailleurs aux postes pour une date donnée.

**Créer ou charger un plan**
- Cliquez sur "Créer un Plan" ou "Gérer les Plans" pour ouvrir la fenêtre de gestion des plans.
- Vous pouvez créer un nouveau plan (avec un nom et une date optionnelle), charger un plan existant, ou copier un plan pour réutiliser sa structure.

**Deux panneaux**
- **Gauche (Postes)** : liste des postes. Chaque poste affiche les travailleurs qui y sont assignés pour le plan actuel.
- **Droite (Fiche de présence)** : travailleurs non encore assignés à un poste, regroupés par type de présence (Permanent jour, Permanent soir, Occasionnel, Mobilité, Absent, Vacances, etc.).

**Glisser-déposer**
- **De la fiche de présence vers un poste** : assigne le travailleur à ce poste. Il disparaît de la fiche de présence et apparaît sous le poste. Si le travailleur était en Absent/Vacances, son type de présence est rétabli à son type d'origine (ex. Permanent jour).
- **D'un poste vers la fiche de présence** : retire l'affectation du travailleur. Il réapparaît dans la fiche de présence (dans la case correspondant à son type de présence).
- **Entre cases de la fiche de présence** : change le type de présence du travailleur (ex. de Permanent jour à Absent).

**Assignement automatique**
- Le bouton "Assignement automatique" assigne en un clic tous les travailleurs **Permanent jour** et **Permanent soir** (visibles selon le filtre) à leur poste d'origine. Les types Mobilité et Occasionnel ne sont pas assignés automatiquement.

**Export et suppression**
- Dans "Gérer les Plans", vous pouvez exporter les plans par plage de dates (un fichier Excel par plan) ou supprimer des plans par plage de dates.`,
  },
  {
    id: 'booking',
    title: 'Booking',
    content: `Cette section sert à organiser des réunions de "booking" : répartir les travailleurs par zone (poste) puis enregistrer les changements de poste d'origine.

**Fonctionnement**
- Par défaut, l'écran affiche la répartition actuelle par **poste d'origine** (chaque travailleur est sous son poste d'origine).
- **Commencer le booking** : place tous les travailleurs en "Non assignés". Vous pouvez alors les glisser-déposer vers les postes pour indiquer où ils doivent être affectés.
- **Enregistrer** : enregistre définitivement les nouveaux postes d'origine pour tous les travailleurs que vous avez déplacés. Les travailleurs passent ainsi à leur nouveau poste d'origine.
- **Annuler** : abandonne la réunion en cours et revient à la répartition précédente.

**Colonnes**
- **Non assignés** : travailleurs sans poste pour cette réunion (après "Commencer le booking").
- **Chaque poste** : affiche les travailleurs assignés à ce poste. Vous pouvez ajouter/supprimer des postes via "Créer Poste", et gérer les travailleurs via "Créer Travailleur".`,
  },
  {
    id: 'quart-de-travail',
    title: 'Quart de travail',
    content: `Cette section permet de gérer les **types de travailleurs** (quart de travail / catégorie).

**Types affichés**
- Postes fixes de jour (Permanent jour), Postes fixes de soir (Permanent soir)
- Occasionnels jour / soir, Mobilité jour / soir
- Types de présence/absence : Absent, Vacances, Libération externe, Invalidité, Préretraite, Congé parental

**Glisser-déposer**
- Vous pouvez déplacer un travailleur d'une colonne à une autre pour **changer son type** (ex. de Permanent jour à Permanent soir, ou à Absent).
- Les couleurs des colonnes correspondent aux types (vert = fixes jour, jaune = fixes soir, violet = mobiles jour, etc.).

**Utilisation**
- Utilisez cette page pour mettre à jour le type ou le quart d'un travailleur (ex. passage en absent, retour en permanent jour). Ces changements sont reflétés dans le Plan de travail et la Fiche de présence.`,
  },
  {
    id: 'administration',
    title: 'Administration',
    content: `Cette section permet de gérer les **travailleurs**, les **postes** et les **comptes managers**.

**Travailleurs**
- Liste de tous les travailleurs avec nom, ancienneté, poste original, type.
- Vous pouvez modifier ou supprimer un travailleur. Si vous supprimez un poste auquel des travailleurs sont rattachés, vous devrez les réaffecter à un autre poste.

**Postes**
- Liste de tous les postes (nom, description).
- Création, modification et suppression de postes. La suppression d'un poste nécessite de réaffecter les travailleurs qui en dépendent.

**Comptes (Managers)**
- Création de nouveaux comptes manager (nom d'utilisateur, email, mot de passe). Utilisez cette option pour ajouter des utilisateurs pouvant se connecter à l'application.`,
  },
  {
    id: 'parametres',
    title: 'Paramètres (menu)',
    content: `Le menu **Paramètres** en haut à gauche donne accès aux différentes sections de l'application :

- **Plan de travail** : gestion des plans et affectation des travailleurs aux postes.
- **Booking** : réunions de booking pour changer les postes d'origine.
- **Quart de travail** : gestion des types de travailleurs (jour, soir, occasionnel, mobile, absent, etc.).
- **Documentation** : cette page d'aide.
- **Administration** : gestion des travailleurs, postes et comptes managers.

Utilisez **Déconnexion** pour quitter votre session.`,
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
      <p className="text-gray-600 mb-6">
        Guide d'utilisation de chaque section de l'application Uniselect.
      </p>

      <div className="mb-6">
        <label htmlFor="doc-search" className="block text-sm font-medium text-gray-700 mb-2">
          Rechercher une section ou un mot-clé
        </label>
        <input
          id="doc-search"
          type="text"
          placeholder="Ex. Plan de travail, booking, assignement, absent..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
      </div>

      {filteredSections.length === 0 ? (
        <p className="text-gray-500 italic">Aucune section ne correspond à votre recherche.</p>
      ) : (
        <div className="space-y-8">
          {filteredSections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="bg-white rounded-lg shadow border border-gray-200 p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-4 border-b border-gray-200 pb-2">
                {section.title}
              </h2>
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-line">
                {section.content.split('\n').map((line, i) => {
                  if (line.startsWith('**') && line.endsWith('**')) {
                    return (
                      <strong key={i} className="block mt-2 text-gray-900">
                        {line.slice(2, -2)}
                      </strong>
                    );
                  }
                  if (line.startsWith('- ')) {
                    return (
                      <li key={i} className="ml-4">
                        {line.slice(2)}
                      </li>
                    );
                  }
                  if (line.trim() === '') return <br key={i} />;
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
