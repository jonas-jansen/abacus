---
title: Worum es geht
---

Bei vielen Vorgängen in der Biologie ändert sich eine Größe nicht um einen festen Betrag,
sondern um einen festen **Anteil**: Eine Population wächst jedes Jahr um 10 %, ein
Medikament wird jede Stunde zu einem Fünftel abgebaut. Dann wird in jedem Schritt mit
demselben Faktor $a$ multipliziert:

$$
x_{n+1} = a\,x_n , \qquad \text{also} \qquad x_n = a^n\,x_0 .
$$

Das ist eine **geometrische Folge**. Im Bild zeigt der Pfeil $\cdot a$ den ersten Schritt
von $x_0$ zu $x_1$. Ob die Folge wächst, schrumpft oder hin und her springt, hängt allein
an $a$:

- $a > 1$: sie wächst immer schneller,
- $0 < a < 1$: sie schrumpft gegen $0$,
- $a < 0$: das Vorzeichen wechselt in jedem Schritt.

### Im Applet

Ziehen Sie $x_0$ und den Punkt $x_1$ – damit stellen Sie $a = x_1 / x_0$ ein. Mit dem
Schalter „log“ wird aus jeder geometrischen Folge eine Gerade.
