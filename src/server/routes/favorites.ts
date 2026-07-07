import { Router } from 'express';
import { FavoriteManager } from '../services/favorite/manager';

export function registerFavoriteRoutes(router: Router, favoriteManager: FavoriteManager) {
  // GET /favorites
  router.get('/favorites', async (_req, res) => {
    try {
      const favorites = await favoriteManager.getFavorites();
      res.json({ success: true, data: favorites });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /favorites
  router.post('/favorites', async (req, res) => {
    try {
      await favoriteManager.addFavorite(req.body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // GET /favorites/:id
  router.get('/favorites/:id', async (req, res) => {
    try {
      const favorite = await favoriteManager.getFavorite(req.params.id);
      if (!favorite) {
        res.status(404).json({ success: false, error: { message: 'Favorite not found' } });
        return;
      }
      res.json({ success: true, data: favorite });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // PUT /favorites/:id
  router.put('/favorites/:id', async (req, res) => {
    try {
      await favoriteManager.updateFavorite(req.params.id, req.body);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // DELETE /favorites/:id
  router.delete('/favorites/:id', async (req, res) => {
    try {
      await favoriteManager.deleteFavorite(req.params.id);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });

  // GET /favorites/categories
  router.get('/favorites/categories', async (_req, res) => {
    try {
      const categories = await favoriteManager.getCategories();
      res.json({ success: true, data: categories });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /favorites/search
  router.post('/favorites/search', async (req, res) => {
    try {
      const { query } = req.body;
      const favorites = await favoriteManager.searchFavorites(query || '');
      res.json({ success: true, data: favorites });
    } catch (error: any) {
      res.status(500).json({ success: false, error: { message: error.message } });
    }
  });

  // POST /favorites/import
  router.post('/favorites/import', async (req, res) => {
    try {
      const { data } = req.body;
      if (!data) {
        res.status(400).json({ success: false, error: { message: 'data is required' } });
        return;
      }
      await favoriteManager.importFavorites(data);
      res.json({ success: true });
    } catch (error: any) {
      res.status(400).json({ success: false, error: { message: error.message } });
    }
  });
}
