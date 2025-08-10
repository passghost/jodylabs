// pixel-manager.js - Manages pixel placement and rendering
export class PixelManager {
    constructor(supabase) {
        this.supabase = supabase;
        this.placedPixels = new Map(); // Map of "x,y" to pixel data
        this.pixelMode = null; // Current pixel placement mode
        this.pixelColors = {
            'red': '#FF0000',
            'blue': '#0000FF',
            'green': '#00FF00',
            'yellow': '#FFFF00',
            'purple': '#800080'
        };

        this.loadPlacedPixels();
        this.setupRealtimeSubscription();
    }

    async loadPlacedPixels() {
        if (!this.supabase) return;

        try {
            const { data: pixels, error } = await this.supabase
                .from('placed_pixels')
                .select('*')
                .order('placed_at', { ascending: true });

            if (error) {
                console.error('Error loading placed pixels:', error);
                return;
            }

            this.placedPixels.clear();
            pixels.forEach(pixel => {
                const key = `${pixel.x},${pixel.y}`;
                this.placedPixels.set(key, {
                    x: pixel.x,
                    y: pixel.y,
                    color: pixel.color,
                    playerId: pixel.player_id,
                    placedAt: pixel.placed_at
                });
            });

        } catch (error) {
            console.error('Failed to load placed pixels:', error);
        }
    }

    setupRealtimeSubscription() {
        if (!this.supabase) return;

        this.pixelChannel = this.supabase
            .channel('placed_pixels_changes')
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'placed_pixels' },
                (payload) => this.handlePixelInsert(payload.new)
            )
            .on('postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'placed_pixels' },
                (payload) => this.handlePixelDelete(payload.old)
            )
            .subscribe();
    }

    handlePixelInsert(pixel) {
        const key = `${pixel.x},${pixel.y}`;
        this.placedPixels.set(key, {
            x: pixel.x,
            y: pixel.y,
            color: pixel.color,
            playerId: pixel.player_id,
            placedAt: pixel.placed_at
        });
    }

    handlePixelDelete(pixel) {
        const key = `${pixel.x},${pixel.y}`;
        this.placedPixels.delete(key);
    }

    activatePixelMode(color) {
        this.pixelMode = color;
    }

    deactivatePixelMode() {
        this.pixelMode = null;
    }

    isPixelModeActive() {
        return this.pixelMode !== null;
    }

    getCurrentPixelColor() {
        return this.pixelMode;
    }

    async placePixel(x, y, playerId) {
        if (!this.pixelMode || !this.supabase) return false;

        // Round coordinates to ensure they're integers
        x = Math.round(x);
        y = Math.round(y);

        // Check if pixel already exists at this location
        const key = `${x},${y}`;
        if (this.placedPixels.has(key)) {
            return { success: false, message: 'A pixel already exists at this location!' };
        }

        try {
            const { data, error } = await this.supabase
                .from('placed_pixels')
                .insert([{
                    player_id: playerId,
                    x: x,
                    y: y,
                    color: this.pixelMode
                }])
                .select()
                .single();

            if (error) {
                console.error('Error placing pixel:', error);
                return { success: false, message: 'Failed to place pixel: ' + error.message };
            }

            // Add to local cache
            this.placedPixels.set(key, {
                x: x,
                y: y,
                color: this.pixelMode,
                playerId: playerId,
                placedAt: data.placed_at
            });

            return { success: true, message: `${this.pixelMode.charAt(0).toUpperCase() + this.pixelMode.slice(1)} pixel placed!` };

        } catch (error) {
            console.error('Failed to place pixel:', error);
            return { success: false, message: 'Failed to place pixel: ' + error.message };
        }
    }

    getPixelsInArea(minX, minY, maxX, maxY) {
        const pixelsInArea = [];

        for (const [key, pixel] of this.placedPixels.entries()) {
            if (pixel.x >= minX && pixel.x <= maxX && pixel.y >= minY && pixel.y <= maxY) {
                pixelsInArea.push(pixel);
            }
        }

        return pixelsInArea;
    }

    getAllPixels() {
        return Array.from(this.placedPixels.values());
    }

    getPixelColor(colorName) {
        return this.pixelColors[colorName] || '#FFFFFF';
    }

    // Pixels are now permanent - no cleanup needed
    // This method is kept for compatibility but does nothing
    cleanupExpiredPixels() {
        // Pixels are permanent now - no cleanup needed
    }

    // Get pixel statistics
    getPixelStats() {
        const stats = {
            total: this.placedPixels.size,
            byColor: {}
        };

        for (const pixel of this.placedPixels.values()) {
            stats.byColor[pixel.color] = (stats.byColor[pixel.color] || 0) + 1;
        }

        return stats;
    }

    destroy() {
        if (this.pixelChannel) {
            this.pixelChannel.unsubscribe();
        }
    }
}
