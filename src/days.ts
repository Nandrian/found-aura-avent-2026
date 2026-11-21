export type DayKind =
  | "intro"
  | "quiz"
  | "offer"
  | "carousel"
  | "vote"
  | "mystery"
  | "color"
  | "match"
  | "editorial"
  | "detail"
  | "pair"
  | "transform"
  | "builder"
  | "finale";

export type WardrobeDay = {
  day: number;
  title: string;
  kind: DayKind;
  description: string;
  note: string;
  image: string;
  shopping?: boolean;
};

const rack =
  "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1400&q=85";
const jackets =
  "https://images.unsplash.com/photo-1551232864-3f0890e580d9?auto=format&fit=crop&w=1400&q=85";
const garments =
  "https://images.unsplash.com/photo-1603400521630-9f2de124b33b?auto=format&fit=crop&w=1400&q=85";
const fashion =
  "https://images.unsplash.com/photo-1632870209717-799d91072b60?auto=format&fit=crop&w=1400&q=85";
const trench =
  "https://images.unsplash.com/photo-1675159230249-ff15f209eb81?auto=format&fit=crop&w=1400&q=85";
const shirt =
  "https://images.unsplash.com/photo-1604506847073-4a8e18e07d92?auto=format&fit=crop&w=1400&q=85";

export const days: WardrobeDay[] = [
  {
    day: 1,
    title: "Bienvenue au Dressing",
    kind: "intro",
    description:
      "Entrez dans un mois de découvertes choisies avec soin, entre allure intemporelle et seconde main.",
    note: "Votre première Aura vous attend.",
    image: rack,
  },
  {
    day: 2,
    title: "Trouvez votre Aura",
    kind: "quiz",
    description: "Quelques intuitions mode révèlent la signature qui vous ressemble.",
    note: "Êtes-vous Aura Douce, Libre ou Intemporelle ?",
    image: fashion,
  },
  {
    day: 3,
    title: "Le Premier Privilège",
    kind: "offer",
    description: "Un avantage exclusif vous est réservé aujourd’hui sur une sélection Found Aura.",
    note: "OFFRE PROTOTYPE · valeur à confirmer",
    image: jackets,
    shopping: true,
  },
  {
    day: 4,
    title: "Une Pièce, Trois Allures",
    kind: "carousel",
    description: "Un blazer, trois façons de le porter. Faites défiler notre carnet de style.",
    note: "Bureau · Week-end · Soir",
    image: trench,
  },
  {
    day: 5,
    title: "Choisissez votre Look",
    kind: "vote",
    description: "Deux silhouettes, une seule intuition. Votez pour l’allure qui vous attire.",
    note: "Tailoring doux ou minimalisme fluide ?",
    image: fashion,
  },
  {
    day: 6,
    title: "Le Cadeau Caché",
    kind: "mystery",
    description: "Tirez délicatement le ruban pour révéler la surprise glissée dans ce tiroir.",
    note: "Une attention secrète Found Aura.",
    image: garments,
  },
  {
    day: 7,
    title: "Color Crush",
    kind: "color",
    description: "Découvrez la nuance qui donnera du relief à votre vestiaire neutre.",
    note: "Sauge, cacao ou champagne ?",
    image: rack,
  },
  {
    day: 8,
    title: "Mix & Match",
    kind: "match",
    description: "Associez la pièce maîtresse à son complément idéal.",
    note: "Composez une silhouette équilibrée.",
    image: jackets,
  },
  {
    day: 9,
    title: "Secret Shopping Day",
    kind: "offer",
    description: "Une fenêtre shopping très limitée s’ouvre jusqu’à minuit.",
    note: "Privilège du jour · conditions à confirmer",
    image: garments,
    shopping: true,
  },
  {
    day: 10,
    title: "Les Essentiels Intemporels",
    kind: "editorial",
    description: "Chemise nette, pantalon bien coupé, maille douce : notre garde-robe essentielle.",
    note: "Acheter moins, choisir mieux.",
    image: shirt,
    shopping: true,
  },
  {
    day: 11,
    title: "Repérez le Détail",
    kind: "detail",
    description: "Observez la silhouette et retrouvez le détail signature qui change tout.",
    note: "Indice : regardez la manche.",
    image: trench,
  },
  {
    day: 12,
    title: "Petite Surprise Aura",
    kind: "mystery",
    description: "Une délicate attention vous attend derrière le panneau de lin.",
    note: "Exclusivité du jour.",
    image: rack,
  },
  {
    day: 13,
    title: "Le Duo Parfait",
    kind: "pair",
    description:
      "Trouvez l’accord juste entre blazer et pantalon grâce à notre conseil silhouette.",
    note: "Proportions, matières, harmonie.",
    image: jackets,
  },
  {
    day: 14,
    title: "Votre Personnalité Style",
    kind: "quiz",
    description: "Suivez votre instinct pour préciser votre vestiaire idéal.",
    note: "Une lecture mode personnalisée.",
    image: fashion,
  },
  {
    day: 15,
    title: "Douceur de Mi-Décembre",
    kind: "offer",
    description: "Un privilège shopping réchauffe le milieu du mois.",
    note: "OFFRE PROTOTYPE · valeur à confirmer",
    image: garments,
    shopping: true,
  },
  {
    day: 16,
    title: "Du Jour à la Nuit",
    kind: "transform",
    description: "Un geste, deux allures : transformez la silhouette pour le soir.",
    note: "Faites glisser pour voir la métamorphose.",
    image: trench,
  },
  {
    day: 17,
    title: "Composez votre Tenue",
    kind: "builder",
    description: "Choisissez trois pièces et construisez votre look Found Aura.",
    note: "Haut · bas · touche finale.",
    image: fashion,
  },
  {
    day: 18,
    title: "Essayage Surprise",
    kind: "mystery",
    description: "Votre récompense révèle une piste inattendue à essayer en boutique.",
    note: "Osez une nouvelle silhouette.",
    image: jackets,
    shopping: true,
  },
  {
    day: 19,
    title: "Holiday Edit",
    kind: "editorial",
    description: "Des textures lumineuses et des coupes sobres pour célébrer sans en faire trop.",
    note: "L’éclat juste, version Found Aura.",
    image: fashion,
    shopping: true,
  },
  {
    day: 20,
    title: "Votre Aura Préférée",
    kind: "vote",
    description: "Élisez la silhouette qui a marqué votre Secret Wardrobe.",
    note: "Votre vote nourrit notre prochaine sélection.",
    image: garments,
  },
  {
    day: 21,
    title: "Dernier Privilège Shopping",
    kind: "offer",
    description: "Le dernier accès privilégié de la saison est ouvert aujourd’hui.",
    note: "Jusqu’à minuit, heure d’Antananarivo.",
    image: rack,
    shopping: true,
  },
  {
    day: 22,
    title: "Le Choix de la Fondatrice",
    kind: "editorial",
    description: "Une sélection personnelle de pièces singulières, choisies pour durer.",
    note: "Curatée par la fondatrice de Found Aura.",
    image: trench,
    shopping: true,
  },
  {
    day: 23,
    title: "Presque Dévoilé",
    kind: "mystery",
    description: "Le ruban se desserre. Découvrez un aperçu du grand cadeau et votre statut.",
    note: "Encore une ouverture avant la finale.",
    image: shirt,
  },
  {
    day: 24,
    title: "The Grand Aura Gift",
    kind: "finale",
    description: "La dernière porte s’ouvre sur The Aura Makeover, notre cadeau final.",
    note: "Collectez cette Aura pour confirmer votre admissibilité.",
    image: fashion,
  },
];
