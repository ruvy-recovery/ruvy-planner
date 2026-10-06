export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Méthode non autorisée" });
  }

  const { existantes = [], ajouts = [], limites = {} } = req.body;
  const debut = limites.debut || "07:00";

  const jours = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

  // Activités existantes : on les garde telles quelles, classées par mots-clés
  const classer = (nom) => {
    const n = nom.toLowerCase();
    if (/travail|boulot|bureau|job/.test(n)) return "Travail";
    if (/école|ecole|cours|fac|étude|etude/.test(n)) return "École";
    if (/sport|gym|run|course|jjb|judo|danse|bachata|muscu|foot|yoga/.test(n)) return "Sport";
    if (/médecin|medecin|kiné|kine|santé|sante|sommeil/.test(n)) return "Santé";
    return "Perso";
  };

  const activites = existantes.map((a) => ({
    nom: a.nom,
    jour: a.jour,
    debut: a.debut,
    fin: a.fin,
    categorie: classer(a.nom),
    semaine: a.semaine || "AB",
    nouvelle: false,
  }));

  // Nouvelles activités : réparties sur les jours 1, 3, 5... (le dimanche = repos)
  const joursPossibles = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];
  ajouts.forEach((a, i) => {
    activites.push({
      nom: a.nom,
      jour: joursPossibles[(i * 2 + 1) % joursPossibles.length],
      debut,
      fin: addHeure(debut, 1),
      categorie: classer(a.nom),
      semaine: "AB",
      nouvelle: true,
    });
  });

  return res.status(200).json({
    activites,
    conseil:
      "Version démo : planning généré sans IA. Le dimanche est ton jour de repos complet, garde-le sacré pour bien récupérer.",
  });
}

function addHeure(h, n) {
  const [hh, mm] = h.split(":").map(Number);
  const nouv = (hh + n) % 24;
  return `${String(nouv).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}