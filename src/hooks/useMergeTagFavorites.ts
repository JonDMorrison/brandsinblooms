/**
 * Hook for managing recently used and favorite merge tags
 * Persists to localStorage for cross-session persistence
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'merge-tag-favorites';
const MAX_RECENT_TAGS = 5;

interface MergeTagFavoritesData {
  recentTags: string[];
  favoriteTags: string[];
}

const defaultData: MergeTagFavoritesData = {
  recentTags: [],
  favoriteTags: [],
};

function loadFromStorage(): MergeTagFavoritesData {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        recentTags: Array.isArray(parsed.recentTags) ? parsed.recentTags : [],
        favoriteTags: Array.isArray(parsed.favoriteTags) ? parsed.favoriteTags : [],
      };
    }
  } catch (e) {
    console.warn('Failed to load merge tag favorites from storage:', e);
  }
  return defaultData;
}

function saveToStorage(data: MergeTagFavoritesData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('Failed to save merge tag favorites to storage:', e);
  }
}

export function useMergeTagFavorites() {
  const [data, setData] = useState<MergeTagFavoritesData>(defaultData);

  // Load from storage on mount
  useEffect(() => {
    setData(loadFromStorage());
  }, []);

  // Add a tag to recent usage
  const addRecentTag = useCallback((tagKey: string) => {
    setData((prev) => {
      // Remove if already exists, then add to front
      const filtered = prev.recentTags.filter((t) => t !== tagKey);
      const newRecent = [tagKey, ...filtered].slice(0, MAX_RECENT_TAGS);
      const newData = { ...prev, recentTags: newRecent };
      saveToStorage(newData);
      return newData;
    });
  }, []);

  // Toggle a tag as favorite
  const toggleFavorite = useCallback((tagKey: string) => {
    setData((prev) => {
      const isFavorite = prev.favoriteTags.includes(tagKey);
      const newFavorites = isFavorite
        ? prev.favoriteTags.filter((t) => t !== tagKey)
        : [...prev.favoriteTags, tagKey];
      const newData = { ...prev, favoriteTags: newFavorites };
      saveToStorage(newData);
      return newData;
    });
  }, []);

  // Check if a tag is favorited
  const isFavorite = useCallback(
    (tagKey: string) => data.favoriteTags.includes(tagKey),
    [data.favoriteTags]
  );

  // Get combined quick-access tags (favorites first, then recent)
  const getQuickAccessTags = useCallback((): string[] => {
    const combined = [...data.favoriteTags];
    for (const tag of data.recentTags) {
      if (!combined.includes(tag)) {
        combined.push(tag);
      }
    }
    return combined.slice(0, 6); // Max 6 quick access tags
  }, [data.favoriteTags, data.recentTags]);

  return {
    recentTags: data.recentTags,
    favoriteTags: data.favoriteTags,
    addRecentTag,
    toggleFavorite,
    isFavorite,
    getQuickAccessTags,
  };
}
