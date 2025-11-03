-- Add missing columns and tables for full functionality

-- Add new columns to channels table
ALTER TABLE channels ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE channels ADD COLUMN IF NOT EXISTS banner_url TEXT;

-- Create video_likes table
CREATE TABLE IF NOT EXISTS video_likes (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    video_id INTEGER NOT NULL REFERENCES videos(id),
    is_like BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, video_id)
);

-- Create video_views table
CREATE TABLE IF NOT EXISTS video_views (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    video_id INTEGER NOT NULL REFERENCES videos(id),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add likes and dislikes columns to videos
ALTER TABLE videos ADD COLUMN IF NOT EXISTS likes_count INTEGER DEFAULT 0;
ALTER TABLE videos ADD COLUMN IF NOT EXISTS dislikes_count INTEGER DEFAULT 0;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_videos_views ON videos(views_count DESC);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_likes_user ON video_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_video_likes_video ON video_likes(video_id);
CREATE INDEX IF NOT EXISTS idx_video_views_video ON video_views(video_id);
CREATE INDEX IF NOT EXISTS idx_video_views_user ON video_views(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_channel ON subscriptions(channel_id);