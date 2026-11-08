/**
 * kuizi.js — Kuizi i ditës për Shqipërinë dhe Kosovën: 5 pyetje me 4 opsione.
 *
 * Pyetjet shfaqen një nga një. Pas çdo përgjigjeje tregohet e sakta (dhe një
 * shpjegim kur ka). Në fund shfaqet rezultati, që ruhet për atë ditë.
 */

import { elem, rastesi, zgjidh, perziej, lexo, ruaj } from "../utils.js";

/**
 * Pyetjet e ditës, me opsionet e përziera. Meqë përzierja varet nga data,
 * edhe rendi i opsioneve është i njëjtë për të gjithë lexuesit.
 */
export function pyetjetEDites(data, konfig) {
  const rng = rastesi(`${data}|kuizi`);
  return zgjidh(konfig.lista, konfig.ne_dite, rng).map((p) => {
    const opsionet = perziej(p.opsionet.map((teksti, i) => ({ teksti, sakte: i === p.sakte })), rng);
    return { ...p, opsionet };
  });
}

export function montoKuizin(kontejneri, { data, konfig }) {
  const pyetjet = pyetjetEDites(data, konfig);
  const celesi = `kuizi:${data}`;
  // pergjigjet[i] = indeksi i opsionit që zgjodhi lexuesi për pyetjen i
  const pergjigjet = lexo(celesi, []);

  const progresi = elem("div", { klasa: "kuizi__progresi", atribute: { "aria-hidden": "true" } });
  const zona = elem("div", { klasa: "kuizi__zona", atribute: { "aria-live": "polite" } });
  kontejneri.append(progresi, zona);

  // Pikat e progresit: një për çdo pyetje
  const pikat = pyetjet.map(() => {
    const p = elem("span");
    progresi.append(p);
    return p;
  });

  function vizato() {
    // Ngjyrosim pikat sipas përgjigjeve të dhëna
    pikat.forEach((p, i) => {
      p.className = i < pergjigjet.length
        ? (pyetjet[i].opsionet[pergjigjet[i]].sakte ? "sakte" : "gabim")
        : (i === pergjigjet.length ? "aktuale" : "");
    });

    zona.replaceChildren();
    if (pergjigjet.length >= pyetjet.length) return vizatoRezultatin();

    const i = pergjigjet.length;
    const p = pyetjet[i];
    const opsionet = elem("div", { klasa: "kuizi__opsionet" });

    p.opsionet.forEach((o, j) => {
      const b = elem("button", { klasa: "kuizi__opsioni", teksti: o.teksti, atribute: { type: "button" } });
      b.addEventListener("click", () => zgjidhOpsionin(j, opsionet, p));
      opsionet.append(b);
    });

    zona.append(
      elem("p", { klasa: "kuizi__numri", teksti: `Pyetja ${i + 1} nga ${pyetjet.length}` }),
      elem("h3", { klasa: "kuizi__pyetja", teksti: p.pyetja }),
      opsionet,
    );
  }

  /** Tregon të saktën, shpjegimin, dhe butonin për pyetjen tjetër. */
  function zgjidhOpsionin(j, opsionet, p) {
    pergjigjet.push(j);
    ruaj(celesi, pergjigjet);
    [...opsionet.children].forEach((b, k) => {
      b.disabled = true;
      if (p.opsionet[k].sakte) b.classList.add("sakte");
      else if (k === j) b.classList.add("gabim");
    });
    const iSakte = p.opsionet[j].sakte;
    const tjetra = elem("button", {
      klasa: "buton",
      teksti: pergjigjet.length < pyetjet.length ? "Pyetja tjetër →" : "Shih rezultatin",
      atribute: { type: "button" },
    });
    tjetra.addEventListener("click", vizato);
    zona.append(elem("p", { klasa: `kuizi__reagimi ${iSakte ? "sakte" : "gabim"}`, teksti: iSakte ? "Saktë!" : "Jo, e sakta është e theksuara." }));
    if (p.shpjegim) zona.append(elem("p", { klasa: "kuizi__shpjegimi", teksti: p.shpjegim }));
    zona.append(tjetra);
    tjetra.focus();
  }

  function vizatoRezultatin() {
    const sakte = pergjigjet.filter((j, i) => pyetjet[i].opsionet[j].sakte).length;
    const vleresimi = sakte === pyetjet.length ? "Perfekt! Njohës i vërtetë."
      : sakte >= 3 ? "Shumë mirë!" : "Nesër ke një shans të ri.";
    kontejneri.classList.toggle("loje--fituar", sakte === pyetjet.length);
    zona.append(
      elem("p", { klasa: "kuizi__rezultati", teksti: `${sakte}/${pyetjet.length}` }),
      elem("p", { klasa: "kuizi__vleresimi", teksti: vleresimi }),
      elem("p", { klasa: "loje__mesazh", teksti: "Pyetjet e reja dalin nesër." }),
    );
  }

  vizato();
  return () => {};
}

export function eshteZgjidhurKuizi(data, konfig) {
  return lexo(`kuizi:${data}`, []).length >= konfig.ne_dite;
}
