/**
 * horoskopi.js — Faqja e horoskopit të detajuar (12 shenjat).
 *
 * Të dhënat vijnë nga data/horoskopi.json, që e prodhon scripts/gjenero_horoskopin.py.
 */

import { elem, dataNeShqip, sotNeTirane, linkISigurt } from "./utils.js";

// "︎" i kërkon shfletuesit ta vizatojë simbolin ♈ si tekst (me ngjyrën tonë), jo si emoji
export const simboliSiTekst = (simboli) => `${simboli}︎`;

/** Dita që shfaqet fillimisht: sot, ose dita më e afërt para sot, ose më e reja që kemi. */
export function ditaParazgjedhur(horoskopi) {
  const ditet = Object.keys(horoskopi?.dite ?? {}).sort().reverse();
  const sot = sotNeTirane();
  return ditet.includes(sot) ? sot : (ditet.find((d) => d <= sot) ?? ditet[0]);
}

/** Karta e detajuar e një shenje. */
function kartaEShenjes(s) {
  const fushat = s.fushat.map((f) => elem("div", {
    klasa: "shenja__fusha",
    femijet: [
      elem("dt", { femijet: [
        elem("span", { teksti: f.titulli }),
        elem("span", {
          klasa: "yjet",
          teksti: "★".repeat(f.yje) + "☆".repeat(5 - f.yje),
          atribute: { "aria-label": `${f.yje} nga 5 yje` },
        }),
      ] }),
      elem("dd", { teksti: f.teksti }),
    ],
  }));

  const fati = [["Numri me fat", s.numri], ["Ngjyra", s.ngjyra], ["Përputhje", s.perputhja]]
    .map(([emri, vlera]) => elem("li", { femijet: [document.createTextNode(`${emri}: `), elem("b", { teksti: vlera })] }));

  return elem("article", {
    klasa: "shenja",
    atribute: { id: `shenja-${s.emri}`, "data-elementi": s.elementi },
    femijet: [
      elem("header", { klasa: "shenja__koka", femijet: [
        elem("span", { klasa: "shenja__simboli", teksti: simboliSiTekst(s.simboli), atribute: { "aria-hidden": "true" } }),
        elem("div", { femijet: [
          elem("h2", { klasa: "shenja__emri", teksti: s.emri }),
          elem("p", { klasa: "shenja__datat", teksti: `${s.datat} · ${s.elementi}` }),
        ] }),
      ] }),
      elem("p", { klasa: "shenja__pergjithshme", teksti: s.pergjithshme }),
      elem("dl", { klasa: "shenja__fushat", femijet: fushat }),
      elem("p", { klasa: "shenja__keshilla", femijet: [elem("strong", { teksti: "Këshilla e ditës: " }), document.createTextNode(s.keshilla)] }),
      elem("ul", { klasa: "shenja__fati", femijet: fati }),
    ],
  });
}

/**
 * @param {HTMLElement} pamja
 * @param {{ horoskopi: object|null, lajmet: object[], parametrat: URLSearchParams }} opsione
 */
export function vizatoHoroskopin(pamja, { horoskopi, lajmet, parametrat }) {
  pamja.append(elem("header", {
    klasa: "seksion-koka seksion-koka--horoskop",
    femijet: [
      elem("p", { klasa: "seksion-koka__mbititull", teksti: "12 shenjat e zodiakut" }),
      elem("h1", { klasa: "seksion-koka__titulli", teksti: "Horoskopi" }),
      horoskopi?.shenim ? elem("p", { klasa: "seksion-koka__pershkrimi", teksti: horoskopi.shenim }) : null,
    ],
  }));

  const ditet = Object.keys(horoskopi?.dite ?? {}).sort().reverse();
  if (ditet.length === 0) {
    pamja.append(elem("p", { klasa: "bosh", teksti: "Horoskopi nuk është gjeneruar ende (scripts/gjenero_horoskopin.py)." }));
    return () => {};
  }

  // Gjendja e faqes: dita dhe shenja (shenja mund të vijë nga linku, p.sh. nga Ballina)
  const gjendja = { dita: ditaParazgjedhur(horoskopi), shenja: parametrat.get("shenja") ?? "" };
  const sot = sotNeTirane();

  // --- Kontrollet: dita (select) dhe shenjat (rrota me 12 butona) ---
  const zgjedhesiDites = elem("select", { atribute: { "aria-label": "Dita" } });
  for (const d of ditet) zgjedhesiDites.add(new Option(d === sot ? `Sot · ${dataNeShqip(d)}` : dataNeShqip(d), d));
  zgjedhesiDites.value = gjendja.dita;

  const shenjat = horoskopi.dite[ditet[0]];
  const butonat = [{ emri: "", simboli: "✦" }, ...shenjat].map((s) => elem("button", {
    klasa: "zodiak__butoni",
    atribute: { type: "button", "data-shenja": s.emri, title: s.emri || "Të gjitha shenjat" },
    femijet: [
      elem("span", { klasa: "zodiak__simboli", teksti: simboliSiTekst(s.simboli), atribute: { "aria-hidden": "true" } }),
      elem("span", { klasa: "zodiak__emri", teksti: s.emri || "Të gjitha" }),
    ],
  }));

  pamja.append(elem("div", {
    klasa: "zodiak",
    femijet: [
      elem("label", { klasa: "filtrat__fusha", femijet: [elem("span", { teksti: "Dita" }), zgjedhesiDites] }),
      elem("div", { klasa: "zodiak__rrota", atribute: { role: "group", "aria-label": "Shenja" }, femijet: butonat }),
    ],
  }));

  const rrjeta = elem("div", { klasa: "horoskop-rrjeta" });
  const neMedia = elem("div");
  pamja.append(rrjeta, neMedia);

  zgjedhesiDites.addEventListener("change", () => { gjendja.dita = zgjedhesiDites.value; vizato(); });
  butonat.forEach((b) => b.addEventListener("click", () => { gjendja.shenja = b.dataset.shenja; vizato(); }));

  function vizato() {
    butonat.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.shenja === gjendja.shenja)));
    rrjeta.replaceChildren(...horoskopi.dite[gjendja.dita]
      .filter((s) => !gjendja.shenja || s.emri === gjendja.shenja)
      .map(kartaEShenjes));
    rrjeta.classList.toggle("horoskop-rrjeta--nje", Boolean(gjendja.shenja));

    // Linket te horoskopët e mediave për të njëjtën ditë (nëse skripti i lajmeve ka gjetur)
    const linket = lajmet.filter((l) => l.rubrika === "Horoskop" && l.data === gjendja.dita && linkISigurt(l.url));
    neMedia.replaceChildren(...(linket.length ? [
      elem("h2", { klasa: "dita__titulli", femijet: [elem("span", { teksti: "Horoskopi në media" })] }),
      elem("ul", { klasa: "lista-linqesh", femijet: linket.map((l) => elem("li", { femijet: [
        elem("a", { teksti: `${l.titulli} · ${l.burimi}`, atribute: { href: linkISigurt(l.url), target: "_blank", rel: "noopener noreferrer" } }),
      ] })) }),
    ] : []));
  }

  vizato();
  return () => {};
}
