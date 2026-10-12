---
title: Worum es geht
---

Jeder Herzschlag beginnt in einzelnen Muskelzellen mit einem **Aktionspotential**. Ein kurzer
Reiz öffnet Natriumkanäle, und die Spannung $V$ über der Zellmembran springt von etwa
−85 mV auf über +40 mV. Danach hält ein Kalziumstrom die Zelle einige Zehntelsekunden lang
erregt (das **Plateau**). Das einströmende Kalzium lässt die Zelle sich zusammenziehen.
Kaliumströme bringen sie schließlich zur Ruhe zurück.

Luo und Rudy (1991) haben das für Zellen der Herzkammer als System von acht
Differentialgleichungen beschrieben:

$$
C_m\,V' = -\bigl(I_{Na} + I_{si} + I_K + I_{K1} + I_{Kp} + I_b\bigr) + I_{stim}(t).
$$

### Die Ströme

| Strom | Ionen | Rolle |
|---|---|---|
| $I_{Na} = g_{Na}\,m^3 h\,j\,(V - E_{Na})$ | Natrium | schneller Aufstrich |
| $I_{si} = g_{si}\,d\,f\,(V - E_{si})$ | Kalzium | Plateau, Kontraktion |
| $I_K$, $I_{K1}$, $I_{Kp}$ | Kalium | Rückkehr zur Ruhe |
| $I_b$ | – | kleiner Hintergrundstrom |

Die Tore $m, h, j, d, f, X$ öffnen und schließen sich je nach Spannung. Für jedes Tor $x$ gilt
$x' = \alpha_x(V)\,(1 - x) - \beta_x(V)\,x$. Das Kalzium in der Zelle steigt mit dem
Kalziumstrom und wird wieder abgepumpt:

$$
[\mathrm{Ca}]_i' = -10^{-4}\,I_{si} + 0.07\,\bigl(10^{-4} - [\mathrm{Ca}]_i\bigr).
$$

### Was die Szenarien ändern

Medikamente und Krankheiten greifen an den Kanälen an. Im Modell ändern die Szenarien die
Leitfähigkeiten $g_{Na}$, $g_{si}$ und $g_K$, das Kalium außerhalb der Zelle $[K]_o$ und den
Takt der Reize.

C. H. Luo, Y. Rudy: A model of the ventricular cardiac action potential. *Circulation
Research* 68 (1991), 1501–1526.
