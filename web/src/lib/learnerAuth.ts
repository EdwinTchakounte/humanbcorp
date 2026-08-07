// Stockage local des jetons de l'apprenant connecté par e-mail + mot de passe.
// Namespacé "learner" pour ne pas entrer en conflit avec un éventuel jeton staff.
// (Le dashboard vit sur un autre sous-domaine : localStorage séparé de toute façon.)
const ACCESS = "hbc_learner_access";
const REFRESH = "hbc_learner_refresh";

export function saveLearnerTokens(access: string, refresh: string) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACCESS, access);
  localStorage.setItem(REFRESH, refresh);
}

export function getLearnerAccess(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS);
}

export function clearLearnerTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ACCESS);
  localStorage.removeItem(REFRESH);
}
