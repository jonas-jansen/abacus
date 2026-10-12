---
title: Worum es geht
---

Getrunkener Alkohol gelangt nicht sofort ins Blut. Er sammelt sich zuerst im **Magen**, wird
von dort in den **Darm** weitergegeben, dort aufgenommen und erst dann im **Blut** verteilt.
Die Leber baut ihn ab – aber nur bis zu einer Höchstgeschwindigkeit. Für die Konzentrationen
$C_S$ (Magen), $C_G$ (Darm) und $C_C$ (Blut) in g/L gilt das Modell von Pieters et al.:

$$
\begin{aligned}
C_S' &= -k_1\,\frac{C_S}{1 + a\,C_S^2}, \\
C_G' &= k_1\,\frac{C_S}{1 + a\,C_S^2} - k_2\,C_G, \\
C_C' &= k_2\,C_G - \frac{V_{\max}\,C_C}{K_m + C_C}.
\end{aligned}
$$

### Was die Terme bedeuten

- Der Magen leert sich mit der Rate $k_1$; der Faktor $1/(1 + a\,C_S^2)$ bremst das bei
  viel Alkohol im Magen.
- Aus dem Darm geht der Alkohol mit der Rate $k_2$ ins Blut.
- Der Abbau folgt der **Michaelis-Menten-Kinetik**: Bei wenig Alkohol wächst er mit $C_C$,
  bei viel erreicht er höchstens $V_{\max}$.

### Die Werte

| Parameter | Mann | Frau |
|---|---|---|
| $V_{\max}$ (g L⁻¹ h⁻¹) | 0.470 | 0.480 |
| $K_m$ (g/L) | 0.380 | 0.405 |
| $a$ (L²/g²) | 0.42 | 0.75 |
| $k_1$ (h⁻¹) | 5.55 | 4.96 |
| $k_2$ (h⁻¹) | 7.05 | 4.96 |

Eine Dosis $D_0$ (Gramm Alkohol pro Kilogramm Körpergewicht) beginnt im Magen mit
$C_S(0) = D_0 / r$. Dabei ist $r$ der Verteilungsfaktor nach Widmark: 0.7 L/kg bei Männern,
0.6 L/kg bei Frauen.

Die Werte stammen aus Pieters et al. (1990), *Alcohol & Alcoholism* 25, 17–24; die Tabelle
folgt Heck, *eJMT* 1(3). Gemessen wurde nach einer Nacht ohne Essen: Ein voller Magen
verlangsamt die Aufnahme deutlich.
