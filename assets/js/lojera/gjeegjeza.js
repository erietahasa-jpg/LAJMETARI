/**
 * gjeegjeza.js — Tri gjëegjëza në ditë.
 *
 * Lexuesi shkruan përgjigjen; ajo krahasohet pa ë/ç dhe pa shkronja të mëdha
 * me listën e formave të pranuara. Nëse dorëzohet, mund ta shohë përgjigjen.
 */

import { elem, rastesi, zgjidh, normalizo, lexo, ruaj } from "../utils.js";

/** Gjëegjëzat e ditës: të njëjtat për të gjithë, të ndryshme nga dita në ditë. */
export function gjeegjezatEDites(data, konfig) {
  return zgjidh(konfig.lista, konfig.ne_dite, rastesi(`${data}|gjeegjeza`));
}

/** A është përgjigja e pranueshme? "Vezë", "veza", " VEZA " → të gjitha pranohen. */
export function eshteSakte(pergjigja, gjeegjeza) {
  const p = normalizo(pergjigja);
  return p.length > 0 && gjeegjeza.pranohen.some((f) => normalizo(f) === p);
}

export function montoGjeegjezat(kontejneri, { data, konfig }) {
  const lista = gjeegjezatEDites(data, konfig);
  const celesi = `gjeegjeza:${data}`;
  // Gjendja për secilën gjëegjëzë: "e hapur" | "zgjidhur" | "dorezuar"
  const gjendja = lexo(celesi, lista.map(() => "e hapur"));
  const mesazhi = elem("p", { klasa: "loje__mesazh", atribute: { "aria-live": "polite" } });
  const kartat = elem("ol", { klasa: "gjeegjeza" });
  kontejneri.append(kartat, mesazhi);

  lista.forEach((gj, i) => {
    const input = elem("input", {
      atribute: { type: "text", autocomplete: "off", autocapitalize: "off", spellcheck: "false",
        placeholder: "Përgjigja jote…", "aria-label": `Përgjigja për gjëegjëzën ${i + 1}` },
    });
    const provo = elem("button", { klasa: "buton", teksti: "Provo", atribute: { type: "submit" } });
    const dorezohu = elem("button", { klasa: "buton buton--dyte", teksti: "Shfaq përgjigjen", atribute: { type: "button" } });
    const reagimi = elem("p", { klasa: "gjeegjeza__reagimi", atribute: { "aria-live": "polite" } });
    const formulari = elem("form", { klasa: "gjeegjeza__formulari", femijet: [input, provo, dorezohu] });

    const karta = elem("li", {
      klasa: "gjeegjeza__karta",
      femijet: [elem("p", { klasa: "gjeegjeza__pyetja", teksti: gj.pyetja }), formulari, reagimi],
    });
    kartat.append(karta);

    // "submit" kap si klikimin e butonit "Provo", ashtu edhe tastin Enter
    formulari.addEventListener("submit", (e) => {
      e.preventDefault();
      if (gjendja[i] !== "e hapur") return;
      if (eshteSakte(input.value, gj)) {
        gjendja[i] = "zgjidhur";
      } else {
        reagimi.textContent = "Jo ende. Mendohu edhe pak!";
        karta.classList.remove("dridhje");
        void karta.offsetWidth;                       // rinis animacionin "dridhje"
        karta.classList.add("dridhje");
        return;
      }
      perditeso();
    });

    dorezohu.addEventListener("click", () => {
      if (gjendja[i] === "e hapur") gjendja[i] = "dorezuar";
      perditeso();
    });

    /** Përshtat kartën sipas gjendjes së saj. */
    karta.perditeso = () => {
      const mbyllur = gjendja[i] !== "e hapur";
      input.disabled = provo.disabled = dorezohu.disabled = mbyllur;
      karta.dataset.gjendja = gjendja[i];
      if (gjendja[i] === "zgjidhur") reagimi.textContent = `Saktë! Përgjigja: ${gj.pergjigja}.`;
      if (gjendja[i] === "dorezuar") reagimi.textContent = `Përgjigja: ${gj.pergjigja}.`;
    };
  });

  function perditeso() {
    ruaj(celesi, gjendja);
    [...kartat.children].forEach((k) => k.perditeso());
    const zgjidhura = gjendja.filter((g) => g === "zgjidhur").length;
    const mbaruar = gjendja.every((g) => g !== "e hapur");
    kontejneri.classList.toggle("loje--fituar", mbaruar && zgjidhura === lista.length);
    mesazhi.textContent = mbaruar
      ? `Sot gjete ${zgjidhura} nga ${lista.length}. Nesër vijnë gjëegjëza të reja.`
      : "Shkruaj përgjigjen me një fjalë. Shkronjat ë dhe ç nuk janë të detyrueshme.";
  }

  perditeso();
  return () => {};
}

export function eshteZgjidhurGjeegjeza(data) {
  const g = lexo(`gjeegjeza:${data}`);
  return Array.isArray(g) && g.every((x) => x !== "e hapur");
}
