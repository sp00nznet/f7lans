// Image Search Bot Service
// Allows searching for images with NSFW filtering

const https = require('https');
const http = require('http');

class ImageSearchBotService {
  constructor() {
    this.enabled = false;
    this.apiKey = null;
    this.searchEngineId = null;
    this.safeSearch = 'active'; // 'active' = strict filtering, 'medium', 'off'
    this.activeSearches = new Map(); // channelId -> last search result
    this.messageCallback = null;
  }

  // Set callback for posting messages to channels
  setMessageCallback(callback) {
    this.messageCallback = callback;
  }

  // Configure Google Custom Search API
  configure(apiKey, searchEngineId) {
    this.apiKey = apiKey;
    this.searchEngineId = searchEngineId;
  }

  isConfigured() {
    return !!(this.apiKey && this.searchEngineId);
  }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    return this.enabled;
  }

  isEnabled() {
    return this.enabled;
  }

  getStatus() {
    return {
      enabled: this.enabled,
      configured: this.isConfigured(),
      safeSearch: this.safeSearch,
      activeSearches: this.activeSearches.size
    };
  }

  // Search for images using Google Custom Search API
  async searchImages(query, options = {}) {
    if (!this.isConfigured()) {
      throw new Error('Image search not configured. API key and Search Engine ID required.');
    }

    const {
      maxResults = 5,
      safeSearch = this.safeSearch
    } = options;

    return new Promise((resolve, reject) => {
      const params = new URLSearchParams({
        key: this.apiKey,
        cx: this.searchEngineId,
        q: query,
        searchType: 'image',
        num: Math.min(maxResults, 10),
        safe: safeSearch // 'active' for strict, 'medium', or 'off'
      });

      const url = `https://www.googleapis.com/customsearch/v1?${params}`;

      https.get(url, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);

            if (result.error) {
              reject(new Error(result.error.message || 'Search API error'));
              return;
            }

            const images = (result.items || []).map(item => ({
              title: item.title,
              link: item.link,
              thumbnail: item.image?.thumbnailLink || item.link,
              width: item.image?.width,
              height: item.image?.height,
              contextLink: item.image?.contextLink
            }));

            resolve(images);
          } catch (e) {
            reject(new Error('Failed to parse search results'));
          }
        });
      }).on('error', reject);
    });
  }

  // Perform search and post result to channel
  async search(channelId, query, username) {
    if (!this.enabled) {
      throw new Error('Image search bot is not enabled');
    }

    const results = await this.searchImages(query);

    if (results.length === 0) {
      // Post "no results" message
      if (this.messageCallback) {
        this.messageCallback(channelId, {
          type: 'bot',
          botName: 'ImageSearch',
          content: `No images found for "${query}"`,
          requestedBy: username
        });
      }
      return { found: false, query };
    }

    // Store results for "next" functionality
    this.activeSearches.set(channelId, {
      query,
      results,
      currentIndex: 0,
      requestedBy: username
    });

    const image = results[0];

    // Post the image to the channel
    if (this.messageCallback) {
      this.messageCallback(channelId, {
        type: 'bot',
        botName: 'ImageSearch',
        content: `**${query}**`,
        image: image.link,
        thumbnail: image.thumbnail,
        imageTitle: image.title,
        requestedBy: username,
        hasMore: results.length > 1,
        resultIndex: 1,
        totalResults: results.length
      });
    }

    return {
      found: true,
      image,
      hasMore: results.length > 1,
      total: results.length
    };
  }

  // Get next result for the current search
  async next(channelId, username) {
    const searchState = this.activeSearches.get(channelId);

    if (!searchState) {
      throw new Error('No active search in this channel. Use !image <query> first.');
    }

    searchState.currentIndex++;

    if (searchState.currentIndex >= searchState.results.length) {
      // Wrap around or fetch more
      searchState.currentIndex = 0;
    }

    const image = searchState.results[searchState.currentIndex];

    if (this.messageCallback) {
      this.messageCallback(channelId, {
        type: 'bot',
        botName: 'ImageSearch',
        content: `**${searchState.query}**`,
        image: image.link,
        thumbnail: image.thumbnail,
        imageTitle: image.title,
        requestedBy: username,
        hasMore: true,
        resultIndex: searchState.currentIndex + 1,
        totalResults: searchState.results.length
      });
    }

    return {
      image,
      index: searchState.currentIndex + 1,
      total: searchState.results.length
    };
  }

  // Get random image from current search
  async random(channelId, username) {
    const searchState = this.activeSearches.get(channelId);

    if (!searchState) {
      throw new Error('No active search in this channel. Use !image <query> first.');
    }

    const randomIndex = Math.floor(Math.random() * searchState.results.length);
    searchState.currentIndex = randomIndex;
    const image = searchState.results[randomIndex];

    if (this.messageCallback) {
      this.messageCallback(channelId, {
        type: 'bot',
        botName: 'ImageSearch',
        content: `**${searchState.query}** (random)`,
        image: image.link,
        thumbnail: image.thumbnail,
        imageTitle: image.title,
        requestedBy: username,
        hasMore: true,
        resultIndex: randomIndex + 1,
        totalResults: searchState.results.length
      });
    }

    return {
      image,
      index: randomIndex + 1,
      total: searchState.results.length
    };
  }

  // Clear search for a channel
  clearSearch(channelId) {
    this.activeSearches.delete(channelId);
  }

  // Set safe search level
  setSafeSearch(level) {
    const valid = ['active', 'medium', 'off'];
    if (!valid.includes(level)) {
      throw new Error('Safe search level must be: active, medium, or off');
    }
    this.safeSearch = level;
    return this.safeSearch;
  }

  // Process chat command
  async processCommand(channelId, command, args, username) {
    switch (command.toLowerCase()) {
      case '!image':
      case '!img':
      case '!pic':
        if (!args || args.trim().length === 0) {
          return { error: 'Usage: !image <search query>' };
        }
        return await this.search(channelId, args.trim(), username);

      case '!next':
      case '!nextimage':
        return await this.next(channelId, username);

      case '!random':
      case '!randomimage':
        return await this.random(channelId, username);

      default:
        return null;
    }
  }
}

// Singleton instance
const imageSearchBotService = new ImageSearchBotService();
module.exports = imageSearchBotService;
