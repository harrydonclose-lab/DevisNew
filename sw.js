"use strict";

// Incrémentez cette version à chaque modification des fichiers pour forcer la mise à jour
const VERSION = "devis-v2";
const CACHE_APP = `${VERSION}-app`;
const CACHE_POLICES = `${VERSION}-polices`;

const FICHIERS_APP = [
    "./",
    "./index.html",
    "./style.css",
    "./script.js",
    "./manifest.webmanifest",
    "./icons/icon-192.png",
    "./icons/icon-512.png",
    "./icons/icon-maskable-512.png",
    "./icons/apple-touch-icon.png",
    "./icons/favicon-32.png",
];

const HOTES_POLICES = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", (evenement) => {
    // Un fichier manquant ne doit jamais empêcher l'installation du service worker
    evenement.waitUntil(
        caches
            .open(CACHE_APP)
            .then((cache) =>
                Promise.allSettled(
                    FICHIERS_APP.map((url) => cache.add(new Request(url, { cache: "reload" })))
                )
            )
            .then(() => self.skipWaiting())
    );
});

self.addEventListener("activate", (evenement) => {
    evenement.waitUntil(
        caches
            .keys()
            .then((cles) =>
                Promise.all(
                    cles
                        .filter((cle) => cle !== CACHE_APP && cle !== CACHE_POLICES)
                        .map((cle) => caches.delete(cle))
                )
            )
            .then(() => self.clients.claim())
    );
});

// Polices Google : on sert le cache et on le rafraîchit en arrière-plan
async function staleWhileRevalidate(requete) {
    const cache = await caches.open(CACHE_POLICES);
    const enCache = await cache.match(requete);

    const reseau = fetch(requete)
        .then((reponse) => {
            if (reponse && (reponse.ok || reponse.type === "opaque")) {
                cache.put(requete, reponse.clone());
            }
            return reponse;
        })
        .catch(() => null);

    return enCache || (await reseau) || Response.error();
}

// Fichiers de l'application : cache d'abord, réseau en secours
async function cacheDabord(requete) {
    const enCache = await caches.match(requete, { ignoreSearch: true });
    if (enCache) return enCache;

    try {
        const reponse = await fetch(requete);
        if (reponse.ok) {
            const cache = await caches.open(CACHE_APP);
            cache.put(requete, reponse.clone());
        }
        return reponse;
    } catch {
        if (requete.mode === "navigate") {
            const accueil = await caches.match("./index.html");
            if (accueil) return accueil;
        }
        return Response.error();
    }
}

self.addEventListener("fetch", (evenement) => {
    const requete = evenement.request;
    if (requete.method !== "GET") return;

    const url = new URL(requete.url);

    if (HOTES_POLICES.includes(url.hostname)) {
        evenement.respondWith(staleWhileRevalidate(requete));
        return;
    }

    if (url.origin === self.location.origin) {
        evenement.respondWith(cacheDabord(requete));
    }
});
