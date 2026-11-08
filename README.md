# Lajmëtari AL·KS: versioni pa AI

Ky është një portal lajmesh statik. Lajmet e ditës mblidhen nga feed-et **RSS** të mediave të Shqipërisë dhe Kosovës dhe shfaqen me **përmbledhje të shkurtër në tekst** dhe **link te artikulli origjinal**. Gjenerimi ditor bëhet me kod të zakonshëm, pa AI, dhe mund të funksionojë falas në GitHub.

## Si funksionon

```
Feed-et RSS të mediave
   │  (çdo 3 orë, GitHub Actions)
   ▼
scripts/mbledh_lajmet.py ──► data/kandidatet.json   (pishina: artikujt e 7 ditëve të fundit)
   │  pasi mbaron dita
   ▼
data/lajme.json + horoskopi.json + lojera.json  ──►  index.html + assets/js/  ──►  lexuesi
```

| Hapi | Si bëhej me AI | Si bëhet tani, me kod |
|---|---|---|
| Gjetja e lajmeve | Kërkim në web | Leximi i feed-eve RSS (`feedparser`) |
| Data e lajmit | Kontroll manual | `pubDate` nga RSS, e kthyer në orën e Tiranës |
| Përmbledhja | E rishkruar nga AI | **Ekstraktive**: 1–2 fjalitë më përfaqësuese të vetë artikullit (frekuenca e fjalëve) |
| Rubrika | Gjykimi i AI | Fjalë kyçe në titull, në kategoritë e RSS-së dhe në tekst (`config/rubrikat.json`) |
| Rozë (VIP) dhe Horoskopi | Përjashtoheshin | Rubrika të veçanta me skedën e tyre dhe kuotë më vete |
| Dublikatat | Gjykimi i AI | I njëjti URL, ngjashmëri titujsh (`difflib`) ose fjalë kyçe të përbashkëta |
| Max 2 lajme nga një media | Rregull në prompt | Përzgjedhje me radhë mes mediave (round-robin) |
| Orari | Detyrë e planifikuar | `cron` në GitHub Actions |

Titulli i lajmit mbetet ai i medias, dhe përmbledhja përbëhet vetëm nga fjali të marra nga artikulli. Skripti nuk shpik as rishkruan asgjë.

## Skedarët

| Skedari | Roli |
|---|---|
| `config/burimet.json` | Lista e mediave (emri, vendi, adresa RSS, aktiv/joaktiv) dhe rregullat e përzgjedhjes |
| `config/rubrikat.json` | Fjalët kyçe për çdo rubrikë dhe fjalët që përjashtojnë lajmin (horoskop, mot, VIP…) |
| `scripts/mbledh_lajmet.py` | "Redaktori": mbledh, filtron, përmbledh dhe shkruan lajmet |
| `scripts/gjenero_horoskopin.py` | Gjeneron horoskopin ditor të detajuar për 12 shenjat |
| `config/horoskopi.json` | Shenjat dhe fjalitë nga ndërtohet horoskopi |
| `data/horoskopi.json` | Horoskopët e gjeneruar, që i lexon faqja |
| `data/lajme.json` | Lajmet e publikuara, që i lexon faqja |
| `data/meta.json` | `aktiv` (çelësi ndez/fik) dhe `fundit` (dita e fundit e publikuar) |
| `data/kandidatet.json` | Pishina e artikujve të mbledhur, që nuk humbet asnjë lajm ndërmjet ekzekutimeve |
| `data/lojera.json` | Gjëegjëzat, pyetjet e kuizit dhe temat e fjalëkërkimit |
| `index.html` | Skeleti: koka e gazetës, menuja, shiriti "Të fundit" |
| `assets/css/style.css` | I gjithë dizajni (tema e ndritshme dhe e errët, telefoni, animacionet) |
| `assets/js/main.js` | Nisja: ngarkon të dhënat, navigimi mes faqeve, tema |
| `assets/js/utils.js` | Funksione ndihmëse: datat në shqip, rastësia me farë, ruajtja lokale |
| `assets/js/ballina.js` | Ballina: lajmi kryesor, kolonat, lojërat, horoskopi, rubrikat |
| `assets/js/lajmet.js` | Faqet Lajmet dhe Rozë · VIP me filtra |
| `assets/js/horoskopi.js` | Faqja e horoskopit |
| `assets/js/lojera/` | Lojërat: `sudoku.js`, `fjalekerkim.js`, `gjeegjeza.js`, `kuizi.js` dhe `index.js` (lista e lojërave) |
| `.github/workflows/gjenerimi-ditor.yml` | Orari automatik |

## Vënia në punë (rreth 10 minuta)

1. Krijo një repo të re në GitHub dhe ngarko aty të gjithë përmbajtjen e kësaj dosjeje.
2. **Settings → Pages**: te "Source" zgjidh *Deploy from a branch*, pastaj degën `main` dhe dosjen `/ (root)`. Faqja hapet te `https://<emri-yt>.github.io/<repo>/`.
3. **Settings → Actions → General → Workflow permissions**: zgjidh *Read and write permissions*.
4. Te skeda **Actions**, hap "Gjenerimi ditor i lajmeve" dhe shtyp **Run workflow** për ta provuar menjëherë. Pas kësaj, workflow-i punon vetë çdo 3 orë.

### Provë në kompjuterin tënd

```bash
pip install -r requirements.txt
python scripts/mbledh_lajmet.py --prove   # tregon çfarë do të zgjidhte, pa shkruar asgjë
python scripts/mbledh_lajmet.py           # ekzekutim i vërtetë
python -m http.server 8000                # pastaj hap http://localhost:8000
```

## Dizajni dhe faqet

Faqja ndërtohet si një gazetë klasike: emri i madh në krye me vijë të dyfishtë, shiriti lëvizës "Të fundit" dhe një **Ballinë** me lajmin kryesor (me shkronjën e parë të madhe), kolonat Shqipëri/Kosovë, lojërat e ditës, rrotën e horoskopit dhe rubrikat. Menuja ka pesë faqe: **Ballina, Lajmet, Rozë · VIP, Horoskopi, Lojëra**. Adresa ndryshon për secilën (`#lajmet`, `#lojera/sudoku`…), ndaj çdo faqe mund të ndahet me link.

- **Tema:** ndjek temën e sistemit; butoni ☾/☀ e ndryshon dhe e mban mend.
- **Telefoni:** e gjithë faqja përshtatet deri në 360 px. Në faqet e brendshme koka zvogëlohet që përmbajtja të duket menjëherë.
- **Aksesueshmëria:** navigim me tastierë, etiketa për lexuesit e ekranit, dhe animacionet fiken kur sistemi kërkon "më pak lëvizje".

## Lojërat e ditës

Katër lojëra, të reja çdo ditë dhe **të njëjtat për të gjithë lexuesit**, pa server dhe pa AI. Çdo lojë përdor një gjenerator numrash me farë (data e sotme), ndaj e njëjta datë jep gjithmonë të njëjtën lojë. Progresi ruhet në shfletuesin e lexuesit.

| Loja | Si krijohet |
|---|---|
| **Sudoku** (Lehtë/Mesatare/Vështirë) | Kodi gjeneron një zgjidhje të plotë dhe heq numra duke kontrolluar që enigma të ketë **vetëm një zgjidhje**. Ka kronometër, theksim të konflikteve dhe tastierë. |
| **Fjalëkërkim** | Zgjidhet një temë (qytete, kuzhinë, natyrë, muzikë popullore…) dhe 8 fjalë që fshihen në 8 drejtime. Ç dhe Ë janë shkronja më vete. Zgjedhja bëhet me tërheqje ose me dy prekje. |
| **Gjëegjëza** | 3 në ditë nga lista. Përgjigja pranohet me ose pa ë/ç. |
| **Kuizi AL·KS** | 5 pyetje për historinë, gjeografinë dhe kulturën, me opsione të përziera. |

Për më shumë larmi, shto gjëegjëza, pyetje ose tema te `data/lojera.json`. Për një lojë krejt të re, krijo një skedar te `assets/js/lojera/` dhe shtoje te lista `LOJERAT` në `index.js`.

## Rozë (VIP) dhe Horoskopi

Faqja ka tri skeda: **Lajmet**, **Rozë · VIP** dhe **Horoskopi**. Lajmet rozë dhe horoskopi nuk përzihen me lajmet e zakonshme dhe nuk zënë vendin e tyre në kuotë.

- **Si njihen:** te `config/rubrikat.json → rubrikat_e_vecanta`. Kontrollohen para rubrikave të tjera, por vetëm në titull dhe në kategoritë e RSS-së (p.sh. "Showbiz", "VIP", "Magazina"), që lajmet serioze të mos kalojnë gabimisht te Rozë.
- **Sa shtohen në ditë:** te `config/burimet.json → rregullat → rubrikat_e_vecanta`. Parazgjedhja është deri në 4 lajme rozë (max 2 nga një media) dhe 1 horoskop në ditë.
- **Horoskopi:** titulli është pothuajse i njëjtë çdo ditë, ndaj krahasohet për dublikata vetëm brenda ditës. Përmbledhja është vetëm fjalia hyrëse, dhe lexuesi e gjen horoskopin e plotë te linku.
- **Për të shtuar një rubrikë të re të veçantë** (p.sh. "Receta"): shtoje te të dy skedarët e konfigurimit, te lista `RUBRIKAT_E_VECANTA` në `assets/js/lajmet.js`, dhe si faqe te `FAQET` në `assets/js/main.js` dhe te menuja në `index.html`.

## Horoskopi ditor i detajuar

Faqja **Horoskopi** shfaq çdo ditë parashikimin për të 12 shenjat. Për secilën ka parashikimin e përgjithshëm, dashurinë, punën dhe financat, shëndetin (me vlerësim 1–5 yje), këshillën e ditës, numrin dhe ngjyrën me fat, si dhe shenjën më të përputhshme. Lexuesi mund të zgjedhë ditën dhe një shenjë të vetme.

- **Si gjenerohet (pa AI):** `scripts/gjenero_horoskopin.py` kombinon fjalitë nga `config/horoskopi.json`. Zgjedhja varet nga data, ndaj e njëjta ditë jep gjithmonë të njëjtin horoskop, dhe dy shenja nuk marrin kurrë të njëjtën fjali në të njëjtën ditë.
- **Kur gjenerohet:** në çdo ekzekutim të GitHub Actions, për sot dhe nesër. Një ditë që ekziston nuk rigjenerohet, ndaj horoskopi i publikuar nuk ndryshon gjatë ditës. Ruhen 14 ditët e fundit.
- **Si e pasuron:** shto fjali te listat e `config/horoskopi.json` (secila listë duhet të ketë të paktën 12). Sa më shumë fjali, aq më rrallë përsëriten.
- **Provë:** `python scripts/gjenero_horoskopin.py --prove` e shfaq horoskopin e sotëm pa ruajtur asgjë.
- **Ndershmëria ndaj lexuesit:** faqja shfaq sqarimin "Horoskop argëtues, i gjeneruar automatikisht nga shabllone teksti". Teksti i sqarimit ndryshohet te fusha `shenim`.
- **Horoskopët e mediave:** nëse skripti i lajmeve gjen horoskop në RSS, ai shfaqet poshtë kartave si link, te "Horoskopi në media".
- **Fikja:** `"aktiv": false` te `config/horoskopi.json`.

## Përdorimi i përditshëm

- **Ndalimi i gjenerimit:** te `data/meta.json` vendos `"aktiv": false`.
- **Shtimi i një medie:** shto një rresht te `config/burimet.json`. Adresa e RSS-së është shpesh `https://faqja/feed/` (WordPress) ose `https://faqja/rss`.
- **Përmirësimi i rubrikave:** shto fjalë te `config/rubrikat.json`. Nëse një lajm del në rubrikë të gabuar, shto një fjalë kyçe nga titulli i tij.
- **Rregullat** (max 2 për media, 10 Shqipëri, 6 Kosovë, kuotat e Rozë/Horoskop, gjatësia e përmbledhjes): i gjen te `config/burimet.json → rregullat`.
- **Çaktivizimi i Rozë ose Horoskopit:** vendos `"max_ne_dite": 0` te kuota e saj.

## Kufizime

- **Mediat pa RSS ose që bllokojnë robotët** nuk mund të lexohen. Gjatë testimit u verifikuan RSS-të e BalkanWeb, Euronews Albania, Vizion Plus, RTSH, Reporter.al, ABC News, Kosova.info dhe Bota Sot. Top Channel, Report TV, Koha dhe Telegrafi janë në listë, por me `aktiv: false`: provoji vetë.
- **Ditët e kaluara** nuk mund të plotësohen nëse skripti s'ka punuar atëherë, sepse RSS-ja mban vetëm artikujt e fundit.
- **Rubrikat me fjalë kyçe** gabojnë herë pas here. Shqipëria dhe Kosova përcaktohen sipas vendit të medias.
- **Përmbledhja** varet nga sa tekst jep feed-i. Disa media japin vetëm një fjali, ndaj përmbledhja është po aq e shkurtër.
- **Të drejtat e autorit:** shfaqen vetëm titulli dhe 1–2 fjali, gjithmonë me link te burimi, njësoj si agregatorët e lajmeve. Mos e rrit shumë `max_karaktere_permbledhje`.

## Nëse do pak AI (opsionale)

Gjithçka më sipër funksionon pa AI. Nëse më vonë do përmbledhje të rishkruara, mund të zëvendësosh vetëm funksionin `permbledh()` me një thirrje API dhe pjesa tjetër e sistemit mbetet e njëjtë. Atëherë lajmet duhen shënuar qartë si "përmbledhje me AI".
