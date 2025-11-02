CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    avatar_url TEXT,
    is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS channels (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    avatar_url TEXT,
    banner_url TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    subscribers_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    channel_id INTEGER REFERENCES channels(id),
    title VARCHAR(300) NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    video_url TEXT NOT NULL,
    duration INTEGER,
    views_count INTEGER DEFAULT 0,
    likes_count INTEGER DEFAULT 0,
    video_type VARCHAR(50) DEFAULT 'regular',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    channel_id INTEGER REFERENCES channels(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, channel_id)
);

CREATE TABLE IF NOT EXISTS watch_history (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    video_id INTEGER REFERENCES videos(id),
    watched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_videos_channel ON videos(channel_id);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_channel ON subscriptions(channel_id);

INSERT INTO users (username, email, is_admin, avatar_url) VALUES 
('admin', 'admin@videoplatform.dev', TRUE, 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin')
ON CONFLICT (username) DO NOTHING;

INSERT INTO channels (user_id, name, description, is_verified, subscribers_count) 
SELECT 1, 'Канал Администратора', 'Официальный канал платформы', TRUE, 15000
WHERE NOT EXISTS (SELECT 1 FROM channels WHERE user_id = 1);

INSERT INTO videos (channel_id, title, description, thumbnail_url, video_url, duration, views_count, likes_count, video_type) 
SELECT 1, 'Добро пожаловать на платформу', 'Первое видео на нашей платформе! Киберпанк стиль и современные технологии.', 'https://images.unsplash.com/photo-1618609378039-b572f64c5b42?w=800', 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4', 60, 12500, 890, 'regular'
WHERE NOT EXISTS (SELECT 1 FROM videos WHERE title = 'Добро пожаловать на платформу');

INSERT INTO videos (channel_id, title, description, thumbnail_url, video_url, duration, views_count, likes_count, video_type) 
SELECT 1, 'Гайд по функциям платформы', 'Полное руководство по использованию всех возможностей видеохостинга.', 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800', 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4', 180, 8900, 654, 'regular'
WHERE NOT EXISTS (SELECT 1 FROM videos WHERE title = 'Гайд по функциям платформы');

INSERT INTO videos (channel_id, title, description, thumbnail_url, video_url, duration, views_count, likes_count, video_type) 
SELECT 1, 'Киберпанк 2077: Полное прохождение', 'Начинаем серию прохождения самой ожидаемой игры!', 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800', 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4', 240, 25400, 1520, 'series'
WHERE NOT EXISTS (SELECT 1 FROM videos WHERE title = 'Киберпанк 2077: Полное прохождение');

INSERT INTO videos (channel_id, title, description, thumbnail_url, video_url, duration, views_count, likes_count, video_type) 
SELECT 1, 'Неоновый город: Документальный фильм', 'Погружение в эстетику киберпанка через призму современных мегаполисов.', 'https://images.unsplash.com/photo-1514539079130-25950c84af65?w=800', 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_1mb.mp4', 3600, 45600, 3200, 'movie'
WHERE NOT EXISTS (SELECT 1 FROM videos WHERE title = 'Неоновый город: Документальный фильм');