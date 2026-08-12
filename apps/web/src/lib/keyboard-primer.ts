/**
 * Raising the iOS keyboard on a surface that does not exist yet.
 *
 * iOS opens the software keyboard only for a `focus()` that runs inside the
 * user-gesture task. A sheet mounts a React commit and a transition later, so
 * the real field can never be focused in time — and Base UI makes it worse on
 * purpose: its default initial-focus resolver returns the popup element itself
 * when the interaction was a touch, specifically to suppress the keyboard.
 *
 * So focus a throwaway field *inside* the tap, which brings the keyboard up
 * immediately, and hand focus to the real one once it mounts. Moving focus
 * between two text inputs while the keyboard is already up needs no gesture, so
 * it stays up.
 *
 * This is not perfectly reliable and should not be presented as such. Known
 * limits:
 *
 * - Any `await` between the tap and `primeKeyboard()` loses the gesture, so it
 *   must be the first statement in the handler.
 * - Do not prime a form whose first control is a select or a toggle — it raises
 *   a text keyboard over something that cannot receive text.
 * - iOS still drops the keyboard on a small fraction of modal mounts. The field
 *   is focused either way; the user taps once.
 */

/** How long a primed keyboard waits for a sheet that may never open. */
const WATCHDOG_MS = 1500;

let primer: HTMLInputElement | null = null;
let watchdog: ReturnType<typeof setTimeout> | undefined;

function isTouchIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS reports as "MacIntel"; the touch-point count is what separates it
  // from a desktop Mac.
  return (
    /iP(hone|ad|od)/.test(navigator.platform) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

/**
 * iOS scrolls the layout viewport to reveal a focus target even when asked not
 * to — reliably so for an element inside a sheet mid-transition. Parking the
 * element far off-screen for the duration of the call leaves nothing to scroll
 * to, then puts it straight back before the next paint.
 */
function focusWithoutPageScroll(target: HTMLElement): void {
  const { opacity, transform, transition } = target.style;
  target.style.transition = "none";
  target.style.opacity = "0";
  target.style.transform = "translateY(-2000px)";
  try {
    target.focus({ preventScroll: true });
  } finally {
    target.style.opacity = opacity;
    target.style.transform = transform;
    target.style.transition = transition;
  }
}

function ensurePrimer(): HTMLInputElement {
  if (primer?.isConnected) return primer;

  const input = document.createElement("input");
  input.type = "text";
  // Not display:none, visibility:hidden or readonly — iOS refuses to open the
  // keyboard for any of them. It has to be a real, rendered, editable field.
  input.setAttribute("aria-hidden", "true");
  input.tabIndex = -1;
  input.style.cssText =
    "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;" +
    // 16px, or iOS zooms the page on focus before we hand off.
    "font-size:16px;border:0;padding:0;pointer-events:none;z-index:-1;";
  document.body.appendChild(input);
  primer = input;
  return input;
}

/**
 * Call synchronously — first statement — from the tap handler that opens a
 * form. A no-op everywhere except iOS, which is the only platform that needs it.
 */
export function primeKeyboard(): void {
  if (!isTouchIOS()) return;

  focusWithoutPageScroll(ensurePrimer());

  // If the sheet never opens — a failed guard, a cancelled navigation — dismiss
  // the keyboard rather than leave it standing over the list.
  clearTimeout(watchdog);
  watchdog = setTimeout(() => {
    if (document.activeElement === primer) primer?.blur();
  }, WATCHDOG_MS);
}

/**
 * Call once the real field is mounted. Keeps the keyboard up and moves the
 * caret; safe to call on every platform, since it is just a focus.
 */
export function handOffKeyboard(
  target: HTMLInputElement | HTMLTextAreaElement,
  selection: "select" | "end" | "none" = "none",
): void {
  clearTimeout(watchdog);
  focusWithoutPageScroll(target);

  if (selection === "none") return;

  try {
    if (selection === "select") target.select();
    else target.setSelectionRange(target.value.length, target.value.length);
  } catch {
    // setSelectionRange throws InvalidStateError on type="number"/"email"/"date".
    // Focus already landed; the caret position is a nicety.
  }
}
