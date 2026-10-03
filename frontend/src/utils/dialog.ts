import type { DialogProps } from '@mui/material';

/** Wraps a dialog's close handler so clicking the backdrop doesn't close it — only an
 * explicit Cancel/Close button (or Escape) should. Keeps every dialog in the app consistent. */
export function ignoreBackdropClick(onClose: () => void): NonNullable<DialogProps['onClose']> {
  return (_event, reason) => {
    if (reason === 'backdropClick') return;
    onClose();
  };
}
