#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
mbledh_lajmet.py — "Redaktori" i portalit Lajmëtari AL·KS, pa inteligjencë artificiale.

ÇFARË BËN KY SKRIPT (në rend):
  1. Lexon konfigurimin (config/burimet.json, config/rubrikat.json) dhe gjendjen (data/meta.json).
  2. Shkarkon feed-et RSS të mediave dhe i ruan artikujt e rinj në një "pishinë" kandidatësh
     (data/kandidatet.json). Pishina duhet sepse RSS-ja mban vetëm 10–50 artikujt e fundit:
     nëse skripti punon disa herë në ditë, nuk humbet asnjë lajm të ditës.
  3. Për çdo ditë që ka përfunduar dhe ende s'është publikuar (pas "fundit" deri dje),
     zgjedh lajmet sipas rregullave (max 2 nga një media, 8–10 Shqipëri, 4–6 Kosovë),
     pa dublikata, me rubrika sa më të ndryshme. Rubrikat e veçanta (Rozë = lajmet e VIP-ave,
     Horoskop) zgjidhen veçmas, me kuotën e tyre, pa zënë vendin e lajmeve të zakonshme.
  4. Për çdo lajm krijon përmbledhjen me një algoritëm klasik "ekstraktiv": zgjedh 1–2 fjalitë
     më përfaqësuese nga teksti i vetë burimit (nuk shpik asgjë, nuk rishkruan asgjë).
  5. Shkruan data/lajme.json (që e lexon faqja) dhe përditëson data/meta.json.

Përdorimi:
  python scripts/mbledh_lajmet.py            # ekzekutim normal
  python scripts/mbledh_lajmet.py --prove    # provë: tregon çfarë do bënte, pa shkruar asgjë
"""

# ---------------------------------------------------------------------------
# IMPORTET
# ---------------------------------------------------------------------------
import argparse            # lexon opsionet e linjës së komandës (p.sh. --prove)
import html                # kthen &amp; në &, &euml; në ë etj.
import json                # lexon/shkruan skedarët JSON
import re                  # shprehje të rregullta për pastrimin e tekstit
import sys                 # për mesazhet e gabimit dhe kodin e daljes
import unicodedata         # heq shenjat diakritike (ë→e, ç→c) për krahasime
from collections import Counter          # numëron fjalët për algoritmin e përmbledhjes
from datetime import date, datetime, timedelta, timezone
from difflib import SequenceMatcher      # mat ngjashmërinë e dy titujve (për dublikatat)
from pathlib import Path                 # punë e thjeshtë me shtigjet e skedarëve
from zoneinfo import ZoneInfo            # ora e Tiranës (merr parasysh edhe orën verore)

import feedparser          # biblioteka që lexon RSS/Atom, edhe kur feed-i ka gabime të vogla
import requests            # shkarkon feed-et nga interneti

# ---------------------------------------------------------------------------
# KONSTANTET: shtigjet e skedarëve dhe parametrat e përgjithshëm
# ---------------------------------------------------------------------------
RRENJA = Path(__file__).resolve().parent.parent      # dosja kryesore e projektit
SKEDAR_BURIMET = RRENJA / "config" / "burimet.json"   # lista e mediave dhe rregullat
SKEDAR_RUBRIKAT = RRENJA / "config" / "rubrikat.json" # fjalët kyçe për rubrikat
SKEDAR_LAJMET = RRENJA / "data" / "lajme.json"        # lajmet e publikuara (i lexon faqja)
SKEDAR_META = RRENJA / "data" / "meta.json"           # gjendja: aktiv, fundit
SKEDAR_KANDIDATET = RRENJA / "data" / "kandidatet.json"  # pishina e artikujve të mbledhur

ZONA = ZoneInfo("Europe/Tirane")   # të gjitha datat llogariten sipas orës së Tiranës
DITE_NE_PISHINE = 7                # kandidatët më të vjetër se kaq ditë fshihen
PRAGU_NGJASHMERISE = 0.72          # mbi këtë ngjashmëri, dy tituj quhen e njëjta ngjarje
PRAGU_FJALEVE_TE_PERBASHKETA = 0.55  # ose kur ndajnë kaq pjesë të fjalëve kryesore

# Identifikohemi me emër të ndershëm robotin; disa faqe refuzojnë kërkesat pa User-Agent.
KOKAT_HTTP = {"User-Agent": "LajmetariALKS/1.0 (+lexues RSS per portal lajmesh)"}

# Fjalë shumë të zakonshme shqip që nuk tregojnë asgjë për temën e lajmit.
# Përjashtohen nga numërimi i fjalëve (përmbledhja) dhe nga krahasimi i titujve (dublikatat).
FJALE_BOSHE = set("""
e i te të ne në me më nga per për dhe por se si qe që ka kane kanë ishte jane janë do u
nje një kjo ky keto këto ato ai ajo ju ne na ma mu cfare çfarë edhe apo ose pas para mbi
nen nën deri tek te sot dje nesër neser shume shumë pak vetem vetëm tij saj tyre tona juaj
sipas gjate gjatë kur ku kush cili cila ndaj prej per mes rreth duke qene qenë eshte është
""".split())


# ---------------------------------------------------------------------------
# FUNKSIONE NDIHMËSE PËR SKEDARËT
# ---------------------------------------------------------------------------
def lexo_json(shtegu: Path, parazgjedhur):
    """Lexon një skedar JSON; nëse nuk ekziston ende, kthen vlerën parazgjedhur."""
    if not shtegu.exists():
        return parazgjedhur
    with shtegu.open(encoding="utf-8") as f:
        return json.load(f)


def shkruaj_json(shtegu: Path, te_dhenat) -> None:
    """Shkruan JSON me shkronja shqipe të lexueshme (ensure_ascii=False) dhe me formatim të rregullt."""
    shtegu.parent.mkdir(parents=True, exist_ok=True)
    with shtegu.open("w", encoding="utf-8") as f:
        json.dump(te_dhenat, f, ensure_ascii=False, indent=2)
        f.write("\n")


# ---------------------------------------------------------------------------
# PASTRIMI DHE NORMALIZIMI I TEKSTIT
# ---------------------------------------------------------------------------
def pastro_html(teksti: str) -> str:
    """Heq etiketat HTML, fjalitë e shtuara automatikisht nga WordPress dhe hapësirat e tepërta."""
    if not teksti:
        return ""
    teksti = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", teksti, flags=re.S | re.I)  # heq kodin
    teksti = re.sub(r"<[^>]+>", " ", teksti)            # heq çdo etiketë <...>
    teksti = html.unescape(teksti)                        # &euml; → ë
    teksti = re.sub(r"The post .*? appeared first on .*?\.?$", "", teksti.strip())  # fjali e WordPress-it
    teksti = re.sub(r"\[(…|\.\.\.|&#8230;)\]", "", teksti)  # heq "[…]" në fund të përshkrimit
    return re.sub(r"\s+", " ", teksti).strip()           # bashkon hapësirat e shumta në një


def normalizo(teksti: str) -> str:
    """Kthen tekstin në formë krahasimi: shkronja të vogla, pa ë/ç, pa shenja pikësimi."""
    teksti = unicodedata.normalize("NFKD", teksti.lower())
    teksti = "".join(c for c in teksti if not unicodedata.combining(c))  # ë → e, ç → c
    teksti = re.sub(r"[^a-z0-9\- ]+", " ", teksti)
    return re.sub(r"\s+", " ", teksti).strip()


def fjalet_kryesore(teksti: str) -> set:
    """Fjalët me kuptim të një titulli (pa fjalët boshe), për të krahasuar dy lajme."""
    return {w for w in normalizo(teksti).split() if len(w) > 2 and w not in FJALE_BOSHE}


def normalizo_url(url: str) -> str:
    """Heq parametrat e gjurmimit (?utm_...) dhe '/' në fund, që i njëjti artikull të njihet si i tillë."""
    url = url.split("#")[0].split("?")[0].strip()
    return url.rstrip("/").replace("http://", "https://")


# ---------------------------------------------------------------------------
# PËRMBLEDHJA EKSTRAKTIVE (pa AI)
# ---------------------------------------------------------------------------
def ndaj_ne_fjali(teksti: str) -> list:
    """Ndan tekstin në fjali sipas pikës, pikëpyetjes dhe pikëçuditjes të ndjekura nga shkronjë e madhe."""
    copat = re.split(r"(?<=[.!?…])\s+(?=[A-ZÇËÁ-Ž\"„“«])", teksti)
    return [c.strip() for c in copat if len(c.strip()) > 25]   # hedh copat shumë të shkurtra


def permbledh(teksti: str, nr_fjali: int, max_karaktere: int) -> str:
    """
    Algoritëm klasik i përmbledhjes ekstraktive (frekuenca e fjalëve), pa AI:
      - numëron sa herë shfaqet çdo fjalë me kuptim në gjithë tekstin;
      - çdo fjali merr pikë = mesatarja e frekuencave të fjalëve të saj;
      - fjalia e parë merr një bonus, sepse në lajme fakti kryesor zakonisht jepet në krye;
      - zgjidhen 'nr_fjali' fjalitë me pikë më të larta dhe shfaqen në rendin origjinal.
    Rezultati përbëhet vetëm nga fjali të vetë burimit, prandaj nuk shpik asnjë fakt.
    """
    fjalite = ndaj_ne_fjali(teksti)
    if not fjalite:                       # teksti shumë i shkurtër: e marrim siç është
        return shkurto(teksti, max_karaktere)
    if len(fjalite) <= nr_fjali:
        return shkurto(" ".join(fjalite), max_karaktere)

    frekuencat = Counter(w for w in normalizo(teksti).split() if w not in FJALE_BOSHE and len(w) > 2)
    pikët = []
    for i, fjalia in enumerate(fjalite):
        fjalet = [w for w in normalizo(fjalia).split() if w in frekuencat]
        pike = sum(frekuencat[w] for w in fjalet) / (len(fjalet) or 1)
        if i == 0:
            pike *= 1.5                   # bonusi i "fjalisë hyrëse" të lajmit
        pikët.append((pike, i))

    zgjedhura = sorted(i for _, i in sorted(pikët, reverse=True)[:nr_fjali])  # rendi origjinal
    return shkurto(" ".join(fjalite[i] for i in zgjedhura), max_karaktere)


def shkurto(teksti: str, max_karaktere: int) -> str:
    """Pret tekstin në kufirin e një fjale dhe shton '…' nëse e kalon gjatësinë e lejuar."""
    if len(teksti) <= max_karaktere:
        return teksti
    return teksti[:max_karaktere].rsplit(" ", 1)[0].rstrip(",;:–-") + "…"


# ---------------------------------------------------------------------------
# KLASIFIKIMI NË RUBRIKA DHE FILTRI I PËRJASHTIMEVE (me fjalë kyçe)
# ---------------------------------------------------------------------------
def gjej_rubriken(titulli: str, kategorite_rss: list, teksti: str, konf_rubrikat: dict) -> str:
    """
    Jep pikë për çdo rubrikë sipas fjalëve kyçe që gjen:
      titulli dhe kategoritë e RSS-së ×3 (janë më të sakta), teksti ×1.
    Fjala kyçe duhet të jetë fillim fjale (" polic" kap "policia", jo "apolicor").
    Nëse asnjë rubrikë s'merr pikë, përdoret rubrika parazgjedhur.
    """
    burime = [
        (" " + normalizo(titulli) + " ", 3),
        (" " + normalizo(" ".join(kategorite_rss)) + " ", 3),
        (" " + normalizo(teksti[:1500]) + " ", 1),
    ]

    # 1) Rubrikat e veçanta (Horoskop, Rozë) kanë përparësi, por kontrollohen vetëm te titulli
    #    dhe kategoritë e RSS-së (burime[:2]), jo te teksti, për të shmangur gabimet.
    for rubrika, fjalet in konf_rubrikat.get("rubrikat_e_vecanta", {}).items():
        if rubrika.startswith("_"):
            continue                                # kapërcen fushën "_shpjegim"
        for fjala in fjalet:
            kerko = " " + normalizo(fjala)
            if any(kerko in vendi for vendi, _ in burime[:2]):
                return rubrika

    # 2) Rubrikat e zakonshme: fiton ajo me më shumë pikë
    pike = Counter()
    for rubrika, fjalet in konf_rubrikat["rubrikat"].items():
        for fjala in fjalet:
            kerko = " " + normalizo(fjala) + (" " if fjala.endswith(" ") else "")
            for vendi_ku_kerkojme, pesha in burime:
                if kerko in vendi_ku_kerkojme:
                    pike[rubrika] += pesha
    return pike.most_common(1)[0][0] if pike else konf_rubrikat["parazgjedhur"]


def duhet_perjashtuar(titulli: str, konf_rubrikat: dict) -> bool:
    """True nëse titulli ka një nga fjalët e ndaluara (horoskop, moti, VIP...)."""
    t = " " + normalizo(titulli) + " "
    return any(" " + normalizo(f) in t for f in konf_rubrikat["perjashto"]["fjalet"])


# ---------------------------------------------------------------------------
# DUBLIKATAT
# ---------------------------------------------------------------------------
def eshte_dublikate(kandidati: dict, te_tjeret: list) -> bool:
    """
    Kontrollon nëse kandidati është i njëjti artikull ose e njëjta ngjarje me një lajm tjetër:
      - i njëjti URL (pas normalizimit);
      - tituj shumë të ngjashëm (SequenceMatcher ≥ prag);
      - ose shumë fjalë kryesore të përbashkëta (ngjarja e njëjtë nga një media tjetër).
    """
    url = normalizo_url(kandidati["url"])
    titull_n = normalizo(kandidati["titulli"])
    fjalet = fjalet_kryesore(kandidati["titulli"])
    for tjetri in te_tjeret:
        if normalizo_url(tjetri["url"]) == url:
            return True
        if SequenceMatcher(None, titull_n, normalizo(tjetri["titulli"])).ratio() >= PRAGU_NGJASHMERISE:
            return True
        fjalet_tjera = fjalet_kryesore(tjetri["titulli"])
        if fjalet and fjalet_tjera:
            perbashket = len(fjalet & fjalet_tjera) / min(len(fjalet), len(fjalet_tjera))
            if perbashket >= PRAGU_FJALEVE_TE_PERBASHKETA and len(fjalet & fjalet_tjera) >= 3:
                return True
    return False


# ---------------------------------------------------------------------------
# SHKARKIMI I FEED-EVE DHE MBUSHJA E PISHINËS
# ---------------------------------------------------------------------------
def shkarko_feed(url: str):
    """Shkarkon një feed RSS dhe e kthen të lexuar nga feedparser. Ngre gabim nëse faqja s'përgjigjet."""
    pergjigja = requests.get(url, headers=KOKAT_HTTP, timeout=25)
    pergjigja.raise_for_status()                    # 403, 404, 500... → gabim
    return feedparser.parse(pergjigja.content)


def data_e_artikullit(hyrja) -> datetime | None:
    """Merr datën e publikimit nga RSS (UTC) dhe e kthen në orën e Tiranës."""
    koha = hyrja.get("published_parsed") or hyrja.get("updated_parsed")
    if not koha:
        return None                                 # pa datë → s'mund ta vendosim në ditë
    return datetime(*koha[:6], tzinfo=timezone.utc).astimezone(ZONA)


def mblidh_kandidatet(burimet: list, pishina: list, raport: dict) -> list:
    """Shkarkon çdo feed aktiv dhe shton në pishinë artikujt që nuk janë aty ende."""
    url_ekzistuese = {normalizo_url(k["url"]) for k in pishina}
    for burimi in burimet:
        if not burimi.get("aktiv", True):
            continue                                # media e çaktivizuar në konfigurim
        try:
            feed = shkarko_feed(burimi["rss"])
        except Exception as gabim:                  # faqja s'u hap: e shënojmë dhe vazhdojmë
            raport["probleme"].append(f"{burimi['emri']}: feed-i nuk u hap ({type(gabim).__name__})")
            continue

        te_rinj = 0
        for hyrja in feed.entries:
            url = hyrja.get("link", "")
            data_pub = data_e_artikullit(hyrja)
            if not url or not data_pub or normalizo_url(url) in url_ekzistuese:
                continue
            # Teksti i plotë (content:encoded) është më i mirë për përmbledhje se përshkrimi i shkurtër.
            teksti = ""
            if hyrja.get("content"):
                teksti = pastro_html(hyrja.content[0].get("value", ""))
            if len(teksti) < 80:
                teksti = pastro_html(hyrja.get("summary", ""))
            pishina.append({
                "titulli": pastro_html(hyrja.get("title", "")),
                "teksti": teksti[:4000],            # ruajmë vetëm sa duhet për përmbledhjen
                "kategorite": [t.get("term", "") for t in hyrja.get("tags", [])],
                "url": url,
                "burimi": burimi["emri"],
                "vendi": burimi["vendi"],
                "publikuar": data_pub.isoformat(),
            })
            url_ekzistuese.add(normalizo_url(url))
            te_rinj += 1
        raport["feed"][burimi["emri"]] = te_rinj
    return pishina


# ---------------------------------------------------------------------------
# PËRZGJEDHJA E LAJMEVE PËR NJË DITË
# ---------------------------------------------------------------------------
def zgjidh_me_radhe(sipas_medias: dict, maksimumi: int, max_nga_media: int, te_krahasueshmit: list) -> list:
    """
    Zgjedh deri në 'maksimumi' lajme me radhë ("round-robin") mes mediave:
      - në çdo xhiro merret nga një lajm për media, që të përdoren sa më shumë media;
      - asnjë media s'jep më shumë se 'max_nga_media';
      - kur një media ka disa kandidatë, merret ai i rubrikës më pak të përfaqësuar deri tani;
      - kandidati kapërcehet nëse është dublikatë e ndonjë lajmi te 'te_krahasueshmit' ose i të zgjedhurve.
    """
    zgjedhura = []
    numri_media = Counter()       # sa lajme kemi marrë nga secila media
    numri_rubrika = Counter()     # sa lajme kemi për secilën rubrikë
    vazhdo = True
    while vazhdo and len(zgjedhura) < maksimumi:
        vazhdo = False
        for media, lista in sipas_medias.items():          # një xhiro: nga një lajm për media
            if len(zgjedhura) >= maksimumi or numri_media[media] >= max_nga_media:
                continue
            lista.sort(key=lambda k: numri_rubrika[k["rubrika"]])   # rubrika më e rrallë para
            while lista:
                kandidati = lista.pop(0)
                if not eshte_dublikate(kandidati, te_krahasueshmit + zgjedhura):
                    zgjedhura.append(kandidati)
                    numri_media[media] += 1
                    numri_rubrika[kandidati["rubrika"]] += 1
                    vazhdo = True
                    break
    return zgjedhura


def zgjidh_per_diten(dita: date, pishina: list, publikuara: list, rregullat: dict, konf_rubrikat: dict) -> list:
    """
    Zgjedh lajmet e një dite (vetëm artikujt e publikuar atë ditë, sipas orës së Tiranës):
      A) lajmet e zakonshme: veçmas për Shqipërinë dhe Kosovën, me kuotat e secilit vend;
      B) rubrikat e veçanta (Rozë, Horoskop): seksion më vete me kuotën e vet,
         nga mediat e të dy vendeve, pa e ngrënë kuotën e lajmeve të zakonshme.
    """
    dita_str = dita.isoformat()
    te_dites = [k for k in pishina if k["publikuar"][:10] == dita_str]
    te_dites.sort(key=lambda k: k["publikuar"], reverse=True)    # më të rejat së pari

    # Çdo kandidati i caktojmë rubrikën një herë; hedhim ata me fjalë të përjashtuara (moti, kuiz...).
    kandidatet = [
        dict(k, rubrika=gjej_rubriken(k["titulli"], k["kategorite"], k["teksti"], konf_rubrikat))
        for k in te_dites if not duhet_perjashtuar(k["titulli"], konf_rubrikat)
    ]
    vecanta = {r: v for r, v in rregullat.get("rubrikat_e_vecanta", {}).items() if not r.startswith("_")}

    def grupo_sipas_medias(lista):
        """{"BalkanWeb": [kandidat, ...], "RTSH": [...]} — çdo media me listën e vet."""
        grupet = {}
        for k in lista:
            grupet.setdefault(k["burimi"], []).append(k)
        return grupet

    zgjedhura = []

    # --- A) Lajmet e zakonshme sipas vendit ---
    for vendi, maksimumi in (("Shqipëri", rregullat["max_shqiperi_ne_dite"]),
                             ("Kosovë", rregullat["max_kosove_ne_dite"])):
        te_vendit = [k for k in kandidatet if k["vendi"] == vendi and k["rubrika"] not in vecanta]
        zgjedhura += zgjidh_me_radhe(grupo_sipas_medias(te_vendit), maksimumi,
                                     rregullat["max_nga_nje_media_ne_dite"], publikuara + zgjedhura)

    # --- B) Rubrikat e veçanta (Rozë, Horoskop) ---
    for rubrika, kuota in vecanta.items():
        te_rubrikes = [k for k in kandidatet if k["rubrika"] == rubrika]
        # Horoskopi ka të njëjtin titull çdo ditë ("Horoskopi për ..."), ndaj e krahasojmë
        # vetëm me lajmet e kësaj dite; përndryshe do të dukej si dublikatë e të djeshmit.
        if kuota.get("dublikata_vetem_brenda_dites"):
            krahaso_me = [l for l in publikuara if l.get("data") == dita_str] + zgjedhura
        else:
            krahaso_me = publikuara + zgjedhura
        zgjedhura += zgjidh_me_radhe(grupo_sipas_medias(te_rubrikes), kuota["max_ne_dite"],
                                     kuota.get("max_nga_nje_media", 1), krahaso_me)
    return zgjedhura


def krijo_permbledhjen(kandidati: dict, rregullat: dict) -> str:
    """
    Zgjedh mënyrën e përmbledhjes sipas rubrikës:
      - Horoskop: teksti ka 12 shenja me nga një paragraf; "fjalitë më përfaqësuese" do të ishin
        copa të rastësishme, ndaj marrim vetëm hyrjen (fjalinë e parë) ose një tekst standard.
      - Të gjitha të tjerat (përfshirë Rozë): përmbledhja ekstraktive e zakonshme.
    """
    if kandidati["rubrika"] == "Horoskop":
        fjalite = ndaj_ne_fjali(kandidati["teksti"])
        if fjalite:
            return shkurto(fjalite[0], 200)
        return f"Parashikimi i ditës për 12 shenjat e zodiakut. Lexoje të plotë te {kandidati['burimi']}."
    return permbledh(kandidati["teksti"], rregullat["fjali_ne_permbledhje"],
                     rregullat["max_karaktere_permbledhje"])


def nderto_lajmin(kandidati: dict, doc_id: str, rregullat: dict) -> dict:
    """Kthen kandidatin në formatin përfundimtar që lexon faqja (fushat njësoj si në versionin me AI)."""
    return {
        "id": doc_id,
        "titulli": kandidati["titulli"],          # titulli origjinal i medias (nuk rishkruhet)
        "permbledhja": krijo_permbledhjen(kandidati, rregullat),
        "vendi": kandidati["vendi"],
        "rubrika": kandidati["rubrika"],
        "data": kandidati["publikuar"][:10],
        "burimi": kandidati["burimi"],
        "url": kandidati["url"],
        "lloji": "real",
        "krijuar": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "shtuarNga": "Skripti RSS (pa AI)",
    }


# ---------------------------------------------------------------------------
# PROGRAMI KRYESOR
# ---------------------------------------------------------------------------
def main() -> int:
    # --- Opsionet e linjës së komandës ---
    parser = argparse.ArgumentParser(description="Mbledh lajmet ditore nga RSS, pa AI.")
    parser.add_argument("--prove", action="store_true", help="vetëm shfaq rezultatin, mos shkruaj skedarë")
    args = parser.parse_args()

    # --- HAPI 1: konfigurimi dhe gjendja ---
    konf = lexo_json(SKEDAR_BURIMET, None)
    konf_rubrikat = lexo_json(SKEDAR_RUBRIKAT, None)
    if not konf or not konf_rubrikat:
        print("Mungon config/burimet.json ose config/rubrikat.json", file=sys.stderr)
        return 1
    rregullat = konf["rregullat"]
    meta = lexo_json(SKEDAR_META, {"aktiv": True, "fundit": None})
    if meta.get("aktiv") is False:                 # çelësi për ta ndalur gjenerimin pa prekur kodin
        print("Gjenerimi është i ndalur nga përdoruesi.")
        return 0

    publikuara = lexo_json(SKEDAR_LAJMET, [])      # lajmet që janë tashmë në faqe
    pishina = lexo_json(SKEDAR_KANDIDATET, [])     # artikujt e mbledhur në ekzekutimet e mëparshme
    raport = {"feed": {}, "probleme": [], "dite": {}}

    # --- HAPI 2: mbledhim artikujt e rinj nga RSS ---
    pishina = mblidh_kandidatet(konf["burimet"], pishina, raport)

    # --- HAPI 3: cilat ditë duhen mbushur (vetëm ditë të përfunduara: deri dje) ---
    sot = datetime.now(ZONA).date()
    dje = sot - timedelta(days=1)
    me_e_hershmja = date.fromisoformat(rregullat["data_me_e_hershme"])
    if meta.get("fundit"):
        nga = date.fromisoformat(meta["fundit"]) + timedelta(days=1)
    else:
        nga = dje                                   # ekzekutimi i parë: vetëm dje
    nga = max(nga, me_e_hershmja, dje - timedelta(days=rregullat["max_dite_per_ekzekutim"] - 1))
    ditet = [nga + timedelta(days=i) for i in range((dje - nga).days + 1)]

    # --- HAPI 4: përzgjedhja dhe ndërtimi i lajmeve për secilën ditë ---
    te_reja = []
    for dita in ditet:
        zgjedhura = zgjidh_per_diten(dita, pishina, publikuara + te_reja, rregullat, konf_rubrikat)
        id_ekzistuese = {l["id"] for l in publikuara + te_reja}
        numeruesi = Counter()
        for k in zgjedhura:
            # Kodi në id: "roze"/"horoskop" për rubrikat e veçanta, "al"/"ks" për lajmet e zakonshme
            if k["rubrika"] == "Rozë":
                kodi = "roze"
            elif k["rubrika"] == "Horoskop":
                kodi = "horoskop"
            else:
                kodi = "al" if k["vendi"] == "Shqipëri" else "ks"
            while True:                             # gjen numrin e parë të lirë: 01, 02, ...
                numeruesi[kodi] += 1
                doc_id = f"{dita.isoformat()}-{kodi}-{numeruesi[kodi]:02d}"
                if doc_id not in id_ekzistuese:
                    break
            te_reja.append(nderto_lajmin(k, doc_id, rregullat))
        # Raporti numëron lajmet e zakonshme sipas vendit dhe rubrikat e veçanta më vete
        vecanta = [r for r in rregullat.get("rubrikat_e_vecanta", {}) if not r.startswith("_")]
        raport["dite"][dita.isoformat()] = Counter(
            k["rubrika"] if k["rubrika"] in vecanta else k["vendi"] for k in zgjedhura)

    # --- HAPI 5: ruajtja ---
    kufiri = (sot - timedelta(days=rregullat["mbaj_lajme_per_dite"])).isoformat()
    lajmet = sorted(publikuara + te_reja, key=lambda l: (l["data"], l["id"]), reverse=True)
    lajmet = [l for l in lajmet if l["data"] >= kufiri]               # mbajmë vetëm N ditët e fundit
    kufiri_pishines = (sot - timedelta(days=DITE_NE_PISHINE)).isoformat()
    pishina = [k for k in pishina if k["publikuar"][:10] >= kufiri_pishines]

    if ditet:
        meta["fundit"] = ditet[-1].isoformat()
    meta["perditesuar"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    if args.prove:
        for l in te_reja:
            print(f"[{l['data']}] {l['vendi']:9} {l['rubrika']:11} {l['burimi']:17} {l['titulli'][:70]}")
    else:
        shkruaj_json(SKEDAR_LAJMET, lajmet)
        shkruaj_json(SKEDAR_KANDIDATET, pishina)
        shkruaj_json(SKEDAR_META, meta)

    # --- HAPI 6: raporti përmbledhës (shfaqet në log-un e GitHub Actions) ---
    print("\n=== RAPORTI ===")
    print("Artikuj të rinj në pishinë sipas medias:", dict(raport["feed"]))
    for dita, numrat in raport["dite"].items():
        te_tjera = ", ".join(f"{r} {n}" for r, n in numrat.items() if r not in ("Shqipëri", "Kosovë"))
        print(f"{dita}: Shqipëri {numrat.get('Shqipëri', 0)}, Kosovë {numrat.get('Kosovë', 0)}"
              + (f" | {te_tjera}" if te_tjera else ""))
    if not ditet:
        print("Asnjë ditë e re për t'u mbushur (dje është publikuar tashmë).")
    for p in raport["probleme"]:
        print("PROBLEM:", p)
    return 0


# Ky kusht bën që main() të ekzekutohet vetëm kur skripti thirret drejtpërdrejt,
# jo kur importohet nga një skedar tjetër (p.sh. nga testet).
if __name__ == "__main__":
    sys.exit(main())
