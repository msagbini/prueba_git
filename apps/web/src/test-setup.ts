import '@testing-library/jest-dom/vitest';

// jsdom doesn't implement HTMLDialogElement's showModal()/close() (see
// https://github.com/jsdom/jsdom/issues/3294) — Modal.tsx (components/ui)
// relies on both. Polyfilled here, once, for every test rather than per
// test file, since any future <dialog>-based component would hit the
// same gap. Mirrors real browser behavior closely enough for RTL tests:
// showModal()/close() toggle `.open` and close() fires the 'close' event
// dialog elements dispatch on real close.
if (!HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement): void {
    this.open = true;
  };
}
if (!HTMLDialogElement.prototype.close) {
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement): void {
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
}
