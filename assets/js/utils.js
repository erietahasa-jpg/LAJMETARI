/**
 * utils.js — Funksione të vogla ndihmëse që i përdorin të gjitha pjesët e faqes.
 *
 * Çdo funksion bën vetëm një gjë dhe nuk varet nga pjesa tjetër e aplikacionit,
 * prandaj mund të testohet dhe të ripërdoret lehtë.
 */

// ---------------------------------------------------------------------------
// DOM: krijimi i elementeve
// ---------------------------------------------------------------------------

/**
 * Krijon një element HTML.
 * Teksti vendoset gjithmonë me textContent, kurrë si HTML, që përmbajtja nga
 * feed-et e jashtme të mos ekzekutohet si kod.
 *
 * @param {string} etiketa  p.sh. "div", "h2", "button"
 * @param {object} [opsione]  { klasa, teksti, atribute: {emri: vlera}, femijet: [Node] }
 */
export function elem(etiketa, { klasa, teksti, atribute, femijet } = {}) {
  const e = document.createElement(etiketa);
  if (klasa) e.className = klasa;
  if (teksti !== undefined && teksti !== null) e.textContent = String(teksti);
  if (atribute) {
    for (const [emri, vlera] of Object.entries(atribute)) e.setAttribute(emri, vlera);
  }
  if (femijet) e.append(...femijet.filter(Boolean));
  return e;
}

/** Lejon vetëm linke http/https; një "javascript:..." nga një feed do të ishte i rrezikshëm. */
export function linkISigurt(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// DATAT NË SHQIP
// ---------------------------------------------------------------------------

// Emrat i shkruajmë vetë: jo çdo shfletues ka të dhënat e shqipes për Intl.DateTimeFormat.
const DITET = ["E diel", "E hënë", "E martë", "E mërkurë", "E enjte", "E premte", "E shtunë"];
export const MUAJT = ["janar", "shkurt", "mars", "prill", "maj", "qershor",
  "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];

/** "2026-11-07" → "E shtunë, 7 nëntor 2026" */
export function dataNeShqip(isoData) {
  const d = new Date(`${isoData}T12:00:00Z`);   // mesditë UTC: dita nuk zhvendoset nga zona orare
  return `${DITET[d.getUTCDay()]}, ${d.getUTCDate()} ${MUAJT[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "2026-11-07" → "7 nëntor" (version i shkurtër, për etiketa) */
export function dataEShkurter(isoData) {
  const d = new Date(`${isoData}T12:00:00Z`);
  return `${d.getUTCDate()} ${MUAJT[d.getUTCMonth()]}`;
}

/** Kohë ISO (UTC) → ora e Tiranës: "8 nëntor 2026, 07:56" */
export function oraNeShqip(isoKohe) {
  const pjeset = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Tirane", year: "numeric", month: "numeric", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: false,
    }).formatToParts(new Date(isoKohe)).map((p) => [p.type, p.value]),
  );
  return `${Number(pjeset.day)} ${MUAJT[pjeset.month - 1]} ${pjeset.year}, ${pjeset.hour}:${pjeset.minute}`;
}

/** Data e sotme sipas orës së Tiranës, "YYYY-MM-DD" ("en-CA" e jep pikërisht në këtë format). */
export function sotNeTirane() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Tirane" }).format(new Date());
}

/** Numri i ditëve nga data1 te data2 (të dyja "YYYY-MM-DD"). */
export function diteMes(data1, data2) {
  return Math.round((Date.parse(`${data2}T00:00:00Z`) - Date.parse(`${data1}T00:00:00Z`)) / 86_400_000);
}

// ---------------------------------------------------------------------------
// TEKSTI
// ---------------------------------------------------------------------------

/** Shkronja të vogla, pa ë/ç dhe pa hapësira të tepërta: "Shëndetësi " → "shendetesi" */
export function normalizo(teksti) {
  return (teksti ?? "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------------------------------------------------------------------
// RASTËSIA E KONTROLLUAR (për lojërat ditore)
// ---------------------------------------------------------------------------

/**
 * Kthen një tekst në një numër 32-bit (algoritmi FNV-1a).
 * I njëjti tekst jep gjithmonë të njëjtin numër, në çdo shfletues.
 */
function hashTeksti(teksti) {
  let h = 0x811c9dc5;
  for (let i = 0; i < teksti.length; i++) {
    h ^= teksti.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Gjenerator numrash "të rastësishëm" me farë (algoritmi mulberry32).
 * Me të njëjtën farë (p.sh. "2026-11-08|sudoku") jep të njëjtën varg numrash,
 * prandaj loja e ditës është e njëjtë për të gjithë lexuesit dhe nuk ka nevojë për server.
 *
 * @param {string} fara
 * @returns {() => number} funksion që kthen numra në [0, 1)
 */
export function rastesi(fara) {
  let a = hashTeksti(fara);
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Përzien një kopje të listës (Fisher–Yates) me gjeneratorin e dhënë. */
export function perziej(lista, rng) {
  const kopje = [...lista];
  for (let i = kopje.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [kopje[i], kopje[j]] = [kopje[j], kopje[i]];
  }
  return kopje;
}

/** Merr n elemente të ndryshme nga lista, sipas gjeneratorit. */
export function zgjidh(lista, n, rng) {
  return perziej(lista, rng).slice(0, n);
}

// ---------------------------------------------------------------------------
// RUAJTJA LOKALE (progresi i lojërave, tema)
// ---------------------------------------------------------------------------
// localStorage mund të mungojë (dritare private, cookie të bllokuara), ndaj çdo
// thirrje mbrohet me try/catch dhe faqja punon njësoj edhe pa të.

const PARASHTESA = "lajmetari:";

export function lexo(celesi, parazgjedhur = null) {
  try {
    const vlera = localStorage.getItem(PARASHTESA + celesi);
    return vlera === null ? parazgjedhur : JSON.parse(vlera);
  } catch {
    return parazgjedhur;
  }
}

export function ruaj(celesi, vlera) {
  try {
    localStorage.setItem(PARASHTESA + celesi, JSON.stringify(vlera));
  } catch {
    /* ruajtja s'është e mundur: thjesht vazhdojmë pa të */
  }
}

// ---------------------------------------------------------------------------
// TË TJERA
// ---------------------------------------------------------------------------

/** Formaton sekondat si "3:07" për kronometrin e lojërave. */
export function formatKohe(sekonda) {
  const m = Math.floor(sekonda / 60);
  const s = String(sekonda % 60).padStart(2, "0");
  return `${m}:${s}`;
}

/** true nëse përdoruesi ka kërkuar më pak lëvizje në sistem (aksesueshmëri). */
export const paLevizje = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
