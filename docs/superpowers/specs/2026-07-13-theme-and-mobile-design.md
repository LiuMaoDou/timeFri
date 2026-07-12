# Theme and Mobile Design

## Goal

Add a three-mode theme system and improve the existing timer experience on phones without changing the timer or Flomo workflows.

## Theme Behavior

The app provides three choices: light, dark, and system. The selected preference is stored in `localStorage`. When system mode is active, the rendered theme follows `prefers-color-scheme` and updates immediately if the operating-system preference changes.

An inline script in the root layout applies the stored or resolved theme before React hydration. This prevents a light-theme flash when loading in dark mode. Invalid or missing stored values fall back to system mode.

The root `<html>` element exposes both the preference and resolved theme through data attributes. CSS variables remain the single source of truth for colors, surfaces, borders, shadows, form controls, dialogs, and status indicators. The browser `color-scheme` property follows the resolved theme so native controls render consistently.

## Theme Control

A compact segmented control sits in the top bar beside the running status. It contains sun, moon, and monitor icons for light, dark, and system modes. Every option has an accessible label, selected state, and tooltip. Changing the control applies the theme immediately and persists the preference.

The implementation uses a small client-side theme module rather than an external dependency. This keeps the behavior explicit and avoids adding a package for one preference with three values.

## Mobile Layout

The existing desktop composition remains centered and spacious. At phone widths:

- The shell uses smaller safe-area-aware padding and permits vertical scrolling on short screens.
- The clock uses a bounded responsive size that cannot overflow a 320-pixel viewport.
- The status and theme controls remain usable without overlapping the brand.
- Start and end buttons stack vertically, fill the available width, and retain at least a 52-pixel touch target.
- Dialogs become bottom sheets with rounded top corners, safe-area bottom padding, and a constrained scrollable body for small screens and software keyboards.
- Session names wrap or clamp without pushing controls off-screen.
- Footer content stacks and remains secondary to the timer workflow.

The desktop dialog remains centered. No timer, storage, or Flomo payload behavior changes.

## Components and Data Flow

Theme preference parsing and theme resolution live in a focused module that can be tested without rendering React. The page owns the visible theme control and subscribes to system theme changes only while system mode is selected.

The flow is:

1. The pre-hydration script reads the saved preference and resolves the initial theme.
2. CSS renders using root data attributes.
3. React initializes from the root attributes to avoid hydration differences.
4. A user selection updates root attributes and `localStorage`.
5. In system mode, a media-query listener updates only the resolved theme.

Storage access and media-query access are guarded so unavailable browser APIs fall back safely to system mode.

## Testing and Verification

Unit tests cover preference validation, light and dark resolution, and system-mode resolution. Existing Flomo tests must remain green.

Browser verification covers:

- Light, dark, and system selections.
- Live system-theme changes while system mode is selected.
- Preference persistence after reload.
- No console or hydration errors.
- Desktop and phone layouts in idle, running, start-dialog, and end-dialog states.
- A 320-pixel-wide viewport, a common modern phone viewport, and desktop.
- Button stacking, bottom-sheet behavior, focus visibility, text fit, and safe-area spacing.

## Out of Scope

This change does not add theme synchronization across devices, alter timer persistence, redesign the Flomo memo format, or introduce additional application settings.
