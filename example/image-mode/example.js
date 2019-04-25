const ImageViewer = window.ivViewerEx.ImageViewer;

Array.from(document.querySelectorAll('.pannable-image')).forEach((elem) => {
  new ImageViewer(elem);
});
