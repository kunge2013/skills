import { Router } from 'express';
import { ImageService, ImageGenerationRequest, GeneratedImage } from '../services/image/service';
import { v4 as uuidv4 } from 'uuid';

export function registerImageRoutes(router: Router, imageService: ImageService) {
  // POST /images/generate/text2image
  router.post('/images/generate/text2image', async (req, res) => {
    try {
      // In production, this would call the actual image generation API
      // For now, return a placeholder
      const image: GeneratedImage = {
        id: uuidv4(),
        url: '/placeholder-image.png',
        prompt: req.body.prompt,
        modelKey: req.body.modelKey,
        width: req.body.width || 1024,
        height: req.body.height || 1024,
        createdAt: Date.now(),
      };
      await imageService.saveImage(image);
      res.json({ success: true, data: image });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /images/generate/image2image
  router.post('/images/generate/image2image', async (req, res) => {
    try {
      const image: GeneratedImage = {
        id: uuidv4(),
        url: '/placeholder-image.png',
        prompt: req.body.prompt,
        modelKey: req.body.modelKey,
        width: req.body.width || 1024,
        height: req.body.height || 1024,
        createdAt: Date.now(),
      };
      await imageService.saveImage(image);
      res.json({ success: true, data: image });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /images/generate/multi-image
  router.post('/images/generate/multi-image', async (req, res) => {
    try {
      const count = req.body.count || 4;
      const images: GeneratedImage[] = [];
      for (let i = 0; i < count; i++) {
        const image: GeneratedImage = {
          id: uuidv4(),
          url: '/placeholder-image.png',
          prompt: req.body.prompt,
          modelKey: req.body.modelKey,
          width: req.body.width || 1024,
          height: req.body.height || 1024,
          createdAt: Date.now(),
        };
        await imageService.saveImage(image);
        images.push(image);
      }
      res.json({ success: true, data: images });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /images/test-connection
  router.post('/images/test-connection', async (req, res) => {
    // In production, test actual image model connection
    res.json({ success: true });
  });
}
