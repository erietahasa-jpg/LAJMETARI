#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gjenero_horoskopin.py — Horoskopi ditor i detajuar për 12 shenjat, pa AI.

SI FUNKSIONON:
  - Tekstet janë te config/horoskopi.json: banka fjalish për "përgjithshme", "dashuri",
    "punë/financa", "shëndet", "këshilla", plus një fjali sipas elementit të shenjës.
  - Për çdo ditë, skripti krijon një "rastësi të kontrolluar" (random me farë = data).
    Kështu e njëjta ditë jep GJITHMONË të njëjtin horoskop, sado herë të ekzekutohet skripti
    (GitHub Actions e nis çdo 3 orë, por horoskopi i ditës nuk ndryshon).
  - Për çdo kategori, fjalitë përzihen dhe secila shenjë merr një fjali TË NDRYSHME,
    që dy shenja të mos kenë kurrë të njëjtin tekst në të njëjtën ditë.
  - Shtohen vlerësimet me yje (1–5), numri dhe ngjyra me fat, dhe shenja më e përputhshme.
  - Rezultati ruhet te data/horoskopi.json, të cilin e lexon faqja.

Përdorimi:
  python scripts/gjenero_horoskopin.py            # gjeneron sot + nesër, ruan skedarin
  python scripts/gjenero_horoskopin.py --prove    # shfaq horoskopin e sotëm pa ruajtur asgjë
"""

# ---------------------------------------------------------------------------
# IMPORTET
# ---------------------------------------------------------------------------
import argparse              # opsionet e linjës së komandës (--prove)
import hashlib               # kthen datën në një numër të qëndrueshëm (fara e rastësisë)
import json                  # lexim/shkrim i JSON
import random                # përzierja e fjalive dhe zgjedhja e vlerave
import sys                   # kodi i daljes
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo  # "sot" llogaritet sipas orës së Tiranës

# ---------------------------------------------------------------------------
# SHTIGJET
# ---------------------------------------------------------------------------
RRENJA = Path(__file__).resolve().parent.parent
SKEDAR_KONFIG = RRENJA / "config" / "horoskopi.json"    # shenjat dhe bankat e fjalive
SKEDAR_DALJE = RRENJA / "data" / "horoskopi.json"       # horoskopët e gjeneruar (i lexon faqja)
ZONA = ZoneInfo("Europe/Tirane")

# Kategoritë që marrin vlerësim me yje, dhe titujt e tyre në faqe
KATEGORITE_ME_YJE = {"dashuri": "Dashuri", "pune": "Punë dhe financa", "shendet": "Shëndet"}


# ---------------------------------------------------------------------------
# RASTËSIA E KONTROLLUAR
# ---------------------------------------------------------------------------
def rastesi_per(teksti: str) -> random.Random:
    """
    Krijon një gjenerator rastësie me farë të nxjerrë nga 'teksti' (p.sh. "2026-11-08").
    E njëjta farë → e njëjta renditje "e rastësishme" çdo herë. sha256 përdoret sepse jep
    të njëjtin numër në çdo kompjuter (ndryshe nga hash() i Python-it, që ndryshon çdo herë).
    """
    fara = int(hashlib.sha256(teksti.encode("utf-8")).hexdigest(), 16)
    return random.Random(fara)


def caktim_pa_perseritje(lista: list, numri: int, rng: random.Random) -> list:
    """
    Kthen 'numri' elemente nga 'lista', të gjitha të ndryshme (përzierje e listës).
    Përdoret që 12 shenjat të marrin 12 fjali të ndryshme në të njëjtën ditë.
    """
    if len(lista) < numri:
        raise ValueError(f"Lista ka vetëm {len(lista)} fjali, duhen të paktën {numri}.")
    kopje = list(lista)
    rng.shuffle(kopje)
    return kopje[:numri]


# ---------------------------------------------------------------------------
# GJENERIMI I NJË DITE
# ---------------------------------------------------------------------------
def gjenero_diten(dita: date, konf: dict) -> list:
    """Ndërton horoskopin e detajuar të 12 shenjave për një ditë."""
    shenjat = konf["shenjat"]
    nr = len(shenjat)
    rng = rastesi_per(dita.isoformat())            # një farë për gjithë ditën

    # 1) Për çdo kategori, një fjali e ndryshme për secilën shenjë
    caktimet = {kat: caktim_pa_perseritje(fjalite, nr, rng) for kat, fjalite in konf["kategorite"].items()}

    # 2) Ngjyrat me fat: secila shenjë një ngjyrë të ndryshme
    ngjyrat = caktim_pa_perseritje(konf["ngjyrat"], nr, rng)

    rezultati = []
    for i, shenja in enumerate(shenjat):
        # Rastësi e veçantë për këtë shenjë këtë ditë (yjet, numri, përputhja),
        # që ndryshimi i një shenje në konfigurim të mos i ndryshojë të tjerat.
        rng_shenje = rastesi_per(f"{dita.isoformat()}|{shenja['emri']}")

        # Fjalia e elementit (zjarr/tokë/ajër/ujë) + fjalia e përgjithshme e ditës
        fjalia_elementit = rng_shenje.choice(konf["elementet"][shenja["elementi"]])
        pergjithshme = f"{fjalia_elementit} {caktimet['pergjithshme'][i]}"

        # Shenja më e përputhshme: nga shenjat me element të përshtatshëm, përveç vetes
        elementet_ok = konf["perputhja"][shenja["elementi"]]
        kandidatet = [s["emri"] for s in shenjat if s["elementi"] in elementet_ok and s["emri"] != shenja["emri"]]

        # Vlerësimet me yje: 2–5 (ditë shumë të këqija nuk u japim, horoskopi është argëtues)
        fushat = [
            {"titulli": titulli, "yje": rng_shenje.randint(2, 5), "teksti": caktimet[kat][i]}
            for kat, titulli in KATEGORITE_ME_YJE.items()
        ]

        rezultati.append({
            "emri": shenja["emri"],
            "simboli": shenja["simboli"],
            "datat": shenja["datat"],
            "elementi": shenja["elementi"],
            "pergjithshme": pergjithshme,
            "fushat": fushat,
            "keshilla": caktimet["keshilla"][i],
            "numri": rng_shenje.randint(1, 99),
            "ngjyra": ngjyrat[i],
            "perputhja": rng_shenje.choice(kandidatet),
        })
    return rezultati


# ---------------------------------------------------------------------------
# PROGRAMI KRYESOR
# ---------------------------------------------------------------------------
def main() -> int:
    parser = argparse.ArgumentParser(description="Gjeneron horoskopin ditor, pa AI.")
    parser.add_argument("--prove", action="store_true", help="shfaq horoskopin e sotëm pa ruajtur")
    args = parser.parse_args()

    with SKEDAR_KONFIG.open(encoding="utf-8") as f:
        konf = json.load(f)
    if not konf.get("aktiv", True):                       # çelësi ndez/fik te konfigurimi
        print("Horoskopi është i çaktivizuar te config/horoskopi.json.")
        return 0

    sot = datetime.now(ZONA).date()

    # --prove: vetëm shfaqim sot, pa prekur skedarët
    if args.prove:
        for s in gjenero_diten(sot, konf):
            print(f"\n{s['simboli']} {s['emri']} ({s['datat']})\n  {s['pergjithshme']}")
            for fusha in s["fushat"]:
                print(f"  {fusha['titulli']} {'★' * fusha['yje']}{'☆' * (5 - fusha['yje'])}: {fusha['teksti']}")
            print(f"  Këshilla: {s['keshilla']} | Numri {s['numri']} | Ngjyra {s['ngjyra']} | Përputhje: {s['perputhja']}")
        return 0

    # Lexojmë horoskopët ekzistues, që të mos humbasim ditët e kaluara
    ekzistues = {"dite": {}}
    if SKEDAR_DALJE.exists():
        with SKEDAR_DALJE.open(encoding="utf-8") as f:
            ekzistues = json.load(f)
    ditet = ekzistues.get("dite", {})

    # Gjenerojmë sot + 'dite_perpara' ditë përpara (p.sh. nesër, që faqja të jetë gati pas mesnate).
    # Ditët që ekzistojnë nuk rigjenerohen, që horoskopi i publikuar të mos ndryshojë.
    te_reja = []
    for i in range(konf.get("dite_perpara", 1) + 1):
        dita = sot + timedelta(days=i)
        if dita.isoformat() not in ditet:
            ditet[dita.isoformat()] = gjenero_diten(dita, konf)
            te_reja.append(dita.isoformat())

    # Mbajmë vetëm 'mbaj_dite' ditët e fundit, që skedari të mos rritet pa fund
    kufiri = (sot - timedelta(days=konf.get("mbaj_dite", 14))).isoformat()
    ditet = {d: v for d, v in sorted(ditet.items(), reverse=True) if d >= kufiri}

    dalje = {
        "shenim": konf.get("shenim", ""),               # shfaqet në faqe si sqarim për lexuesin
        "perditesuar": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "dite": ditet,
    }
    SKEDAR_DALJE.parent.mkdir(parents=True, exist_ok=True)
    with SKEDAR_DALJE.open("w", encoding="utf-8") as f:
        json.dump(dalje, f, ensure_ascii=False, indent=2)
        f.write("\n")

    if te_reja:
        print("Horoskopi: u gjeneruan ditët", ", ".join(te_reja))
    else:
        print("Horoskopi: asnjë ditë e re, ishin të gatshme.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
