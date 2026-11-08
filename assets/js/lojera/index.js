/**
 * lojera/index.js — Faqja "Lojëra": lista e lojërave të ditës dhe hapja e secilës.
 *
 * Çdo lojë përshkruhet një herë në listën LOJERAT (emri, ikona, si montohet,
 * si dihet nëse është zgjidhur). Për të shtuar një lojë të re, mjafton ta shtosh këtu.
 */

import { elem, dataNeShqip } from "../utils.js";
import { montoSudoku, eshteZgjidhurSudoku } from "./sudoku.js";
import { montoFjalekerkim, eshteZgjidhurFjalekerkimi } from "./fjalekerkim.js";
import { montoGjeegjezat, eshteZgjidhurGjeegjeza } from "./gjeegjeza.js";
import { montoKuizin, eshteZgjidhurKuizi } from "./kuizi.js";

export const LOJERAT = [
  {
    id: "sudoku",
    emri: "Sudoku",
    ikona: "9",
    pershkrimi: "Klasiku i gazetave, në tri nivele.",
    monto: (k, d) => montoSudoku(k, { data: d }),
    zgjidhur: (d) => eshteZgjidhurSudoku(d),
  },
  {
    id: "fjalekerkim",
    emri: "Fjalëkërkim",
    ikona: "Ë",
    pershkrimi: "Gjej 8 fjalë shqipe të fshehura në rrjetë.",
    monto: (k, d, lojera) => montoFjalekerkim(k, { data: d, konfig: lojera.fjalekerkim }),
    zgjidhur: (d, lojera) => eshteZgjidhurFjalekerkimi(d, lojera.fjalekerkim),
  },
  {
    id: "gjeegjeza",
    emri: "Gjëegjëza",
    ikona: "?",
    pershkrimi: "Tri gjëegjëza klasike për të vënë mendjen në punë.",
    monto: (k, d, lojera) => montoGjeegjezat(k, { data: d, konfig: lojera.gjeegjeza }),
    zgjidhur: (d) => eshteZgjidhurGjeegjeza(d),
  },
  {
    id: "kuizi",
    emri: "Kuizi AL·KS",
    ikona: "★",
    pershkrimi: "Pesë pyetje për historinë, gjeografinë dhe kulturën.",
    monto: (k, d, lojera) => montoKuizin(k, { data: d, konfig: lojera.kuizi }),
    zgjidhur: (d, lojera) => eshteZgjidhurKuizi(d, lojera.kuizi),
  },
];

/**
 * Karta e vogël e një loje (përdoret te faqja e lojërave dhe te Ballina).
 * @param {object} loja  një element nga LOJERAT
 */
export function kartaELojes(loja, data, lojera) {
  const zgjidhur = lojera ? loja.zgjidhur(data, lojera) : false;
  return elem("a", {
    klasa: `loje-karta loje-karta--${loja.id}${zgjidhur ? " zgjidhur" : ""}`,
    atribute: { href: `#lojera/${loja.id}` },
    femijet: [
      elem("span", { klasa: "loje-karta__ikona", teksti: loja.ikona, atribute: { "aria-hidden": "true" } }),
      elem("span", { klasa: "loje-karta__emri", teksti: loja.emri }),
      elem("span", { klasa: "loje-karta__pershkrimi", teksti: loja.pershkrimi }),
      elem("span", { klasa: "loje-karta__statusi", teksti: zgjidhur ? "✓ E zgjidhur sot" : "Luaj tani →" }),
    ],
  });
}

/**
 * Vizaton faqen e lojërave.
 * @param {HTMLElement} pamja  kontejneri kryesor
 * @param {{ data: string, lojera: object, idLojes?: string }} opsione
 * @returns {() => void} pastrimi i lojës së hapur
 */
export function vizatoLojerat(pamja, { data, lojera, idLojes }) {
  const loja = LOJERAT.find((l) => l.id === idLojes);

  pamja.append(
    elem("header", {
      klasa: "seksion-koka",
      femijet: [
        elem("p", { klasa: "seksion-koka__mbititull", teksti: dataNeShqip(data) }),
        elem("h1", { klasa: "seksion-koka__titulli", teksti: loja ? loja.emri : "Lojërat e ditës" }),
        elem("p", {
          klasa: "seksion-koka__pershkrimi",
          teksti: loja ? loja.pershkrimi : "Çdo ditë lojëra të reja, të njëjtat për të gjithë lexuesit. Progresi ruhet në pajisjen tënde.",
        }),
      ],
    }),
  );

  // Pa lojë të zgjedhur: rrjeta e kartave
  if (!loja) {
    pamja.append(elem("div", { klasa: "lojera-rrjeta", femijet: LOJERAT.map((l) => kartaELojes(l, data, lojera)) }));
    return () => {};
  }

  // Me lojë të zgjedhur: shiriti me lojërat e tjera + loja vetë
  const navigimi = elem("nav", {
    klasa: "lojera-nav",
    atribute: { "aria-label": "Lojërat" },
    femijet: [
      elem("a", { teksti: "← Të gjitha", atribute: { href: "#lojera" } }),
      ...LOJERAT.map((l) => elem("a", {
        teksti: l.emri,
        atribute: { href: `#lojera/${l.id}`, ...(l.id === loja.id ? { "aria-current": "page" } : {}) },
      })),
    ],
  });
  const kontejneri = elem("section", { klasa: `loje loje--${loja.id}`, atribute: { "aria-label": loja.emri } });
  pamja.append(navigimi, kontejneri);
  return loja.monto(kontejneri, data, lojera);
}
