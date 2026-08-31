// ---------
// Toast Notification
// ---------
let toastFn = null;
export function showToast(msg, type="success") { toastFn?.(msg, type); }

export function _setToastFn(fn) { toastFn = fn; }
