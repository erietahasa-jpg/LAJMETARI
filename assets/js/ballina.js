/**
 * ballina.js — Faqja e parë ("ballina" e gazetës).
 *
 * Përmbledh gjithë portalin në një pamje:
 *   1. Lajmi kryesor i ditës + 4 lajme të tjera të theksuara
 *   2. Kolonat "Shqipëri" dhe "Kosovë" me pjesën tjetër të lajmeve
 *   3. Lojërat e ditës
 *   4. Horoskopi (rrota e 12 shenjave)
 *   5. Rozë · VIP (nëse ka) dhe rubrikat me numrin e lajmeve
 */

import { elem, dataNeShqip } from "./utils.js";
import { kartaELajmit, eshteLajmIZakonshem } from "./lajmet.js";
import { simboliSiTekst, ditaParazgjedhur } from "./horoskopi.js";
import { LOJERAT, kartaELojes } from "./lojera/index.js";

/** Titulli i një blloku të Ballinës, me link "Shih të gjitha" sipas nevojës. */
function kokaEBllokut(titulli, linku, tekstiLinkut = "Shih të gjitha →") {
  return elem("header", {
    klasa: "blloku__koka",
    femijet: [
      elem("h2", { klasa: "blloku__titulli", teksti: titulli }),
      linku ? elem("a", { klasa: "blloku__linku", teksti: tekstiLinkut, atribute: { href: linku } }) : null,
    ],
  });
}

/**
 * @param {HTMLElement} pamja
 * @param {{ lajmet: object[], horoskopi: object|null, lojera: object|null, data: string }} opsione
 */
export function vizatoBallinen(pamja, { lajmet, horoskopi, lojera, data }) {
  const teZakonshme = lajmet.filter(eshteLajmIZakonshem);
  const ditaEFundit = teZakonshme[0]?.data;
  const teDites = teZakonshme.filter((l) => l.data === ditaEFundit);

  // --- 1. Lajmi kryesor dhe të theksuarat ---
  // Kryesori: lajmi i parë i Shqipërisë (ose i pari që kemi); pastaj 4 të tjerë, të përzier mes vendeve
  const kryesori = teDites.find((l) => l.vendi === "Shqipëri") ?? teDites[0];
  const teTjeret = teDites.filter((l) => l !== kryesori);
  const theksuarat = nderthur(
    teTjeret.filter((l) => l.vendi === "Shqipëri"),
    teTjeret.filter((l) => l.vendi === "Kosovë"),
  ).slice(0, 4);
  const mbetur = teTjeret.filter((l) => !theksuarat.includes(l));

  if (kryesori) {
    pamja.append(elem("section", {
      klasa: "faqja-pare",
      atribute: { "aria-label": "Lajmet kryesore" },
      femijet: [
        elem("p", { klasa: "faqja-pare__data", teksti: `Lajmet kryesore · ${dataNeShqip(ditaEFundit)}` }),
        elem("div", {
          klasa: "faqja-pare__rrjeta",
          femijet: [
            kartaELajmit(kryesori, "kryesore"),
            elem("div", { klasa: "faqja-pare__anesore", femijet: theksuarat.map((l) => kartaELajmit(l)) }),
          ],
        }),
      ],
    }));
  } else {
    pamja.append(elem("p", { klasa: "bosh", teksti: "Ende s'ka lajme. Ato shfaqen pas ekzekutimit të parë të skriptit." }));
  }

  // --- 2. Kolonat sipas vendit ---
  const kolona = (vendi) => {
    const lista = mbetur.filter((l) => l.vendi === vendi);
    if (!lista.length) return null;
    return elem("section", {
      klasa: `kolona kolona--${vendi === "Shqipëri" ? "al" : "ks"}`,
      femijet: [kokaEBllokut(vendi, "#lajmet"), ...lista.map((l) => kartaELajmit(l, "kompakte"))],
    });
  };
  const kolonat = [kolona("Shqipëri"), kolona("Kosovë")].filter(Boolean);
  if (kolonat.length) pamja.append(elem("div", { klasa: "kolonat", femijet: kolonat }));

  // --- 3. Lojërat e ditës ---
  if (lojera) {
    pamja.append(elem("section", {
      klasa: "blloku blloku--lojera",
      femijet: [
        kokaEBllokut("Lojërat e ditës", "#lojera"),
        elem("div", { klasa: "lojera-rrjeta", femijet: LOJERAT.map((l) => kartaELojes(l, data, lojera)) }),
      ],
    }));
  }

  // --- 4. Horoskopi: rrota e shenjave, secila të çon te parashikimi i saj ---
  const ditaHoroskopit = horoskopi && ditaParazgjedhur(horoskopi);
  const shenjat = ditaHoroskopit ? horoskopi.dite[ditaHoroskopit] : null;
  if (shenjat) {
    pamja.append(elem("section", {
      klasa: "blloku blloku--horoskop",
      femijet: [
        kokaEBllokut("Horoskopi i sotëm", "#horoskopi", "Të 12 shenjat →"),
        elem("div", {
          klasa: "zodiak__rrota zodiak__rrota--ballina",
          femijet: shenjat.map((s) => elem("a", {
            klasa: "zodiak__butoni",
            atribute: { href: `#horoskopi?shenja=${encodeURIComponent(s.emri)}`, title: s.emri },
            femijet: [
              elem("span", { klasa: "zodiak__simboli", teksti: simboliSiTekst(s.simboli), atribute: { "aria-hidden": "true" } }),
              elem("span", { klasa: "zodiak__emri", teksti: s.emri }),
            ],
          })),
        }),
      ],
    }));
  }

  // --- 5a. Rozë · VIP: 3 lajmet e fundit (vetëm nëse ka) ---
  const roze = lajmet.filter((l) => l.rubrika === "Rozë").slice(0, 3);
  if (roze.length) {
    pamja.append(elem("section", {
      klasa: "blloku blloku--roze",
      femijet: [kokaEBllokut("Rozë · VIP", "#roze"), elem("div", { klasa: "dita__rrjeta", femijet: roze.map((l) => kartaELajmit(l)) })],
    }));
  }

  // --- 5b. Rubrikat me numrin e lajmeve; secila të çon te lista e filtruar ---
  const numerimi = new Map();
  for (const l of teZakonshme) numerimi.set(l.rubrika, (numerimi.get(l.rubrika) ?? 0) + 1);
  pamja.append(elem("section", {
    klasa: "blloku",
    femijet: [
      kokaEBllokut("Eksploro sipas rubrikës", null),
      elem("div", {
        klasa: "rubrikat",
        femijet: [...numerimi].sort((a, b) => b[1] - a[1]).map(([rubrika, numri]) => elem("a", {
          klasa: "rubrika-karta",
          atribute: { href: `#lajmet?rubrika=${encodeURIComponent(rubrika)}`, "data-rubrika": rubrika },
          femijet: [elem("span", { teksti: rubrika }), elem("span", { klasa: "rubrika-karta__numri", teksti: numri })],
        })),
      }),
    ],
  }));

  return () => {};
}

/** Ndërthur dy lista: [a1, b1, a2, b2, …], që theksuarat të kenë edhe Shqipëri edhe Kosovë. */
function nderthur(a, b) {
  const rezultati = [];
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i]) rezultati.push(a[i]);
    if (b[i]) rezultati.push(b[i]);
  }
  return rezultati;
}
