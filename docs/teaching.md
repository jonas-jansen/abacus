# Teaching with the applets

## Before the lecture

- **Prepare states as links.** Every change is in the address (`…/applet/sir#sir.beta=0.3`).
  Set up a case, press the link button (it turns green), and paste the link into your notes
  or slides. Opening it shows exactly that state.
- **Use the scenario chips.** Applets carry the settings from the slides as chips
  ("Folie 20", "bessere Behandlung"); one click switches.
- **Decide what students see.** `packages/applets/applets.json`: `"sichtbar": false` hides an
  applet from the overview while its link keeps working ([course.md](course.md#which-applets-are-listed)).

## In the lecture hall

- **Lecture mode** (screen icon in the toolbar): the applet alone, full screen, enlarged as far
  as it fits. `+` and `−` change the size, `0` fits it again, Esc ends.
- **Settings for the projector:** in the top bar, switch off "Hinweise beim Zeigen" and keep
  "Werte am Mauszeiger" off; choose "Hell" if the room is bright.
- **Hand the state to the students:** the QR button shows the current state as a large QR
  code; phones open exactly what is on the screen.
- **Compare two states:** the pin ("vergleichen") holds the current picture faintly; change
  a parameter and both are visible, with the readouts' earlier values beside the new ones.
- **Step by step:** Space plays and pauses; the arrows next to the timeline step one at a
  time; the tempo button cycles ½× to 4×, and dragging it sets any tempo from 0,1× to 10×.
- **Zoom:** ⌘/Strg + mouse wheel (or two fingers), Shift + drag to move, double-click for the
  whole picture. Curves continue past the horizon when you zoom out.

## Course pages

A course page leads through one question with text, exercises and the applet side by side;
predictions can lock the applet until answered ([course.md](course.md)). Answers stay in each
student's browser; `/notizbuch` shows them, with export and import.
