// The File must be prepared before the click: async PDF generation can expire user activation.
export async function sharePDF(file, platform, downloadFile) {
  if (!file) throw Error('The PDF is not ready yet.');
  try {
    if (typeof platform.share === 'function' && platform.canShare?.({files: [file]})) {
      await platform.share({files: [file], title: 'J-Town Café Menu'});
      return 'shared';
    }
  } catch (error) {
    if (error.name === 'AbortError') return 'cancelled';
  }
  downloadFile(file);
  return 'downloaded';
}
