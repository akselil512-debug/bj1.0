# Design brief — Saloon 21

Huom: briiffi on tehty ilman design-brief.template.md-pohjaa, koska pohjaa ei ollut saatavilla.

## Projekti

**Saloon 21** (työnimi) on villin lännen teemainen selainblackjack. Se opettaa pelaamaan, palkitsee kehittymisestä ja yllättää bonuksilla, pop-upeilla ja bonuspeleillä. Peli pelataan pelirahalla.

## Kohdekäyttäjä

Aloitteleva tai satunnainen pelaaja, joka pelaa puhelimella yhdellä kädellä lyhyitä sessioita. Hän ei välttämättä osaa blackjackin sääntöjä, joten jokaisen ruudun pitää kertoa, mitä seuraavaksi voi tehdä.

Ensisijainen laite: iPhone ja Safari, pystyasento. Peli toimii myös työpöydän selaimessa.

## Tunnelma

Hämärä saluuna, kulunut puu, vihreä pelihuopa, messinki ja kulta. Bonukset saavat olla näyttäviä ja liioiteltuja, mutta peruspelin pöytä pysyy rauhallisena ja luettavana.

## Näkymät

1. **Aloitus ja profiilin valinta** — nimimerkki ja 3-numeroinen koodi, uuden profiilin luonti
2. **Pelipöytä** — jakajan ja pelaajan kortit, panos, saldo, siirtopainikkeet (hit, stand, tuplaus, split, vakuutus, luovutus), neuvo parhaasta siirrosta
3. **Usean käden tila** — rajaton split voi tuottaa monta kättä, joiden pitää mahtua puhelimen ruudulle
4. **Sivupanokset** — panostus ennen jakoa, kertoimet näkyvissä
5. **Opastus** — ohjattu ensimmäinen kierros
6. **Erikoiskäden bonus** — koko ruudun juhlistus, esimerkiksi kaksi mustaa kuningasta
7. **Pop-up-tapahtuma** — satunnainen tapahtuma kierrosten välissä
8. **Bonuspeli** ja **bonuspelin bonuspeli** — oma näkymänsä, josta palataan pöytään
9. **Profiili** — taso, arvonimi, achievementit, omat ennätykset, oikeiden siirtojen osuus
10. **Säännöt ja kertoimet** — kaikki säännöt, bonukset ja todennäköisyydet
11. **Asetukset** — neuvot päälle tai pois, äänet, animaatiot
12. **Siirtokoodi** — koodin luonti ja syöttö

## Saavutettavuus

Taso WCAG 2.1 AA.

- Tekstin kontrasti vähintään 4,5:1
- Kaikki toiminnot näppäimistöllä ja ruudunlukijalla
- Korttien maa ja arvo eivät välity pelkällä värillä
- Animaatiot ja välähdykset vähenevät `prefers-reduced-motion`-asetuksella
- Pop-upit eivät vie kohdistusta kesken pelaajan valinnan

## Design-systeemi

### Värit (OKLCH)

| Rooli | Arvo |
|---|---|
| Tausta, tumma puu | `oklch(0.24 0.04 55)` |
| Pinta, vaaleampi puu | `oklch(0.34 0.05 60)` |
| Pelihuopa | `oklch(0.42 0.09 155)` |
| Korostus, kulta | `oklch(0.80 0.14 85)` |
| Teksti tummalla | `oklch(0.94 0.03 85)` |
| Teksti vaalealla | `oklch(0.20 0.02 60)` |
| Voitto | `oklch(0.75 0.16 145)` |
| Häviö ja varoitus | `oklch(0.58 0.19 27)` |

Kontrastit tarkistetaan lopullisilla arvoilla ennen käyttöönottoa.

### Typografia (clamp)

| Taso | Koko |
|---|---|
| Otsikko 1 | `clamp(1.75rem, 1.3rem + 2.2vw, 2.75rem)` |
| Otsikko 2 | `clamp(1.375rem, 1.15rem + 1.1vw, 1.875rem)` |
| Leipäteksti | `clamp(1rem, 0.95rem + 0.25vw, 1.125rem)` |
| Pieni teksti | `clamp(0.875rem, 0.85rem + 0.15vw, 0.9375rem)` |

Otsikoihin länkkärihenkinen slab-fontti vapaalla lisenssillä (OFL), leipätekstiin järjestelmäfontti. Fontin lisenssi tarkistetaan ja kirjataan tiedostoon `ASSETS-LICENSES.md`.

### Kosketuskohteet

Jokainen painike ja valinta on vähintään 44 × 44 px. Siirtopainikkeet sijoitetaan ruudun alaosaan peukalon ulottuville.

### Liike

- Korttien jako ja pelimerkkien liike alle 400 ms
- Bonusjuhlistukset saavat olla pitkiä, mutta ne voi aina ohittaa napautuksella
- `prefers-reduced-motion: reduce` korvaa liikkeen häivytyksellä

## Seuraava askel

Avaa Claude Design ja liitä tämä briiffi sinne. Pyydä ensin pelipöytä-näkymä puhelimen pystyasennossa.
