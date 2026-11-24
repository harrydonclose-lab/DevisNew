"use strict";

/* ==========================================================================
   Constantes
   ========================================================================== */
const CLE_ETAT = "devis-app:etat";

// Devises proposées (code ISO) ; le nom est fourni par le navigateur
const CODES_DEVISES = [
    "XOF", "XAF", "EUR", "USD", "GBP", "CHF", "CAD", "AUD", "NZD", "JPY", "CNY", "HKD", "SGD",
    "INR", "PKR", "BDT", "LKR", "IDR", "MYR", "THB", "VND", "PHP", "KRW", "TWD",
    "AED", "SAR", "QAR", "KWD", "BHD", "OMR", "JOD", "ILS", "TRY", "IRR", "IQD", "LBP",
    "MAD", "DZD", "TND", "EGP", "LYD", "NGN", "GHS", "KES", "UGX", "TZS", "RWF", "ETB",
    "ZAR", "BWP", "NAD", "MZN", "ZMW", "AOA", "CDF", "GMD", "GNF", "SLE", "LRD", "MRU",
    "CVE", "MUR", "MGA", "SDG", "BIF", "DJF", "KMF", "SCR",
    "BRL", "ARS", "CLP", "COP", "PEN", "UYU", "MXN", "BOB", "PYG", "VES", "DOP", "HTG", "JMD", "TTD", "CRC", "GTQ",
    "SEK", "NOK", "DKK", "ISK", "PLN", "CZK", "HUF", "RON", "BGN", "RSD", "UAH", "RUB", "KZT", "GEL", "AMD", "AZN",
    "XPF", "XCD",
];
const DEVISES_COURANTES = ["XOF", "XAF", "EUR", "USD", "GBP"];
const DEVISE_DEFAUT = "XOF";

// Format de la feuille exportée (proportions A4)
const PAGE = { largeur: 1240, hauteur: 1754, marge: 80 };
const PDF_A4 = { largeur: 595.28, hauteur: 841.89 }; // en points

const COULEURS = {
    petrole: "#0f3d4c",
    ambre: "#f2b705",
    encre: "#16282f",
    douce: "#566a72",
    pale: "#7a8d95",
    trait: "#d5dde1",
    blanc: "#ffffff",
};

const POLICE = '"IBM Plex Sans", Arial, Helvetica, sans-serif';
const POLICE_TITRE = '"Bricolage Grotesque", "IBM Plex Sans", Arial, sans-serif';

/* ==========================================================================
   Accès au DOM
   ========================================================================== */
const $ = (id) => document.getElementById(id);

const champs = {
    clientNom: $("client-nom"),
    clientContact: $("client-contact"),
    numero: $("numero"),
    date: $("date"),
    remise: $("remise"),
    tva: $("tva"),
    entrepriseNom: $("entreprise-nom"),
    entrepriseAdresse: $("entreprise-adresse"),
    entrepriseContact: $("entreprise-contact"),
    nom: $("nom"),
    quantite: $("quantite"),
    prix: $("prix"),
    devise: $("devise"),
};

const ecrans = { 1: $("etape-1"), 2: $("etape-2") };
const formInfos = $("form-infos");
const formMateriel = $("form-materiel");
const liste = $("liste");
const recap = $("recap");

/* ==========================================================================
   Utilitaires
   ========================================================================== */
function aujourdhui() {
    return new Date().toISOString().split("T")[0];
}

function formaterNombre(nombre) {
    return nombre.toLocaleString("fr-FR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    });
}

function nomDevise(code) {
    try {
        const nom = new Intl.DisplayNames(["fr"], { type: "currency" }).of(code);
        if (nom && nom !== code) return nom.charAt(0).toUpperCase() + nom.slice(1);
    } catch {
        /* navigateur ancien : on garde le code seul */
    }
    return code;
}

// Texte affiché à côté des montants
function suffixeDevise() {
    return etat.devise === "XOF" || etat.devise === "XAF" ? "FCFA" : etat.devise;
}

function formaterMontant(nombre) {
    return `${formaterNombre(nombre)} ${suffixeDevise()}`;
}

function remplirDevises() {
    const creerOption = (code) => {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = `${nomDevise(code)} (${code})`;
        return option;
    };
    const groupe = (titre, codes) => {
        const optgroup = document.createElement("optgroup");
        optgroup.label = titre;
        optgroup.append(...codes.map(creerOption));
        return optgroup;
    };

    const autres = CODES_DEVISES.filter((code) => !DEVISES_COURANTES.includes(code))
        .sort((a, b) => nomDevise(a).localeCompare(nomDevise(b), "fr"));

    champs.devise.replaceChildren(
        groupe("Courantes", DEVISES_COURANTES),
        groupe("Autres devises", autres)
    );
}

function formaterDate(dateIso) {
    if (!dateIso) return "";
    return new Date(`${dateIso}T00:00:00`).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    });
}

function lirePourcentage(valeur) {
    const nombre = Number(valeur);
    return Number.isFinite(nombre) ? Math.min(100, Math.max(0, nombre)) : 0;
}

function libelleArticles(nombre) {
    return `${nombre} article${nombre > 1 ? "s" : ""}`;
}

function creerElement(balise, texte = "", classe = "") {
    const element = document.createElement(balise);
    element.textContent = texte;
    if (classe) element.className = classe;
    return element;
}

function afficherErreur(id, message) {
    const element = $(id);
    element.textContent = message;
    element.hidden = false;
}

function masquerErreur(id) {
    $(id).hidden = true;
}

/* ==========================================================================
   Stockage (localStorage)
   ========================================================================== */
function lireStockage(cle) {
    try {
        return localStorage.getItem(cle);
    } catch {
        return null;
    }
}

function ecrireStockage(cle, valeur) {
    try {
        localStorage.setItem(cle, valeur);
    } catch {
        console.warn("Sauvegarde impossible dans le navigateur.");
    }
}

function sauvegarder() {
    ecrireStockage(CLE_ETAT, JSON.stringify(etat));
}

/* ==========================================================================
   État de l'application
   ========================================================================== */
function creerEtatVide(entreprise = { nom: "", adresse: "", contact: "" }, devise = DEVISE_DEFAUT) {
    return {
        etape: 1,
        entreprise,
        numero: "",
        devise,
        date: aujourdhui(),
        client: { nom: "", contact: "" },
        remise: 0,
        tva: 0,
        materiels: [],
    };
}

function creerEtat(entreprise, devise) {
    return creerEtatVide(entreprise, devise);
}

function chargerEtat() {
    const brut = lireStockage(CLE_ETAT);
    if (!brut) return creerEtat();

    try {
        const base = creerEtatVide();
        const sauvegarde = JSON.parse(brut);
        return {
            ...base,
            ...sauvegarde,
            entreprise: { ...base.entreprise, ...sauvegarde.entreprise },
            client: { ...base.client, ...sauvegarde.client },
        };
    } catch {
        return creerEtat();
    }
}

let etat = chargerEtat();
let indexEdition = null;

/* ==========================================================================
   Calculs
   ========================================================================== */
function calculerTotaux() {
    const sousTotal = etat.materiels.reduce(
        (somme, m) => somme + m.quantite * m.prix,
        0
    );
    const montantRemise = (sousTotal * etat.remise) / 100;
    const totalHt = sousTotal - montantRemise;
    const montantTva = (totalHt * etat.tva) / 100;

    return {
        sousTotal,
        montantRemise,
        montantTva,
        totalTtc: totalHt + montantTva,
    };
}

/* ==========================================================================
   Navigation entre les étapes
   ========================================================================== */
function afficherProgression(etapeActive) {
    document.querySelectorAll("#etapes li").forEach((item) => {
        const numero = Number(item.dataset.etape);
        item.classList.toggle("courant", numero === etapeActive);
        item.classList.toggle("fait", numero < etapeActive);

        if (numero === etapeActive) {
            item.setAttribute("aria-current", "step");
        } else {
            item.removeAttribute("aria-current");
        }
    });
}

function allerEtape(numero) {
    etat.etape = numero;
    sauvegarder();

    ecrans[1].hidden = numero !== 1;
    ecrans[2].hidden = numero !== 2;
    afficherProgression(numero);
    window.scrollTo({ top: 0 });

    if (numero === 1) afficherInfos();
    if (numero === 2) {
        afficherEtapeMateriels();
        champs.nom.focus();
    }
}

/* ==========================================================================
   Étape 1 : informations
   ========================================================================== */
function afficherInfos() {
    champs.clientNom.value = etat.client.nom;
    champs.clientContact.value = etat.client.contact;
    champs.numero.value = etat.numero;
    champs.date.value = etat.date;
    champs.devise.value = etat.devise;
    champs.remise.value = etat.remise || "";
    champs.tva.value = etat.tva || "";
    champs.entrepriseNom.value = etat.entreprise.nom;
    champs.entrepriseAdresse.value = etat.entreprise.adresse;
    champs.entrepriseContact.value = etat.entreprise.contact;
}

function validerInfos(evenement) {
    evenement.preventDefault();

    etat.client = { nom: champs.clientNom.value.trim(), contact: champs.clientContact.value.trim() };
    etat.numero = champs.numero.value.trim();
    etat.date = champs.date.value;
    etat.devise = champs.devise.value || DEVISE_DEFAUT;
    etat.remise = lirePourcentage(champs.remise.value);
    etat.tva = lirePourcentage(champs.tva.value);
    etat.entreprise = {
        nom: champs.entrepriseNom.value.trim(),
        adresse: champs.entrepriseAdresse.value.trim(),
        contact: champs.entrepriseContact.value.trim(),
    };

    allerEtape(2);
}

/* ==========================================================================
   Étape 2 : matériels
   ========================================================================== */
function creerBoutonAction(texte, action, index, classe) {
    const bouton = creerElement("button", texte, `lien-action ${classe}`);
    bouton.type = "button";
    bouton.dataset.action = action;
    bouton.dataset.index = index;
    return bouton;
}

function creerCellulesMateriel(materiel, index) {
    return [
        creerElement("td", index + 1),
        creerElement("td", materiel.nom),
        creerElement("td", materiel.quantite, "nombre"),
        creerElement("td", formaterNombre(materiel.prix), "nombre"),
        creerElement("td", formaterNombre(materiel.quantite * materiel.prix), "nombre"),
    ];
}

function creerLigneEditable(materiel, index) {
    const ligne = document.createElement("tr");
    if (index === indexEdition) ligne.classList.add("en-edition");

    const actions = creerElement("td", "", "cell-actions");
    actions.append(
        creerBoutonAction("Modifier", "modifier", index, "lien-modifier"),
        creerBoutonAction("Supprimer", "supprimer", index, "lien-supprimer")
    );

    ligne.append(...creerCellulesMateriel(materiel, index), actions);
    return ligne;
}

function creerLigneVide(colonnes, message) {
    const cellule = creerElement("td", message, "empty");
    cellule.colSpan = colonnes;

    const ligne = document.createElement("tr");
    ligne.appendChild(cellule);
    return ligne;
}

function afficherListe() {
    if (etat.materiels.length === 0) {
        liste.replaceChildren(
            creerLigneVide(6, "Aucun article pour l'instant. Ajoutez-en un avec le formulaire.")
        );
        return;
    }

    liste.replaceChildren(...etat.materiels.map(creerLigneEditable));
}

function afficherResume() {
    const { sousTotal } = calculerTotaux();

    $("libelle-articles").textContent = `Sous-total (${libelleArticles(etat.materiels.length)})`;
    $("apercu-total").textContent = formaterMontant(sousTotal);
}

function afficherEtapeMateriels() {
    const intro = ["Devis"];
    if (etat.numero) intro.push(etat.numero);
    if (etat.client.nom) intro.push(`pour ${etat.client.nom}`);
    $("intro-client").textContent = `${intro.join(" ")}.`;
    $("devise-label").textContent = suffixeDevise();

    masquerErreur("erreur-liste");
    afficherListe();
    afficherResume();
}

function lireMateriel() {
    const nom = champs.nom.value.trim();
    const quantite = Number(champs.quantite.value);
    const prixBrut = champs.prix.value.trim();
    const prix = Number(prixBrut);

    if (!nom) {
        return { erreur: "Veuillez saisir le nom de l'article." };
    }
    if (!Number.isInteger(quantite) || quantite <= 0) {
        return { erreur: "La quantité doit être un nombre entier supérieur à 0." };
    }
    if (prixBrut === "" || !Number.isFinite(prix) || prix < 0) {
        return { erreur: "Le prix unitaire doit être un nombre positif ou nul." };
    }

    return { materiel: { nom, quantite, prix } };
}

function demarrerEdition(index) {
    const materiel = etat.materiels[index];

    indexEdition = index;
    champs.nom.value = materiel.nom;
    champs.quantite.value = materiel.quantite;
    champs.prix.value = materiel.prix;

    $("form-titre").textContent = "Modifier l'article";
    $("btn-valider-materiel").textContent = "Enregistrer";
    $("btn-annuler").hidden = false;
    formMateriel.classList.add("en-edition");

    masquerErreur("erreur-materiel");
    afficherListe();
    champs.nom.focus();
}

function quitterEdition() {
    indexEdition = null;
    formMateriel.reset();

    $("form-titre").textContent = "Ajouter un article";
    $("btn-valider-materiel").textContent = "Ajouter";
    $("btn-annuler").hidden = true;
    formMateriel.classList.remove("en-edition");

    masquerErreur("erreur-materiel");
    afficherListe();
}

function soumettreMateriel(evenement) {
    evenement.preventDefault();

    const { materiel, erreur } = lireMateriel();
    if (erreur) {
        afficherErreur("erreur-materiel", erreur);
        return;
    }

    if (indexEdition === null) {
        etat.materiels.push(materiel);
    } else {
        etat.materiels[indexEdition] = materiel;
    }

    quitterEdition();
    sauvegarder();
    afficherResume();
    masquerErreur("erreur-liste");
    champs.nom.focus();
}

function supprimerMateriel(index) {
    etat.materiels.splice(index, 1);
    quitterEdition();
    sauvegarder();
    afficherResume();
}

function gererActionsListe(evenement) {
    const bouton = evenement.target.closest("button[data-action]");
    if (!bouton) return;

    const index = Number(bouton.dataset.index);

    if (bouton.dataset.action === "modifier") demarrerEdition(index);
    if (bouton.dataset.action === "supprimer") supprimerMateriel(index);
}

/* ==========================================================================
   Étape 3 : récapitulatif au premier plan
   ========================================================================== */
function creerBloc(classe, lignes) {
    const bloc = document.createElement("div");
    bloc.className = classe;

    lignes
        .filter(([texte]) => texte)
        .forEach(([texte, classeLigne]) => {
            bloc.appendChild(creerElement("p", texte, classeLigne));
        });

    return bloc;
}

function creerTableauRecap() {
    const entete = document.createElement("tr");
    [
        ["N°", ""],
        ["Désignation", ""],
        ["Qté", "nombre"],
        ["Prix unitaire", "nombre"],
        ["Montant", "nombre"],
    ].forEach(([texte, classe]) => entete.appendChild(creerElement("th", texte, classe)));

    const thead = document.createElement("thead");
    thead.appendChild(entete);

    const tbody = document.createElement("tbody");
    etat.materiels.forEach((materiel, index) => {
        const ligne = document.createElement("tr");
        ligne.append(...creerCellulesMateriel(materiel, index));
        tbody.appendChild(ligne);
    });

    const tableau = document.createElement("table");
    tableau.append(thead, tbody);

    const conteneur = document.createElement("div");
    conteneur.className = "table-wrapper";
    conteneur.appendChild(tableau);
    return conteneur;
}

function creerLigneTotal(libelle, valeur) {
    const ligne = document.createElement("div");
    ligne.className = "total-ligne";
    ligne.append(creerElement("dt", libelle), creerElement("dd", valeur));
    return ligne;
}

function creerTotauxRecap() {
    const totaux = calculerTotaux();
    const liste = document.createElement("dl");
    liste.className = "totaux";

    liste.appendChild(
        creerLigneTotal(
            `Sous-total (${libelleArticles(etat.materiels.length)})`,
            `${formaterMontant(totaux.sousTotal)}`
        )
    );
    if (etat.remise > 0) {
        liste.appendChild(
            creerLigneTotal(
                `Remise (${formaterNombre(etat.remise)} %)`,
                `- ${formaterMontant(totaux.montantRemise)}`
            )
        );
    }
    if (etat.tva > 0) {
        liste.appendChild(
            creerLigneTotal(
                `TVA (${formaterNombre(etat.tva)} %)`,
                `+ ${formaterMontant(totaux.montantTva)}`
            )
        );
    }

    const final = document.createElement("div");
    final.className = "total-final";
    final.append(
        creerElement("span", etat.tva > 0 ? "Total TTC" : "Total"),
        creerElement("strong", `${formaterMontant(totaux.totalTtc)}`)
    );

    return [liste, final];
}

function afficherRecap() {
    const { entreprise, client } = etat;

    const entete = document.createElement("div");
    entete.className = "doc-entete";
    entete.append(
        creerBloc("doc-gauche", [
            [entreprise.nom, "doc-entreprise-nom"],
            [entreprise.adresse],
            [entreprise.contact],
        ]),
        creerBloc("doc-droite", [
            ["Devis", "doc-titre"],
            [etat.numero ? `N° ${etat.numero}` : "", "doc-numero"],
            [formaterDate(etat.date)],
        ])
    );

    const blocClient = client.nom || client.contact
        ? creerBloc("doc-client", [
            ["Client", "doc-client-label"],
            [client.nom, "doc-client-nom"],
            [client.contact],
        ])
        : null;

    $("recap-document").replaceChildren(
        entete,
        ...(blocClient ? [blocClient] : []),
        creerTableauRecap(),
        ...creerTotauxRecap()
    );
    $("recap-statut").textContent = "";
}

function ouvrirRecap() {
    if (etat.materiels.length === 0) {
        afficherErreur("erreur-liste", "Ajoutez au moins un article avant de valider le devis.");
        return;
    }

    masquerErreur("erreur-liste");
    afficherRecap();
    afficherProgression(3);
    recap.showModal();
}

function fermerRecap() {
    recap.close();
}

function nouveauDevis() {
    if (!confirm("Voulez-vous vraiment créer un nouveau devis ?")) return;

    // Les informations de l'entreprise sont conservées
    etat = creerEtat(etat.entreprise, etat.devise);
    indexEdition = null;
    formMateriel.reset();
    quitterEdition();

    if (recap.open) recap.close();
    allerEtape(1);
}

/* ==========================================================================
   Export : dessin du devis sur un canvas
   ========================================================================== */
function nettoyerTexte(texte) {
    // Remplace les espaces insécables par des espaces simples (meilleur rendu)
    return String(texte).replace(/[\u202f\u00a0]/g, " ");
}

function tracerRectArrondi(ctx, x, y, largeur, hauteur, rayon) {
    ctx.beginPath();
    ctx.moveTo(x + rayon, y);
    ctx.arcTo(x + largeur, y, x + largeur, y + hauteur, rayon);
    ctx.arcTo(x + largeur, y + hauteur, x, y + hauteur, rayon);
    ctx.arcTo(x, y + hauteur, x, y, rayon);
    ctx.arcTo(x, y, x + largeur, y, rayon);
    ctx.closePath();
}

function couperMot(ctx, mot, largeurMax) {
    const morceaux = [];
    let courant = "";

    for (const caractere of mot) {
        if (courant && ctx.measureText(courant + caractere).width > largeurMax) {
            morceaux.push(courant);
            courant = "";
        }
        courant += caractere;
    }
    if (courant) morceaux.push(courant);
    return morceaux;
}

function decouperTexte(ctx, texte, largeurMax) {
    const lignes = [];
    let ligne = "";

    nettoyerTexte(texte)
        .split(/\s+/)
        .filter(Boolean)
        .flatMap((mot) =>
            ctx.measureText(mot).width > largeurMax ? couperMot(ctx, mot, largeurMax) : [mot]
        )
        .forEach((mot) => {
            const essai = ligne ? `${ligne} ${mot}` : mot;
            if (!ligne || ctx.measureText(essai).width <= largeurMax) {
                ligne = essai;
            } else {
                lignes.push(ligne);
                ligne = mot;
            }
        });

    if (ligne) lignes.push(ligne);
    return lignes;
}

/**
 * Dessine le devis sur le contexte fourni, page après page.
 * Retourne le nombre de pages nécessaires.
 */
function dessinerDevis(ctx) {
    const { largeur, hauteur, marge } = PAGE;
    const droite = largeur - marge;
    const { entreprise, client } = etat;

    let page = 0;
    let y = 0;

    const ecrire = (texte, x, haut, police, couleur, alignement = "left") => {
        ctx.font = police;
        ctx.fillStyle = couleur;
        ctx.textAlign = alignement;
        ctx.textBaseline = "top";
        ctx.fillText(nettoyerTexte(texte), x, haut);
    };

    const trait = (haut, couleur, epaisseur = 1) => {
        ctx.fillStyle = couleur;
        ctx.fillRect(marge, haut, droite - marge, epaisseur);
    };

    const bandeau = () => {
        ctx.fillStyle = COULEURS.ambre;
        ctx.fillRect(0, page * hauteur, largeur, 14);
    };

    const nouvellePage = () => {
        page += 1;
        bandeau();
        y = page * hauteur + marge;
    };

    // Réserve de la place ; passe à la page suivante si nécessaire
    const assurerEspace = (besoin) => {
        if (y + besoin <= (page + 1) * hauteur - marge) return false;
        nouvellePage();
        return true;
    };

    /* --- En-tête --- */
    bandeau();
    const debut = marge + 14;

    let yGauche = debut;
    if (entreprise.nom) {
        ecrire(entreprise.nom, marge, yGauche, `700 44px ${POLICE_TITRE}`, COULEURS.petrole);
        yGauche += 62;
    }
    [entreprise.adresse, entreprise.contact].filter(Boolean).forEach((ligne) => {
        ecrire(ligne, marge, yGauche, `400 24px ${POLICE}`, COULEURS.douce);
        yGauche += 34;
    });

    let yDroite = debut;
    ecrire("Devis", droite, yDroite, `700 72px ${POLICE_TITRE}`, COULEURS.petrole, "right");
    yDroite += 90;
    if (etat.numero) {
        ecrire(`N° ${etat.numero}`, droite, yDroite, `600 26px ${POLICE}`, COULEURS.encre, "right");
        yDroite += 38;
    }
    if (etat.date) {
        ecrire(formaterDate(etat.date), droite, yDroite, `400 24px ${POLICE}`, COULEURS.douce, "right");
        yDroite += 34;
    }

    y = Math.max(yGauche, yDroite) + 36;

    /* --- Client --- */
    if (client.nom || client.contact) {
        trait(y, COULEURS.trait);
        y += 28;
        ecrire("Client", marge, y, `400 22px ${POLICE}`, COULEURS.douce);
        y += 32;
        if (client.nom) {
            ecrire(client.nom, marge, y, `600 32px ${POLICE}`, COULEURS.encre);
            y += 46;
        }
        if (client.contact) {
            ecrire(client.contact, marge, y, `400 24px ${POLICE}`, COULEURS.douce);
            y += 34;
        }
    }
    y += 40;

    /* --- Tableau --- */
    const colonnes = {
        numero: marge,
        designation: marge + 70,
        quantite: marge + 650,
        prix: marge + 850,
        montant: droite,
    };
    const largeurDesignation = 500;
    const hauteurLigne = 34;

    const dessinerEnteteTableau = () => {
        const police = `600 21px ${POLICE}`;
        ecrire("N°", colonnes.numero, y, police, COULEURS.petrole);
        ecrire("Désignation", colonnes.designation, y, police, COULEURS.petrole);
        ecrire("Qté", colonnes.quantite, y, police, COULEURS.petrole, "right");
        ecrire("Prix unitaire", colonnes.prix, y, police, COULEURS.petrole, "right");
        ecrire("Montant", colonnes.montant, y, police, COULEURS.petrole, "right");
        y += 38;
        trait(y, COULEURS.petrole, 3);
        y += 3;
    };

    dessinerEnteteTableau();

    etat.materiels.forEach((materiel, index) => {
        ctx.font = `500 24px ${POLICE}`;
        const lignes = decouperTexte(ctx, materiel.nom, largeurDesignation);
        const hauteurRangee = lignes.length * hauteurLigne + 32;

        if (assurerEspace(hauteurRangee)) dessinerEnteteTableau();

        const haut = y + 16;
        ecrire(index + 1, colonnes.numero, haut, `400 24px ${POLICE}`, COULEURS.pale);
        lignes.forEach((ligne, rang) => {
            ecrire(ligne, colonnes.designation, haut + rang * hauteurLigne, `500 24px ${POLICE}`, COULEURS.encre);
        });
        ecrire(materiel.quantite, colonnes.quantite, haut, `400 24px ${POLICE}`, COULEURS.encre, "right");
        ecrire(formaterNombre(materiel.prix), colonnes.prix, haut, `400 24px ${POLICE}`, COULEURS.encre, "right");
        ecrire(
            formaterNombre(materiel.quantite * materiel.prix),
            colonnes.montant,
            haut,
            `500 24px ${POLICE}`,
            COULEURS.encre,
            "right"
        );

        y += hauteurRangee;
        trait(y, COULEURS.trait);
    });

    /* --- Totaux --- */
    const totaux = calculerTotaux();
    const lignesTotaux = [
        [`Sous-total (${libelleArticles(etat.materiels.length)})`, `${formaterMontant(totaux.sousTotal)}`],
    ];
    if (etat.remise > 0) {
        lignesTotaux.push([`Remise (${formaterNombre(etat.remise)} %)`, `- ${formaterMontant(totaux.montantRemise)}`]);
    }
    if (etat.tva > 0) {
        lignesTotaux.push([`TVA (${formaterNombre(etat.tva)} %)`, `+ ${formaterMontant(totaux.montantTva)}`]);
    }

    const largeurBloc = 600;
    const hauteurTotal = 100;
    y += 30;
    assurerEspace(lignesTotaux.length * 46 + 14 + hauteurTotal);

    const gauche = droite - largeurBloc;
    lignesTotaux.forEach(([libelle, valeur]) => {
        ecrire(libelle, gauche, y, `400 24px ${POLICE}`, COULEURS.douce);
        ecrire(valeur, droite, y, `500 24px ${POLICE}`, COULEURS.encre, "right");
        y += 46;
    });
    y += 14;

    ctx.fillStyle = COULEURS.petrole;
    tracerRectArrondi(ctx, gauche, y, largeurBloc, hauteurTotal, 10);
    ctx.fill();

    ecrire(etat.tva > 0 ? "Total TTC" : "Total", gauche + 28, y + 36, `500 26px ${POLICE}`, COULEURS.blanc);
    ecrire(`${formaterMontant(totaux.totalTtc)}`, droite - 28, y + 26, `700 46px ${POLICE_TITRE}`, COULEURS.ambre, "right");
    y += hauteurTotal;

    return page + 1;
}

function creerCanvasDevis() {
    // 1re passe : mesure du nombre de pages
    const mesure = document.createElement("canvas");
    mesure.width = PAGE.largeur;
    mesure.height = PAGE.hauteur;
    const pages = dessinerDevis(mesure.getContext("2d"));

    // 2e passe : dessin réel
    const canvas = document.createElement("canvas");
    canvas.width = PAGE.largeur;
    canvas.height = PAGE.hauteur * pages;

    const ctx = canvas.getContext("2d");
    ctx.fillStyle = COULEURS.blanc;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    dessinerDevis(ctx);

    return { canvas, pages };
}

/* ==========================================================================
   Export : PNG et PDF
   ========================================================================== */
function canvasVersBlob(canvas, type, qualite) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(
            (blob) => (blob ? resolve(blob) : reject(new Error("Export impossible"))),
            type,
            qualite
        );
    });
}

function telecharger(blob, nomFichier) {
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = nomFichier;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function nomFichier() {
    const numero = (etat.numero || "").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "");
    return numero ? `Devis-${numero}` : "Devis";
}

function jpegDePage(canvas, numeroPage) {
    const tranche = document.createElement("canvas");
    tranche.width = PAGE.largeur;
    tranche.height = PAGE.hauteur;

    const ctx = tranche.getContext("2d");
    ctx.drawImage(canvas, 0, -numeroPage * PAGE.hauteur);

    const donnees = atob(tranche.toDataURL("image/jpeg", 0.92).split(",")[1]);
    return Uint8Array.from(donnees, (caractere) => caractere.charCodeAt(0));
}

/**
 * Construit un PDF (une image JPEG par page A4), sans bibliothèque externe.
 */
function construirePdf(canvas, pages) {
    const encodeur = new TextEncoder();
    const morceaux = [];
    const positions = [];
    let longueur = 0;

    const ecrire = (donnees) => {
        const octets = typeof donnees === "string" ? encodeur.encode(donnees) : donnees;
        morceaux.push(octets);
        longueur += octets.length;
    };

    const debutObjet = (id) => {
        positions[id] = longueur;
        ecrire(`${id} 0 obj\n`);
    };

    const nombreObjets = 2 + pages * 3;
    const pagesRefs = Array.from({ length: pages }, (_, i) => `${3 + i * 3} 0 R`).join(" ");

    ecrire("%PDF-1.4\n");

    debutObjet(1);
    ecrire("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

    debutObjet(2);
    ecrire(`<< /Type /Pages /Kids [${pagesRefs}] /Count ${pages} >>\nendobj\n`);

    for (let i = 0; i < pages; i++) {
        const idPage = 3 + i * 3;
        const idContenu = idPage + 1;
        const idImage = idPage + 2;
        const { largeur, hauteur } = PDF_A4;

        debutObjet(idPage);
        ecrire(
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${largeur} ${hauteur}] ` +
            `/Resources << /XObject << /Im0 ${idImage} 0 R >> >> /Contents ${idContenu} 0 R >>\nendobj\n`
        );

        const flux = `q ${largeur} 0 0 ${hauteur} 0 0 cm /Im0 Do Q`;
        debutObjet(idContenu);
        ecrire(`<< /Length ${flux.length} >>\nstream\n${flux}\nendstream\nendobj\n`);

        const jpeg = jpegDePage(canvas, i);
        debutObjet(idImage);
        ecrire(
            `<< /Type /XObject /Subtype /Image /Width ${PAGE.largeur} /Height ${PAGE.hauteur} ` +
            `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
        );
        ecrire(jpeg);
        ecrire("\nendstream\nendobj\n");
    }

    const debutXref = longueur;
    ecrire(`xref\n0 ${nombreObjets + 1}\n0000000000 65535 f \n`);
    for (let id = 1; id <= nombreObjets; id++) {
        ecrire(`${String(positions[id]).padStart(10, "0")} 00000 n \n`);
    }
    ecrire(`trailer\n<< /Size ${nombreObjets + 1} /Root 1 0 R >>\nstartxref\n${debutXref}\n%%EOF`);

    return new Blob(morceaux, { type: "application/pdf" });
}

async function exporter(format) {
    const boutons = [$("btn-png"), $("btn-pdf")];
    const statut = $("recap-statut");

    boutons.forEach((bouton) => (bouton.disabled = true));
    statut.textContent = "Préparation du fichier…";

    try {
        await document.fonts.ready;
        const { canvas, pages } = creerCanvasDevis();

        if (format === "png") {
            telecharger(await canvasVersBlob(canvas, "image/png"), `${nomFichier()}.png`);
        } else {
            telecharger(construirePdf(canvas, pages), `${nomFichier()}.pdf`);
        }

        statut.textContent = `Fichier ${format.toUpperCase()} enregistré.`;
    } catch (erreur) {
        console.error(erreur);
        statut.textContent = "L'export a échoué. Réessayez.";
    } finally {
        boutons.forEach((bouton) => (bouton.disabled = false));
    }
}

/* ==========================================================================
   Événements et démarrage
   ========================================================================== */
function initialiserEvenements() {
    formInfos.addEventListener("submit", validerInfos);

    formMateriel.addEventListener("submit", soumettreMateriel);
    $("btn-annuler").addEventListener("click", quitterEdition);
    liste.addEventListener("click", gererActionsListe);

    $("btn-retour").addEventListener("click", () => allerEtape(1));
    $("btn-soumettre").addEventListener("click", ouvrirRecap);

    $("btn-fermer").addEventListener("click", fermerRecap);
    $("btn-modifier").addEventListener("click", fermerRecap);
    $("btn-nouveau").addEventListener("click", nouveauDevis);
    $("btn-png").addEventListener("click", () => exporter("png"));
    $("btn-pdf").addEventListener("click", () => exporter("pdf"));

    // Fermeture en cliquant sur le fond sombre
    recap.addEventListener("click", (evenement) => {
        if (evenement.target === recap) fermerRecap();
    });

    // Retour à l'étape des matériels quand le récapitulatif se ferme
    recap.addEventListener("close", () => afficherProgression(etat.etape));
}

function init() {
    remplirDevises();
    initialiserEvenements();
    allerEtape(etat.etape === 2 ? 2 : 1);
}

init();

/* ==========================================================================
   PWA : service worker et installation
   ========================================================================== */
const boutonInstaller = $("btn-installer");
const dialogInstall = $("dialog-install");

const estInstallee = () =>
    window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;

const estIos = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

function mettreAJourBoutonInstaller() {
    boutonInstaller.hidden = estInstallee();
}

function enregistrerServiceWorker() {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

    const enregistrer = () =>
        navigator.serviceWorker.register("sw.js").catch((erreur) => {
            console.warn("Service worker non enregistré :", erreur);
        });

    if (document.readyState === "complete") enregistrer();
    else window.addEventListener("load", enregistrer);
}

async function diagnostiquer() {
    const resultats = [];
    const ajouter = (ok, texte) => resultats.push({ ok, texte });

    ajouter(window.isSecureContext, window.isSecureContext
        ? "Connexion sécurisée (HTTPS)"
        : "Le site n'est pas en HTTPS : l'installation est impossible");

    ajouter("serviceWorker" in navigator, "serviceWorker" in navigator
        ? "Service worker pris en charge"
        : "Service worker non pris en charge par ce navigateur");

    try {
        const reponse = await fetch("manifest.webmanifest", { cache: "no-store" });
        ajouter(reponse.ok, reponse.ok
            ? "Fichier manifest.webmanifest trouvé"
            : `manifest.webmanifest introuvable (erreur ${reponse.status})`);
    } catch {
        ajouter(false, "manifest.webmanifest inaccessible");
    }

    try {
        const reponse = await fetch("sw.js", { cache: "no-store" });
        ajouter(reponse.ok, reponse.ok
            ? "Fichier sw.js trouvé"
            : `sw.js introuvable (erreur ${reponse.status})`);
    } catch {
        ajouter(false, "sw.js inaccessible");
    }

    try {
        const reponse = await fetch("icons/icon-512.png", { cache: "no-store" });
        ajouter(reponse.ok, reponse.ok
            ? "Icônes trouvées"
            : `Icônes introuvables (erreur ${reponse.status}) : le dossier « icons » est mal placé`);
    } catch {
        ajouter(false, "Icônes inaccessibles");
    }

    if ("serviceWorker" in navigator) {
        const inscription = await navigator.serviceWorker.getRegistration().catch(() => null);
        ajouter(Boolean(inscription), inscription
            ? "Service worker enregistré"
            : "Service worker pas encore enregistré (rechargez la page)");
    }

    return resultats;
}

function creerListe(balise, elements) {
    const liste = document.createElement(balise);
    elements.forEach((texte) => liste.appendChild(creerElement("li", texte)));
    return liste;
}

async function ouvrirAideInstallation() {
    const corps = $("install-corps");
    const blocs = [];

    if (estIos()) {
        blocs.push(
            creerElement("p", "Sur iPhone et iPad, l'installation se fait depuis Safari :"),
            creerListe("ol", [
                "Ouvrez ce site dans Safari (pas dans Chrome).",
                "Touchez le bouton Partager (carré avec une flèche vers le haut).",
                "Choisissez « Sur l'écran d'accueil », puis « Ajouter ».",
                "Lancez l'application depuis la nouvelle icône.",
            ])
        );
    } else {
        blocs.push(
            creerElement(
                "p",
                "Le navigateur ne propose pas l'installation automatique pour le moment. Essayez ceci :"
            ),
            creerListe("ol", [
                "Ouvrez ce site directement dans Chrome (pas dans WhatsApp, Facebook ou un onglet privé).",
                "Touchez le menu ⋮ en haut à droite.",
                "Choisissez « Installer l'application » (ou « Ajouter à l'écran d'accueil » puis « Installer »).",
                "Si l'option n'apparaît pas, attendez quelques secondes, rechargez la page et réessayez.",
            ])
        );
    }

    corps.replaceChildren(...blocs, creerElement("h3", "Diagnostic"), creerElement("p", "Vérification en cours…"));
    if (!dialogInstall.open) dialogInstall.showModal();

    const resultats = await diagnostiquer();
    const liste = document.createElement("ul");
    resultats.forEach(({ ok, texte }) => {
        liste.appendChild(creerElement("li", texte, ok ? "diag-ok" : "diag-ko"));
    });
    corps.lastElementChild.replaceWith(liste);
}

async function installer() {
    const invitation = window.__invitationInstallation;

    if (!invitation) {
        ouvrirAideInstallation();
        return;
    }

    window.__invitationInstallation = null;
    try {
        await invitation.prompt();
        await invitation.userChoice;
    } catch (erreur) {
        console.warn("Installation interrompue :", erreur);
    }
}

function initialiserPwa() {
    enregistrerServiceWorker();
    mettreAJourBoutonInstaller();

    boutonInstaller.addEventListener("click", installer);
    $("btn-install-fermer").addEventListener("click", () => dialogInstall.close());
    dialogInstall.addEventListener("click", (evenement) => {
        if (evenement.target === dialogInstall) dialogInstall.close();
    });

    window.addEventListener("appinstalled", () => {
        window.__invitationInstallation = null;
        if (dialogInstall.open) dialogInstall.close();
        boutonInstaller.hidden = true;
    });

    window.matchMedia("(display-mode: standalone)").addEventListener?.("change", mettreAJourBoutonInstaller);
}

initialiserPwa();
