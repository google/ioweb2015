// Use a cache for the Picasa API response.
shed.router.get('(.+)', shed.cacheFirst, {origin: /https?:\/\/picasaweb.google.com/});
// Use a cache for the actual image files as well.
shed.router.get('(.+)', shed.cacheFirst, {origin: /https?:\/\/lh\d*.googleusercontent.com/});
