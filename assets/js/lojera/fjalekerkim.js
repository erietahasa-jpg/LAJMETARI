/**
 * fjalekerkim.js — Fjalëkërkimi i ditës: gjej fjalët e fshehura në rrjetë.
 *
 *   1. LOGJIKA: zgjedh temën e ditës, vendos fjalët në rrjetë (në 8 drejtime)
 *      dhe mbush pjesën tjetër me shkronja shqipe.
 *   2. NDËRFAQJA: lexuesi tërheq gishtin/mausin nga shkronja e parë te e fundit
 *      (ose prek të parën dhe pastaj të fundit). Fjalët e gjetura ngjyrosen.
 *
 * Shkronjat Ç dhe Ë janë shkronja më vete, ndaj fjalët ndahen me Array.from (jo me .split("")).
 */

import { elem, rastesi, perziej, zgjidh, lexo, ruaj } from "../utils.js";

// ===========================================================================
// 1. LOGJIKA
// ===========================================================================

// Shkronjat njëshe të alfabetit shqip, për të mbushur qelizat bosh
const SHKRONJAT = Array.from("ABCÇDEËFGHIJKLMNOPQRSTUVXYZ");

// 8 drejtimet: [ndryshimi i rreshtit, ndryshimi i kolonës]
const DREJTIMET = [[0, 1], [1, 0], [1, 1], [-1, 1], [0, -1], [-1, 0], [-1, -1], [1, -1]];

/**
 * Ndërton fjalëkërkimin e një dite.
 * @returns {{ tema: string, madhesia: number, rrjeta: string[], fjalet: {fjala, qelizat}[] }}
 */
export function gjeneroFjalekerkim(data, konfig) {
  const rng = rastesi(`${data}|fjalekerkim`);
  const N = konfig.madhesia;
  const tema = konfig.temat[Math.floor(rng() * konfig.temat.length)];

  // Fjalët më të gjata vendosen të parat, sepse kanë më pak vende ku futen
  const teZgjedhura = zgjidh(tema.fjalet.filter((f) => Array.from(f).length <= N), konfig.fjale_ne_loje, rng)
    .sort((a, b) => Array.from(b).length - Array.from(a).length);

  const rrjeta = new Array(N * N).fill("");
  const vendosura = [];

  for (const fjala of teZgjedhura) {
    const shkronjat = Array.from(fjala);
    // Provojmë deri në 300 pozicione/drejtime të rastësishme
    for (let prova = 0; prova < 300; prova++) {
      const [dr, dk] = DREJTIMET[Math.floor(rng() * DREJTIMET.length)];
      const r0 = Math.floor(rng() * N);
      const k0 = Math.floor(rng() * N);
      const qelizat = shkronjat.map((_, i) => [r0 + dr * i, k0 + dk * i]);

      // Fjala duhet të jetë brenda rrjetës dhe të mos përplaset me shkronja të ndryshme
      const pershtatet = qelizat.every(([r, k], i) =>
        r >= 0 && r < N && k >= 0 && k < N && (rrjeta[r * N + k] === "" || rrjeta[r * N + k] === shkronjat[i]));
      if (!pershtatet) continue;

      qelizat.forEach(([r, k], i) => { rrjeta[r * N + k] = shkronjat[i]; });
      vendosura.push({ fjala, qelizat: qelizat.map(([r, k]) => r * N + k) });
      break;
    }
  }

  // Mbushim qelizat bosh me shkronja të rastësishme
  for (let i = 0; i < rrjeta.length; i++) {
    if (rrjeta[i] === "") rrjeta[i] = SHKRONJAT[Math.floor(rng() * SHKRONJAT.length)];
  }

  // Lista e fjalëve shfaqet në rend alfabetik, jo në rendin e vendosjes
  vendosura.sort((a, b) => a.fjala.localeCompare(b.fjala, "sq"));
  return { tema: tema.titulli, madhesia: N, rrjeta, fjalet: vendosura };
}

/**
 * Kthen qelizat në vijë të drejtë nga 'fillimi' te 'fundi' (horizontale, vertikale ose diagonale).
 * Nëse dy qelizat nuk janë në një vijë të tillë, kthen vetëm qelizën e fillimit.
 */
export function vijaMes(fillimi, fundi, N) {
  const [r1, k1, r2, k2] = [Math.floor(fillimi / N), fillimi % N, Math.floor(fundi / N), fundi % N];
  const dr = Math.sign(r2 - r1);
  const dk = Math.sign(k2 - k1);
  const gjatesia = Math.max(Math.abs(r2 - r1), Math.abs(k2 - k1));
  const eDrejte = r1 === r2 || k1 === k2 || Math.abs(r2 - r1) === Math.abs(k2 - k1);
  if (!eDrejte) return [fillimi];
  return Array.from({ length: gjatesia + 1 }, (_, i) => (r1 + dr * i) * N + (k1 + dk * i));
}

// ===========================================================================
// 2. NDËRFAQJA
// ===========================================================================

export function montoFjalekerkim(kontejneri, { data, konfig }) {
  const loja = gjeneroFjalekerkim(data, konfig);
  const N = loja.madhesia;
  const celesi = `fjalekerkim:${data}`;
  const gjetura = new Set(lexo(celesi, []));          // fjalët e gjetura (ruhen në shfletues)

  // Çdo fjalë e gjetur merr një ngjyrë nga kjo listë (klasat CSS .ngjyra-0 … .ngjyra-5)
  const ngjyraPer = (fjala) => `ngjyra-${loja.fjalet.findIndex((f) => f.fjala === fjala) % 6}`;

  // --- Struktura ---
  const rrjetaEl = elem("div", {
    klasa: "fjalekerkim",
    atribute: { role: "grid", "aria-label": `Fjalëkërkim: ${loja.tema}`, style: `--n:${N}` },
  });
  const listaEl = elem("ul", { klasa: "fjalekerkim__lista" });
  const mesazhi = elem("p", { klasa: "loje__mesazh", atribute: { "aria-live": "polite" } });

  kontejneri.append(
    elem("p", { klasa: "loje__tema", teksti: `Tema e ditës: ${loja.tema}` }),
    elem("div", { klasa: "fjalekerkim__mbajtesi", femijet: [rrjetaEl, listaEl] }),
    mesazhi,
  );

  const qelizat = loja.rrjeta.map((shkronja, i) => {
    const q = elem("span", { klasa: "fjalekerkim__qeliza", teksti: shkronja, atribute: { "data-i": i } });
    rrjetaEl.append(q);
    return q;
  });

  const elementetEFjaleve = new Map(loja.fjalet.map(({ fjala }) => {
    const li = elem("li", { teksti: fjala });
    listaEl.append(li);
    return [fjala, li];
  }));

  // --- Përzgjedhja me tërheqje (pointer events punojnë njësoj për maus, gisht dhe stilolaps) ---
  let fillimi = null;        // qeliza ku nisi përzgjedhja
  let pritje = null;         // për mënyrën "prek fillimin, pastaj fundin"

  const qelizaNen = (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    return el?.dataset?.i !== undefined ? Number(el.dataset.i) : null;
  };

  function theksoPerzgjedhjen(lista) {
    qelizat.forEach((q, i) => q.classList.toggle("perzgjedhur", lista.includes(i)));
  }

  rrjetaEl.addEventListener("pointerdown", (e) => {
    const i = qelizaNen(e);
    if (i === null) return;
    rrjetaEl.setPointerCapture(e.pointerId);         // vazhdojmë të marrim lëvizjet edhe jashtë qelizës
    fillimi = pritje ?? i;
    theksoPerzgjedhjen(vijaMes(fillimi, i, N));
  });

  rrjetaEl.addEventListener("pointermove", (e) => {
    if (fillimi === null) return;
    const i = qelizaNen(e);
    if (i !== null) theksoPerzgjedhjen(vijaMes(fillimi, i, N));
  });

  rrjetaEl.addEventListener("pointerup", (e) => {
    if (fillimi === null) return;
    const i = qelizaNen(e) ?? fillimi;
    if (i === fillimi && pritje === null) {
      // Prekje e thjeshtë: e mbajmë si fillim dhe presim prekjen e dytë
      pritje = i;
      theksoPerzgjedhjen([i]);
    } else {
      kontrollo(vijaMes(fillimi, i, N));
      pritje = null;
      theksoPerzgjedhjen([]);
    }
    fillimi = null;
  });

  /** A përputhet vija e zgjedhur me një fjalë të fshehur (nga fillimi ose nga fundi)? */
  function kontrollo(vija) {
    const fjala = loja.fjalet.find(({ qelizat: q }) =>
      q.length === vija.length &&
      (q.every((v, i) => v === vija[i]) || q.every((v, i) => v === vija[vija.length - 1 - i])));
    if (fjala && !gjetura.has(fjala.fjala)) {
      gjetura.add(fjala.fjala);
      ruaj(celesi, [...gjetura]);
      vizato();
    }
  }

  function vizato() {
    qelizat.forEach((q) => { q.className = "fjalekerkim__qeliza"; });
    for (const { fjala, qelizat: q } of loja.fjalet) {
      const gjetur = gjetura.has(fjala);
      elementetEFjaleve.get(fjala).classList.toggle("gjetur", gjetur);
      if (gjetur) q.forEach((i) => qelizat[i].classList.add("gjetur", ngjyraPer(fjala)));
    }
    const mbaruar = gjetura.size === loja.fjalet.length;
    kontejneri.classList.toggle("loje--fituar", mbaruar);
    mesazhi.textContent = mbaruar
      ? "Bravo! I gjete të gjitha fjalët."
      : `Gjetur ${gjetura.size} nga ${loja.fjalet.length}. Tërhiq nga shkronja e parë te e fundit, ose prek të dyja me radhë.`;
  }

  vizato();
  return () => {};             // s'ka kronometër apo dëgjues globalë për të pastruar
}

export function eshteZgjidhurFjalekerkimi(data, konfig) {
  return lexo(`fjalekerkim:${data}`, []).length >= konfig.fjale_ne_loje;
}
