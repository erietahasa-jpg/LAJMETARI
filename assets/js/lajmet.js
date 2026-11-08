/**
 * lajmet.js — Faqet "Lajmet" dhe "Rozë · VIP": lista e lajmeve me filtra.
 *
 * Eksporton edhe kartën e një lajmi, që e përdor edhe Ballina.
 */

import { elem, linkISigurt, dataNeShqip, normalizo } from "./utils.js";

/** Rubrikat me faqen e tyre, që nuk përzihen me lajmet e zakonshme (si te config/rubrikat.json). */
export const RUBRIKAT_E_VECANTA = ["Rozë", "Horoskop"];
export const eshteLajmIZakonshem = (l) => !RUBRIKAT_E_VECANTA.includes(l.rubrika);

// ---------------------------------------------------------------------------
// KARTA E NJË LAJMI
// ---------------------------------------------------------------------------

/**
 * @param {object} lajmi
 * @param {"normale"|"kryesore"|"kompakte"} [madhesia]
 *   kryesore = lajmi kryesor i Ballinës; kompakte = vetëm titulli dhe burimi
 */
export function kartaELajmit(lajmi, madhesia = "normale") {
  const url = linkISigurt(lajmi.url);
  const titulli = elem(madhesia === "kryesore" ? "h2" : "h3", { klasa: "lajm__titulli" });

  // Titulli është vetë linku drejt burimit; hapet në skedë të re
  if (url) {
    titulli.append(elem("a", {
      teksti: lajmi.titulli,
      atribute: { href: url, target: "_blank", rel: "noopener noreferrer" },
    }));
  } else {
    titulli.textContent = lajmi.titulli;
  }

  const etiketa = elem("p", {
    klasa: "lajm__etiketa",
    femijet: [
      elem("span", { klasa: "lajm__rubrika", teksti: lajmi.rubrika }),
      elem("span", { klasa: "lajm__vendi", teksti: lajmi.vendi }),
    ],
  });

  const burimi = elem("p", {
    klasa: "lajm__burimi",
    femijet: [
      elem("span", { teksti: lajmi.burimi }),
      url && madhesia !== "kompakte"
        ? elem("a", {
          klasa: "lajm__lexo",
          teksti: "Lexo artikullin →",
          atribute: { href: url, target: "_blank", rel: "noopener noreferrer", "aria-label": `Lexo artikullin te ${lajmi.burimi}` },
        })
        : null,
    ],
  });

  return elem("article", {
    klasa: `lajm lajm--${madhesia}`,
    atribute: { "data-vendi": lajmi.vendi, "data-rubrika": lajmi.rubrika },
    femijet: [
      etiketa,
      titulli,
      madhesia !== "kompakte" && lajmi.permbledhja
        ? elem("p", { klasa: "lajm__permbledhja", teksti: lajmi.permbledhja })
        : null,
      burimi,
    ],
  });
}

// ---------------------------------------------------------------------------
// FAQJA E LISTËS
// ---------------------------------------------------------------------------

/**
 * @param {HTMLElement} pamja
 * @param {{ lajmet: object[], seksioni: ""|"Rozë", parametrat: URLSearchParams }} opsione
 */
export function vizatoLajmet(pamja, { lajmet, seksioni, parametrat }) {
  // Lajmet që i përkasin këtij seksioni
  const teSeksionit = lajmet.filter((l) => (seksioni ? l.rubrika === seksioni : eshteLajmIZakonshem(l)));

  // Filtrat; rubrika mund të vijë nga linku (p.sh. #lajmet?rubrika=Sport nga Ballina)
  const filtrat = { vendi: "", rubrika: parametrat.get("rubrika") ?? "", data: "", kerko: "" };

  // --- Koka e faqes ---
  pamja.append(elem("header", {
    klasa: `seksion-koka${seksioni ? " seksion-koka--roze" : ""}`,
    femijet: [
      elem("p", { klasa: "seksion-koka__mbititull", teksti: seksioni ? "Showbiz dhe jeta e VIP-ave" : "Arkivi i lajmeve" }),
      elem("h1", { klasa: "seksion-koka__titulli", teksti: seksioni ? "Rozë · VIP" : "Lajmet" }),
      elem("p", {
        klasa: "seksion-koka__pershkrimi",
        teksti: "Çdo lajm ka përmbledhjen dhe linkun te media që e publikoi.",
      }),
    ],
  }));

  // --- Shiriti i filtrave ---
  const butonatVendi = ["", "Shqipëri", "Kosovë"].map((v) =>
    elem("button", { teksti: v || "Të gjitha", atribute: { type: "button", "data-vendi": v } }));
  const rubrikat = [...new Set(teSeksionit.map((l) => l.rubrika))].sort((a, b) => a.localeCompare(b, "sq"));
  const datat = [...new Set(teSeksionit.map((l) => l.data))].sort().reverse();

  const zgjedhesiRubrikes = perzgjedhes("Rubrika", rubrikat.map((r) => [r, r]), filtrat.rubrika);
  const zgjedhesiDates = perzgjedhes("Data", datat.map((d) => [d, dataNeShqip(d)]), "");
  const kerkimi = elem("input", { atribute: { type: "search", placeholder: "Kërko në tituj dhe përmbledhje…" } });

  pamja.append(elem("div", {
    klasa: "filtrat",
    atribute: { role: "search" },
    femijet: [
      elem("div", { klasa: "segmente", atribute: { role: "group", "aria-label": "Vendi" }, femijet: butonatVendi }),
      seksioni ? null : zgjedhesiRubrikes.etiketa,
      zgjedhesiDates.etiketa,
      elem("label", { klasa: "filtrat__fusha filtrat__kerko", femijet: [elem("span", { teksti: "Kërko" }), kerkimi] }),
    ],
  }));

  const lista = elem("div", { klasa: "lajmet-lista", atribute: { "aria-live": "polite" } });
  pamja.append(lista);

  // --- Ngjarjet: çdo ndryshim përditëson filtrat dhe rivizaton listën ---
  butonatVendi.forEach((b) => b.addEventListener("click", () => { filtrat.vendi = b.dataset.vendi; vizatoListen(); }));
  zgjedhesiRubrikes.select.addEventListener("change", (e) => { filtrat.rubrika = e.target.value; vizatoListen(); });
  zgjedhesiDates.select.addEventListener("change", (e) => { filtrat.data = e.target.value; vizatoListen(); });
  kerkimi.addEventListener("input", () => { filtrat.kerko = normalizo(kerkimi.value); vizatoListen(); });

  function vizatoListen() {
    butonatVendi.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.vendi === filtrat.vendi)));

    const teFiltruara = teSeksionit.filter((l) =>
      (!filtrat.vendi || l.vendi === filtrat.vendi) &&
      (!filtrat.rubrika || l.rubrika === filtrat.rubrika) &&
      (!filtrat.data || l.data === filtrat.data) &&
      (!filtrat.kerko || normalizo(`${l.titulli} ${l.permbledhja} ${l.burimi}`).includes(filtrat.kerko)));

    lista.replaceChildren();
    if (teFiltruara.length === 0) {
      lista.append(elem("p", {
        klasa: "bosh",
        teksti: seksioni && teSeksionit.length === 0
          ? "Ende s'ka lajme rozë. Ato shtohen automatikisht kur mediat publikojnë lajme VIP."
          : "Asnjë lajm nuk përputhet me filtrat e zgjedhur.",
      }));
      return;
    }

    // Grupim sipas datës, më të rejat sipër
    const sipasDates = Map.groupBy
      ? Map.groupBy(teFiltruara, (l) => l.data)
      : teFiltruara.reduce((m, l) => m.set(l.data, [...(m.get(l.data) ?? []), l]), new Map());

    for (const [data, grupi] of sipasDates) {
      lista.append(elem("section", {
        klasa: "dita",
        femijet: [
          elem("h2", { klasa: "dita__titulli", femijet: [
            elem("span", { teksti: dataNeShqip(data) }),
            elem("span", { klasa: "dita__numri", teksti: `${grupi.length} lajme` }),
          ] }),
          elem("div", { klasa: "dita__rrjeta", femijet: grupi.map((l) => kartaELajmit(l)) }),
        ],
      }));
    }
  }

  vizatoListen();
  return () => {};
}

/** Krijon një <label> me <select> dhe opsionin "Të gjitha". */
function perzgjedhes(titulli, opsionet, vleraFillestare) {
  const select = elem("select");
  select.add(new Option("Të gjitha", ""));
  for (const [vlera, teksti] of opsionet) select.add(new Option(teksti, vlera));
  select.value = vleraFillestare;
  const etiketa = elem("label", { klasa: "filtrat__fusha", femijet: [elem("span", { teksti: titulli }), select] });
  return { etiketa, select };
}
