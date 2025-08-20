const setCanvasPreview = (
  image, // HTMLImageElement
  canvas, // HTMLCanvasElement
  crop // PixelCrop
) => {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
      throw new Error("No 2d context");
  }

  const pixelRatio = window.devicePixelRatio;
  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  // Set canvas dimensions
  canvas.width = Math.floor(crop.width * scaleX * pixelRatio);
  canvas.height = Math.floor(crop.height * scaleY * pixelRatio);

  // Adjust scaling
  ctx.scale(pixelRatio, pixelRatio);
  ctx.imageSmoothingQuality = "high";
  ctx.save();

  const cropX = crop.x * scaleX;
  const cropY = crop.y * scaleY;

  // Translate to crop coordinates
  ctx.translate(-cropX, -cropY);

  // Draw cropped area
  ctx.drawImage(
      image,
      cropX, // Source X
      cropY, // Source Y
      crop.width * scaleX, // Source width
      crop.height * scaleY, // Source height
      0, // Destination X
      0, // Destination Y
      canvas.width, // Destination width
      canvas.height // Destination height
  );

  ctx.restore();
};

export default setCanvasPreview;
