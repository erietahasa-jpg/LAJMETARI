/**
 * main.js — Pika e nisjes së faqes.
 *
 *   1. Ngarkon të dhënat (lajmet, meta, horoskopi, lojërat) një herë të vetme.
 *   2. Plotëson kokën e gazetës: data, numri i botimit, shiriti i lajmeve të fundit.
 *   3. Drejton navigimin: adresa pas "#" vendos se cila faqe shfaqet
 *      (#ballina, #lajmet, #roze, #horoskopi, #lojera, #lojera/sudoku …).
 *   4. Menaxhon temën e ndritshme/të errët.
 */

import { elem, dataNeShqip, oraNeShqip, sotNeTirane, diteMes, lexo, ruaj, paLevizje, linkISigurt } from "./utils.js";
import { vizatoBallinen } from "./ballina.js";
import { vizatoLajmet, eshteLajmIZakonshem } from "./lajmet.js";
import { vizatoHoroskopin } from "./horoskopi.js";
import { vizatoLojerat } from "./lojera/index.js";

const DATA_E_BOTIMIT_TE_PARE = "2026-10-07";   // nga kjo datë numërohen botimet

const el = {
  pamja: document.getElementById("pamja"),
  dataSot: document.getElementById("data-sot"),
  botimi: document.getElementById("botimi"),
  perditesuar: document.getElementById("perditesuar"),
  shiriti: document.getElementById("shiriti"),
  linqet: document.querySelectorAll("[data-rruga]"),
  tema: document.getElementById("ndrysho-temen"),
  kalo: document.querySelector(".kalo"),
};

// Të dhënat e ngarkuara; mbushen te nis()
const te_dhenat = { lajmet: [], meta: null, horoskopi: null, lojera: null };
let pastroPamjen = () => {};                    // funksioni i pastrimit të faqes aktuale

// ---------------------------------------------------------------------------
// 1. NGARKIMI I TË DHËNAVE
// ---------------------------------------------------------------------------

/** Shkarkon një JSON; kthen null nëse mungon (asnjë skedar përveç lajmeve s'është i detyrueshëm). */
async function merrJson(shtegu) {
  try {
    const pergjigja = await fetch(shtegu, { cache: "no-cache" });
    return pergjigja.ok ? await pergjigja.json() : null;
  } catch {
    return null;
  }
}

/** Rendit lajmet: data më e re sipër; brenda ditës Shqipëria para Kosovës, pastaj sipas id-së. */
function renditLajmet(lajmet) {
  return [...lajmet].sort((a, b) =>
    b.data.localeCompare(a.data) ||
    (a.vendi === b.vendi ? 0 : a.vendi === "Shqipëri" ? -1 : 1) ||
    a.id.localeCompare(b.id));
}

// ---------------------------------------------------------------------------
// 2. KOKA E GAZETËS
// ---------------------------------------------------------------------------

function plotesoKoken() {
  const sot = sotNeTirane();
  el.dataSot.textContent = dataNeShqip(sot);
  el.botimi.textContent = `Botimi nr. ${diteMes(DATA_E_BOTIMIT_TE_PARE, sot) + 1}`;
  if (te_dhenat.meta?.perditesuar) el.perditesuar.textContent = `Përditësuar ${oraNeShqip(te_dhenat.meta.perditesuar)}`;
  plotesoShiritin();
}

/**
 * Shiriti lëvizës "Të fundit": titujt e ditës së fundit, që të çojnë te burimi.
 * Lista vendoset dy herë radhazi, që lëvizja të duket e pandërprerë.
 */
function plotesoShiritin() {
  const teZakonshme = te_dhenat.lajmet.filter(eshteLajmIZakonshem);
  const ditaEFundit = teZakonshme[0]?.data;
  const titujt = teZakonshme.filter((l) => l.data === ditaEFundit && linkISigurt(l.url)).slice(0, 12);
  if (!titujt.length) {
    el.shiriti.hidden = true;
    return;
  }

  const krijoListen = (eFshehur) => elem("ul", {
    klasa: "shiriti__lista",
    atribute: eFshehur ? { "aria-hidden": "true" } : {},
    femijet: titujt.map((l) => elem("li", { femijet: [
      elem("span", { klasa: "shiriti__burimi", teksti: l.burimi }),
      elem("a", {
        teksti: l.titulli,
        atribute: { href: linkISigurt(l.url), target: "_blank", rel: "noopener noreferrer", ...(eFshehur ? { tabindex: "-1" } : {}) },
      }),
    ] })),
  });

  const pista = el.shiriti.querySelector(".shiriti__pista");
  pista.replaceChildren(krijoListen(false), krijoListen(true));
  // Shpejtësia: rreth 6 sekonda për çdo titull, që leximi të jetë i rehatshëm
  pista.style.setProperty("--kohezgjatja", `${titujt.length * 6}s`);
  if (paLevizje()) el.shiriti.classList.add("shiriti--statik");
}

// ---------------------------------------------------------------------------
// 3. NAVIGIMI
// ---------------------------------------------------------------------------

/** "#lojera/sudoku?x=1" → { rruga: "lojera", nen: "sudoku", parametrat } */
function lexoAdresen() {
  const [shtegu, kerkimi = ""] = decodeURIComponent(location.hash.slice(1)).split("?");
  const [rruga = "ballina", nen] = shtegu.split("/");
  return { rruga: rruga || "ballina", nen, parametrat: new URLSearchParams(kerkimi) };
}

const FAQET = {
  ballina: { titulli: null, vizato: (p) => vizatoBallinen(p, { ...te_dhenat, data: sotNeTirane() }) },
  lajmet: { titulli: "Lajmet", vizato: (p, a) => vizatoLajmet(p, { lajmet: te_dhenat.lajmet, seksioni: "", parametrat: a.parametrat }) },
  roze: { titulli: "Rozë · VIP", vizato: (p, a) => vizatoLajmet(p, { lajmet: te_dhenat.lajmet, seksioni: "Rozë", parametrat: a.parametrat }) },
  horoskopi: { titulli: "Horoskopi", vizato: (p, a) => vizatoHoroskopin(p, { horoskopi: te_dhenat.horoskopi, lajmet: te_dhenat.lajmet, parametrat: a.parametrat }) },
  lojera: { titulli: "Lojëra", vizato: (p, a) => vizatoLojerat(p, { data: sotNeTirane(), lojera: te_dhenat.lojera, idLojes: a.nen }) },
};

/** Shfaq faqen që i përgjigjet adresës aktuale. */
function shfaqFaqen() {
  const adresa = lexoAdresen();
  const faqja = FAQET[adresa.rruga] ?? FAQET.ballina;

  pastroPamjen();                                // ndal kronometrat etj. të faqes së mëparshme
  el.pamja.replaceChildren();
  el.pamja.classList.remove("hyrje");
  void el.pamja.offsetWidth;                     // rinis animacionin e hyrjes
  el.pamja.classList.add("hyrje");
  pastroPamjen = faqja.vizato(el.pamja, adresa) ?? (() => {});
  // Koka e madhe e gazetës vetëm në Ballinë; në faqet e tjera zvogëlohet (CSS: body.e-brendshme)
  document.body.classList.toggle("e-brendshme", faqja !== FAQET.ballina);

  // Theksojmë skedën aktive dhe përditësojmë titullin e skedës së shfletuesit
  el.linqet.forEach((a) => {
    if (a.dataset.rruga === adresa.rruga) a.setAttribute("aria-current", "page");
    else a.removeAttribute("aria-current");
  });
  document.title = faqja.titulli ? `${faqja.titulli} · Lajmëtari AL·KS` : "Lajmëtari AL·KS";
  window.scrollTo({ top: 0, behavior: "instant" });
}

// ---------------------------------------------------------------------------
// 4. TEMA E NDRITSHME / E ERRËT
// ---------------------------------------------------------------------------
// Pa zgjedhje të ruajtur ndiqet tema e sistemit (CSS: prefers-color-scheme).
// Butoni e kalon në të kundërtën dhe e mban mend zgjedhjen.

function temaAktuale() {
  return document.documentElement.dataset.theme
    ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}

function vendosTemen(tema) {
  document.documentElement.dataset.theme = tema;
  el.tema.setAttribute("aria-label", tema === "dark" ? "Kalo në temën e ndritshme" : "Kalo në temën e errët");
  el.tema.textContent = tema === "dark" ? "☀" : "☾";
}

// ---------------------------------------------------------------------------
// NISJA
// ---------------------------------------------------------------------------

async function nis() {
  // Lidhja "Kalo te përmbajtja" vetëm fokuson përmbajtjen, pa e ndryshuar adresën "#"
  el.kalo.addEventListener("click", (e) => {
    e.preventDefault();
    el.pamja.focus();
  });

  const temaRuajtur = lexo("tema");
  vendosTemen(temaRuajtur ?? temaAktuale());
  if (!temaRuajtur) delete document.documentElement.dataset.theme;   // vazhdo të ndjekësh sistemin
  el.tema.addEventListener("click", () => {
    const eRe = temaAktuale() === "dark" ? "light" : "dark";
    vendosTemen(eRe);
    ruaj("tema", eRe);
  });

  const [lajmet, meta, horoskopi, lojera] = await Promise.all([
    merrJson("data/lajme.json"),
    merrJson("data/meta.json"),
    merrJson("data/horoskopi.json"),
    merrJson("data/lojera.json"),
  ]);

  if (!lajmet) {
    el.pamja.replaceChildren(elem("p", {
      klasa: "bosh",
      teksti: "Lajmet nuk u ngarkuan. Nëse e hap faqen nga kompjuteri, nise me: python -m http.server",
    }));
    return;
  }

  Object.assign(te_dhenat, { lajmet: renditLajmet(lajmet), meta, horoskopi, lojera });
  plotesoKoken();
  window.addEventListener("hashchange", shfaqFaqen);
  shfaqFaqen();
  document.body.classList.add("gati");          // nis animacionin e hapjes së kokës
}

nis();
