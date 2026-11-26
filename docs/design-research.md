# Design and implementation references

Downloaded, reviewed, and applied two instruction-only design skills:

- `.agents/skills/frontend-design/SKILL.md`: https://github.com/anthropics/skills/tree/main/skills/frontend-design. Use one characteristic visual anchor, subject-specific typography, and purposeful motion.
- `.agents/skills/windows-ui-guidelines/SKILL.md`: https://github.com/kleon6436/GitHubCopilotSettings/tree/main/skills/windows-ui-guidelines. Use familiar desktop menus, stable left navigation, keyboard focus, accessible controls, and explicit confirmations.
- Microsoft dialog guidance: https://learn.microsoft.com/windows/apps/design/controls/dialogs-and-flyouts/dialogs. The safe action receives focus; destructive operations name their effect and target.

## Workbench design

Use a midnight instrument rail (#101a2c), a cool paper workspace (#f6f8fb), white control surfaces, signal blue (#2874ee), and teal (#46c5b3). Use a humanist system sans for controls and a compact monospace for ports, device names, and console output. The single memorable visual is an illustrated, three-stage hardware signal path. The form beneath it mirrors the two physical setup tasks. Avoid marketing content, simulated live measurements, and ornamental telemetry.

The desktop command bar stays above content; the navigation and safety status stay anchored. On small screens the rail becomes a drawer. A short entrance, restrained connection activity, and modal transitions communicate changes, with reduced-motion support.

## Technical sources

- Ho-Ro/ArdPicProg: https://github.com/Ho-Ro/ArdPicProg/tree/420aacef1990a1d0ce348a468ff44a73dcb554e3. Source of the programmer sketch, device geometry, and host protocol.
- https://rweather.github.io/ardpicprog/pic14_zif_circuit.html: original ZIF design and electrical inspection guidance. This is NOT the matching schematic for Ho-Ro firmware.
- https://github.com/Ho-Ro/QPICkit: reference for separating device profiles, files, and programmer backends. PICkit support is not inherited by an Arduino programmer.
- https://rweather.github.io/ardpicprog/host_program.html: erase, calibration preservation, and verify behavior. The pinned fork, not this older page, determines baud rate and pinout.
- https://arduino.github.io/arduino-cli/1.3/commands/arduino-cli_upload/: compile first, upload using the selected FQBN and port, and request upload verification.
- https://www.electronjs.org/docs/latest/tutorial/process-model: isolated preload with a narrow hardware API, without Node access in the renderer.