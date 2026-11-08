/**
 * sudoku.js — Sudoku i ditës, në tri nivele.
 *
 * Ndahet në dy pjesë:
 *   1. LOGJIKA (pa DOM): gjenerimi i një zgjidhjeje të plotë, heqja e numrave duke ruajtur
 *      zgjidhjen unike, dhe kontrolli i konflikteve. Funksione të pastra, të lehta për t'u testuar.
 *   2. NDËRFAQJA: rrjeta 9×9, tastiera e numrave, kronometri dhe ruajtja e progresit.
 *
 * E njëjta datë + i njëjti nivel japin gjithmonë të njëjtin sudoku (rastësi me farë).
 */

import { elem, rastesi, perziej, lexo, ruaj, formatKohe } from "../utils.js";

// ===========================================================================
// 1. LOGJIKA
// ===========================================================================
// Rrjeta ruhet si varg me 81 numra (0 = qelizë bosh), rresht pas rreshti.

export const NIVELET = {
  lehte:    { emri: "Lehtë",    numra: 40 },   // sa numra jepen që në fillim
  mesatare: { emri: "Mesatare", numra: 32 },
  veshtire: { emri: "Vështirë", numra: 26 },
};

const rreshti = (i) => Math.floor(i / 9);
const kolona = (i) => i % 9;
const kutia = (i) => Math.floor(rreshti(i) / 3) * 3 + Math.floor(kolona(i) / 3);

/** Indekset e 20 "fqinjëve" të një qelize: i njëjti rresht, kolonë ose kuti 3×3. */
const FQINJET = Array.from({ length: 81 }, (_, i) =>
  Array.from({ length: 81 }, (_, j) => j).filter(
    (j) => j !== i && (rreshti(j) === rreshti(i) || kolona(j) === kolona(i) || kutia(j) === kutia(i)),
  ),
);

/** A mund të vendoset numri n në qelizën i pa përsëritur në rresht, kolonë apo kuti? */
function lejohet(rrjeta, i, n) {
  return FQINJET[i].every((j) => rrjeta[j] !== n);
}

/** Mbush një rrjetë bosh me një zgjidhje të plotë, duke provuar numrat në rend të rastësishëm. */
function mbush(rrjeta, rng) {
  const bosh = rrjeta.indexOf(0);
  if (bosh === -1) return true;                       // s'ka më qeliza bosh: u mbush
  for (const n of perziej([1, 2, 3, 4, 5, 6, 7, 8, 9], rng)) {
    if (lejohet(rrjeta, bosh, n)) {
      rrjeta[bosh] = n;
      if (mbush(rrjeta, rng)) return true;
      rrjeta[bosh] = 0;                               // rrugë pa dalje: kthehemi pas (backtracking)
    }
  }
  return false;
}

/**
 * Numëron zgjidhjet e një rrjete, por ndalet sapo arrin 'kufiri'.
 * Na duhet vetëm të dimë nëse ka saktësisht 1 zgjidhje, ndaj kufiri është 2.
 * Zgjedh gjithmonë qelizën me më pak mundësi, që kërkimi të jetë i shpejtë.
 */
function numeroZgjidhjet(rrjeta, kufiri = 2) {
  let qeliza = -1;
  let mundesite = null;
  for (let i = 0; i < 81; i++) {
    if (rrjeta[i] !== 0) continue;
    const m = [];
    for (let n = 1; n <= 9; n++) if (lejohet(rrjeta, i, n)) m.push(n);
    if (m.length === 0) return 0;                     // qelizë pa asnjë mundësi: s'ka zgjidhje
    if (!mundesite || m.length < mundesite.length) {
      qeliza = i;
      mundesite = m;
      if (m.length === 1) break;
    }
  }
  if (qeliza === -1) return 1;                        // rrjeta është plot: një zgjidhje

  let gjithsej = 0;
  for (const n of mundesite) {
    rrjeta[qeliza] = n;
    gjithsej += numeroZgjidhjet(rrjeta, kufiri - gjithsej);
    if (gjithsej >= kufiri) break;
  }
  rrjeta[qeliza] = 0;
  return gjithsej;
}

/**
 * Krijon sudokun e një dite dhe niveli.
 * @returns {{ enigma: number[], zgjidhja: number[] }}
 */
export function gjeneroSudoku(data, niveli) {
  const rng = rastesi(`${data}|sudoku|${niveli}`);
  const zgjidhja = new Array(81).fill(0);
  mbush(zgjidhja, rng);

  // Heqim numra një nga një, në rend të rastësishëm. Nëse pas heqjes enigma ka
  // më shumë se një zgjidhje, e kthejmë numrin. Ndalemi kur arrijmë numrin e synuar.
  const enigma = [...zgjidhja];
  let teMbetur = 81;
  for (const i of perziej([...Array(81).keys()], rng)) {
    if (teMbetur <= NIVELET[niveli].numra) break;
    const ruajtur = enigma[i];
    enigma[i] = 0;
    if (numeroZgjidhjet([...enigma]) !== 1) enigma[i] = ruajtur;
    else teMbetur--;
  }
  return { enigma, zgjidhja };
}

/** Kthen bashkësinë e qelizave që përsërisin një numër në rresht, kolonë ose kuti. */
export function gjejKonfliktet(rrjeta) {
  const konflikte = new Set();
  rrjeta.forEach((n, i) => {
    if (n !== 0 && FQINJET[i].some((j) => rrjeta[j] === n)) konflikte.add(i);
  });
  return konflikte;
}

// ===========================================================================
// 2. NDËRFAQJA
// ===========================================================================

/**
 * Vendos lojën brenda 'kontejneri'.
 * @returns {() => void} funksion pastrimi (ndal kronometrin) kur lexuesi largohet.
 */
export function montoSudoku(kontejneri, { data }) {
  let niveli = lexo("sudoku:niveli", "lehte");
  let gjendja;           // { aktuale, sekonda, perfunduar } — ruhet në localStorage
  let loja;              // { enigma, zgjidhja }
  let zgjedhur = -1;     // qeliza e zgjedhur
  let kronometri = null;

  // --- Struktura e faqes së lojës ---
  const zgjedhesiNivelit = elem("div", { klasa: "segmente", atribute: { role: "group", "aria-label": "Niveli" } });
  const ora = elem("span", { klasa: "loje__ora", atribute: { "aria-live": "off" } });
  const rrjetaEl = elem("div", { klasa: "sudoku", atribute: { role: "grid", "aria-label": "Rrjeta e sudokut" } });
  const tastiera = elem("div", { klasa: "sudoku__tastiera" });
  const mesazhi = elem("p", { klasa: "loje__mesazh", atribute: { "aria-live": "polite" } });

  for (const [celesi, { emri }] of Object.entries(NIVELET)) {
    const b = elem("button", { teksti: emri, atribute: { type: "button", "data-niveli": celesi } });
    b.addEventListener("click", () => ndryshoNivelin(celesi));
    zgjedhesiNivelit.append(b);
  }

  // Butonat 1–9 dhe "Fshi"
  for (let n = 1; n <= 9; n++) {
    const b = elem("button", { teksti: n, atribute: { type: "button", "aria-label": `Vendos ${n}` } });
    b.addEventListener("click", () => vendos(n));
    tastiera.append(b);
  }
  const fshi = elem("button", { klasa: "sudoku__fshi", teksti: "Fshi", atribute: { type: "button" } });
  fshi.addEventListener("click", () => vendos(0));
  tastiera.append(fshi);

  const rinis = elem("button", { klasa: "buton buton--dyte", teksti: "Rinis", atribute: { type: "button" } });
  rinis.addEventListener("click", () => {
    gjendja = { aktuale: [...loja.enigma], sekonda: 0, perfunduar: false };
    ruajGjendjen();
    vizato();
    nisKronometrin();
  });

  kontejneri.append(
    elem("div", { klasa: "loje__shiriti", femijet: [zgjedhesiNivelit, ora] }),
    rrjetaEl,
    tastiera,
    elem("div", { klasa: "loje__veprimet", femijet: [mesazhi, rinis] }),
  );

  // 81 qelizat krijohen një herë; më pas vetëm përditësohen
  const qelizat = Array.from({ length: 81 }, (_, i) => {
    const q = elem("button", { klasa: "sudoku__qeliza", atribute: { type: "button", role: "gridcell" } });
    q.addEventListener("click", () => { zgjedhur = i; vizato(); });
    rrjetaEl.append(q);
    return q;
  });

  // Tastiera fizike: 1–9 vendos, 0/Backspace/Delete fshin, shigjetat lëvizin
  function tastet(e) {
    if (zgjedhur < 0 || !kontejneri.isConnected) return;
    if (/^[1-9]$/.test(e.key)) vendos(Number(e.key));
    else if (["0", "Backspace", "Delete"].includes(e.key)) vendos(0);
    else {
      const levizja = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[e.key];
      if (!levizja) return;
      zgjedhur = (zgjedhur + levizja + 81) % 81;
      qelizat[zgjedhur].focus();
      vizato();
    }
    e.preventDefault();
  }
  document.addEventListener("keydown", tastet);

  // --- Veprimet ---
  const celesiRuajtjes = () => `sudoku:${data}:${niveli}`;
  const ruajGjendjen = () => ruaj(celesiRuajtjes(), gjendja);

  function ndryshoNivelin(iRi) {
    niveli = iRi;
    ruaj("sudoku:niveli", niveli);
    ngarko();
  }

  /** Gjeneron (ose rikthen nga ruajtja) sudokun e nivelit aktual. */
  function ngarko() {
    loja = gjeneroSudoku(data, niveli);
    const ruajtur = lexo(celesiRuajtjes());
    gjendja = ruajtur?.aktuale?.length === 81
      ? ruajtur
      : { aktuale: [...loja.enigma], sekonda: 0, perfunduar: false };
    zgjedhur = -1;
    vizato();
    nisKronometrin();
  }

  function vendos(n) {
    if (zgjedhur < 0 || gjendja.perfunduar || loja.enigma[zgjedhur] !== 0) return;  // numrat e dhënë s'preken
    gjendja.aktuale[zgjedhur] = n;
    if (gjendja.aktuale.every((v, i) => v === loja.zgjidhja[i])) {
      gjendja.perfunduar = true;
      ndalKronometrin();
    }
    ruajGjendjen();
    vizato();
  }

  function nisKronometrin() {
    ndalKronometrin();
    if (gjendja.perfunduar) return;
    kronometri = setInterval(() => {
      if (document.hidden) return;                    // nuk numërojmë kur skeda s'shihet
      gjendja.sekonda++;
      ora.textContent = `⏱ ${formatKohe(gjendja.sekonda)}`;
      if (gjendja.sekonda % 10 === 0) ruajGjendjen();
    }, 1000);
  }

  function ndalKronometrin() {
    clearInterval(kronometri);
    kronometri = null;
  }

  /** Përditëson pamjen sipas gjendjes: numrat, theksimet, konfliktet, mesazhin. */
  function vizato() {
    const konflikte = gjejKonfliktet(gjendja.aktuale);
    const vleraZgjedhur = zgjedhur >= 0 ? gjendja.aktuale[zgjedhur] : 0;

    qelizat.forEach((q, i) => {
      const v = gjendja.aktuale[i];
      q.textContent = v || "";
      q.classList.toggle("dhene", loja.enigma[i] !== 0);
      q.classList.toggle("zgjedhur", i === zgjedhur);
      q.classList.toggle("lidhur", zgjedhur >= 0 && i !== zgjedhur && FQINJET[zgjedhur].includes(i));
      q.classList.toggle("njejte", vleraZgjedhur !== 0 && v === vleraZgjedhur && i !== zgjedhur);
      q.classList.toggle("konflikt", konflikte.has(i));
      q.classList.toggle("kufi-djathtas", kolona(i) === 2 || kolona(i) === 5);   // vijat e trasha të kutive
      q.classList.toggle("kufi-poshte", rreshti(i) === 2 || rreshti(i) === 5);
      q.setAttribute("aria-label", `Rreshti ${rreshti(i) + 1}, kolona ${kolona(i) + 1}: ${v || "bosh"}`);
    });

    zgjedhesiNivelit.querySelectorAll("button").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.niveli === niveli)));
    ora.textContent = `⏱ ${formatKohe(gjendja.sekonda)}`;
    kontejneri.classList.toggle("loje--fituar", gjendja.perfunduar);

    if (gjendja.perfunduar) mesazhi.textContent = `Bravo! E zgjidhe në ${formatKohe(gjendja.sekonda)}.`;
    else if (konflikte.size) mesazhi.textContent = "Ka numra që përsëriten (me të kuqe).";
    else mesazhi.textContent = `Plotëso rrjetën: çdo rresht, kolonë dhe kuti 3×3 ka numrat 1–9 një herë.`;
  }

  ngarko();

  // Pastrimi kur lexuesi kalon në një faqe tjetër
  return () => {
    ndalKronometrin();
    if (gjendja) ruajGjendjen();
    document.removeEventListener("keydown", tastet);
  };
}

/** A është zgjidhur sudoku i sotëm (në cilindo nivel)? Përdoret te kartat e lojërave. */
export function eshteZgjidhurSudoku(data) {
  return Object.keys(NIVELET).some((n) => lexo(`sudoku:${data}:${n}`)?.perfunduar);
}
