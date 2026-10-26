import { RefObject, useEffect, useRef } from "react";

export interface UseDialogOptions {
  isOpen: boolean;
  onClose?: () => void;
  containerRef: RefObject<HTMLElement | null>;
}

interface DialogStackEntry {
  id: symbol;
}

const dialogStack: DialogStackEntry[] = [];

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "iframe",
  "[tabindex]:not([tabindex='-1'])",
].join(", ");

function isElementVisible(el: HTMLElement, container: HTMLElement): boolean {
  let current: HTMLElement | null = el;
  while (current && current !== container) {
    if (
      current.hidden ||
      current.getAttribute("aria-hidden") === "true" ||
      current.hasAttribute("inert")
    ) {
      return false;
    }
    const style = window.getComputedStyle(current);
    if (
      style.display === "none" ||
      style.visibility === "hidden" ||
      style.pointerEvents === "none"
    ) {
      return false;
    }
    current = current.parentElement;
  }
  return true;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const candidates = Array.from(
    container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
  );
  return candidates.filter((el) => {
    if (el.hasAttribute("disabled") || el.tabIndex < 0) {
      return false;
    }
    return isElementVisible(el, container);
  });
}

export function useDialog({
  isOpen,
  onClose,
  containerRef,
}: UseDialogOptions): void {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || typeof document === "undefined") {
      return;
    }

    const entry: DialogStackEntry = { id: Symbol("dialog") };
    dialogStack.push(entry);

    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    const container = containerRef.current;
    if (container) {
      if (!container.hasAttribute("tabindex")) {
        container.setAttribute("tabindex", "-1");
      }
      container.style.outline = "none";

      const autoFocusEl =
        container.querySelector<HTMLElement>("[data-autofocus]");
      if (
        autoFocusEl &&
        !autoFocusEl.hasAttribute("disabled") &&
        isElementVisible(autoFocusEl, container)
      ) {
        autoFocusEl.focus({ preventScroll: true });
      } else {
        container.focus({ preventScroll: true });
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (dialogStack[dialogStack.length - 1] !== entry) {
        return;
      }

      if (event.key === "Escape") {
        if (onCloseRef.current) {
          event.preventDefault();
          onCloseRef.current();
        }
        return;
      }

      if (event.key === "Tab") {
        const currentContainer = containerRef.current;
        if (!currentContainer) {
          return;
        }

        const focusables = getFocusableElements(currentContainer);
        if (focusables.length === 0) {
          event.preventDefault();
          currentContainer.focus({ preventScroll: true });
          return;
        }

        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        const active =
          document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;

        if (event.shiftKey) {
          if (
            !active ||
            !currentContainer.contains(active) ||
            active === currentContainer ||
            active === first
          ) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (
            !active ||
            !currentContainer.contains(active) ||
            active === currentContainer ||
            active === last
          ) {
            event.preventDefault();
            first.focus();
          }
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);

      const index = dialogStack.indexOf(entry);
      if (index !== -1) {
        dialogStack.splice(index, 1);
      }

      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [isOpen, containerRef]);
}
