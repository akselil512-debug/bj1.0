# Perusstrategian lähde

Pelin neuvot (`src/game/strategy.ts`) noudattavat blackjackin perusstrategiaa näille säännöille:

- 4–8 pakkaa (pelissä 6)
- jakaja jää kaikkiin 17:ään (S17)
- tuplaus sallittu jaon jälkeen (DAS)
- myöhäinen luovutus sallittu

## Lähde ja tarkistuksen tila

Lähde: Wizard of Odds, 4-Deck to 8-Deck Blackjack Strategy, https://wizardofodds.com/games/blackjack/strategy/4-decks/ (luettu 2026-11-22), taulukko "dealer stands on soft 17".

**Tila: tarkistettu.** Testi `tests/strategy-chart.test.ts` vertaa pelin neuvoa lähteen taulukkoon jokaisessa solussa: kovat summat 5–19, pehmeät kädet A2–A9 ja parit 2–A jakajan jokaista korttia vastaan. Kaikki 330 solua täsmäävät.

## Tunnetut poikkeamat pelin säännöistä

Pelissä jaetut ässät saavat ottaa lisäkortteja ja parin saa jakaa rajattomasti. Julkaistut taulukot olettavat yleensä, että jaetut ässät saavat yhden kortin. Tämä ei muuta taulukon suosituksia (ässät jaetaan aina), mutta parantaa pelaajan odotusarvoa hieman.

## Vakuutus

Vakuutus on perusstrategiassa aina tappiollinen, joten peli neuvoo jättämään sen ottamatta.
