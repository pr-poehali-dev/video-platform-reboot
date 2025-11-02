import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const API_URLS = {
  auth: 'https://functions.poehali.dev/3477a78a-977d-4cda-90bc-5519dceaf38c',
  videos: 'https://functions.poehali.dev/66bc61b3-8db7-4807-9d85-faed71a55c6b'
};

interface Video {
  id: number;
  title: string;
  description: string;
  thumbnail_url: string;
  video_url: string;
  duration: number;
  views_count: number;
  likes_count: number;
  video_type: string;
  channel_name?: string;
  is_verified?: boolean;
}

const Index = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<any>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const { toast } = useToast();

  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    video_url: '',
    thumbnail_url: '',
    duration: 0,
    video_type: 'regular'
  });

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    loadVideos();
  }, []);

  const loadVideos = async () => {
    try {
      const response = await fetch(API_URLS.videos);
      const data = await response.json();
      setVideos(data.videos || []);
    } catch (error) {
      console.error('Failed to load videos:', error);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch(API_URLS.auth, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: authMode,
          ...authForm
        })
      });
      const data = await response.json();
      
      if (response.ok) {
        const userData = { ...data.user, channel_id: data.channel_id, auth_token: data.auth_token };
        setUser(userData);
        localStorage.setItem('user', JSON.stringify(userData));
        setShowAuthDialog(false);
        toast({ title: authMode === 'login' ? 'Вход выполнен!' : 'Регистрация завершена!' });
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка сети', variant: 'destructive' });
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: 'Войдите в аккаунт', variant: 'destructive' });
      return;
    }
    
    try {
      const response = await fetch(API_URLS.videos, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...uploadForm,
          channel_id: user.channel_id
        })
      });
      const data = await response.json();
      
      if (response.ok) {
        toast({ title: 'Видео загружено!' });
        setShowUploadDialog(false);
        loadVideos();
        setUploadForm({ title: '', description: '', video_url: '', thumbnail_url: '', duration: 0, video_type: 'regular' });
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка загрузки', variant: 'destructive' });
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    toast({ title: 'Вы вышли из аккаунта' });
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) return `${(views / 1000000).toFixed(1)}M`;
    if (views >= 1000) return `${(views / 1000).toFixed(1)}K`;
    return views.toString();
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const menuItems = [
    { id: 'home', label: 'Главная', icon: 'Home' },
    { id: 'subscriptions', label: 'Подписки', icon: 'Users' },
    { id: 'library', label: 'Библиотека', icon: 'Library' },
    { id: 'channels', label: 'Каналы', icon: 'Tv' },
    { id: 'trending', label: 'Тренды', icon: 'TrendingUp' },
    ...(user?.is_admin ? [{ id: 'admin', label: 'Админ-панель', icon: 'ShieldCheck' }] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 border-b border-primary/20 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-6">
            <h1 className="text-2xl font-bold neon-glow">NEON<span className="text-secondary">TUBE</span></h1>
            <div className="hidden md:flex items-center gap-1">
              {menuItems.map((item) => (
                <Button
                  key={item.id}
                  variant={currentPage === item.id ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCurrentPage(item.id)}
                  className={currentPage === item.id ? 'neon-border' : ''}
                >
                  <Icon name={item.icon as any} size={16} className="mr-2" />
                  {item.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 max-w-md">
              <Input
                type="search"
                placeholder="Поиск видео..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-card border-primary/30"
              />
              <Button size="icon" variant="ghost" className="neon-border-purple">
                <Icon name="Search" size={20} />
              </Button>
            </div>
            <Button size="icon" variant="ghost" className="md:hidden">
              <Icon name="Menu" size={24} />
            </Button>
            {user ? (
              <>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  className="neon-border-magenta"
                  onClick={() => setShowUploadDialog(true)}
                >
                  <Icon name="Upload" size={20} />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost"
                  onClick={handleLogout}
                >
                  <Icon name="LogOut" size={20} />
                </Button>
              </>
            ) : (
              <Button 
                size="sm"
                className="neon-border"
                onClick={() => setShowAuthDialog(true)}
              >
                <Icon name="User" size={16} className="mr-2" />
                Войти
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="container px-4 py-8">
        {currentPage === 'home' && (
          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h2 className="text-3xl font-bold">Рекомендации</h2>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="neon-border">
                  <Icon name="Filter" size={16} className="mr-2" />
                  Фильтры
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {videos.map((video) => (
                <Card
                  key={video.id}
                  className="group cursor-pointer overflow-hidden border-primary/20 bg-card hover:border-primary/50 transition-all duration-300 hover:scale-105 animate-fade-in"
                  onClick={() => setSelectedVideo(video)}
                >
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      src={video.thumbnail_url}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    />
                    <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs font-bold">
                      {formatDuration(video.duration)}
                    </div>
                    {video.video_type !== 'regular' && (
                      <div className="absolute top-2 left-2">
                        <Badge className="neon-border-magenta bg-secondary/90">
                          {video.video_type === 'series' ? '📺 Сериал' : '🎬 Фильм'}
                        </Badge>
                      </div>
                    )}
                  </div>
                  <div className="p-4 space-y-2">
                    <h3 className="font-semibold line-clamp-2 text-foreground group-hover:text-primary transition-colors">
                      {video.title}
                    </h3>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{video.channel_name}</span>
                      {video.is_verified && (
                        <Icon name="BadgeCheck" size={16} className="text-red-500" />
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Icon name="Eye" size={14} />
                        {formatViews(video.views_count)}
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="ThumbsUp" size={14} />
                        {formatViews(video.likes_count)}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {currentPage === 'admin' && (
          <div className="space-y-6">
            <div className="border border-accent/50 bg-accent/10 p-6 rounded-lg neon-border-purple">
              <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                <Icon name="ShieldCheck" size={28} className="text-accent" />
                Админ-панель
              </h2>
              <p className="text-muted-foreground mb-6">
                Здесь ты можешь управлять всей платформой, верифицировать каналы и устанавливать статусы видео.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Button className="h-24 flex-col gap-2 neon-border-purple">
                  <Icon name="Upload" size={32} />
                  <span>Загрузить видео</span>
                </Button>
                <Button className="h-24 flex-col gap-2 neon-border">
                  <Icon name="BadgeCheck" size={32} />
                  <span>Верифицировать канал</span>
                </Button>
                <Button className="h-24 flex-col gap-2 neon-border-magenta">
                  <Icon name="Film" size={32} />
                  <span>Установить статус</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {['subscriptions', 'library', 'channels', 'trending'].includes(currentPage) && (
          <div className="text-center py-20">
            <Icon name="Zap" size={64} className="mx-auto mb-4 text-primary animate-pulse-glow" />
            <h2 className="text-3xl font-bold mb-2">
              {currentPage === 'subscriptions' && 'Подписки'}
              {currentPage === 'library' && 'Библиотека'}
              {currentPage === 'channels' && 'Каналы'}
              {currentPage === 'trending' && 'Тренды'}
            </h2>
            <p className="text-muted-foreground">Раздел в разработке</p>
          </div>
        )}
      </main>

      <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
        <DialogContent className="max-w-5xl h-[90vh] p-0 border-primary/30 neon-border">
          <div className="flex flex-col h-full">
            <div className="aspect-video bg-black">
              <video
                src={selectedVideo?.video_url}
                controls
                autoPlay
                className="w-full h-full"
              />
            </div>
            <div className="p-6 space-y-4 overflow-auto">
              <DialogHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <DialogTitle className="text-2xl font-bold mb-2">
                      {selectedVideo?.title}
                    </DialogTitle>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Icon name="Eye" size={16} />
                        {selectedVideo && formatViews(selectedVideo.views_count)} просмотров
                      </span>
                      <span className="flex items-center gap-1">
                        <Icon name="ThumbsUp" size={16} />
                        {selectedVideo && formatViews(selectedVideo.likes_count)}
                      </span>
                    </div>
                  </div>
                  {selectedVideo?.video_type !== 'regular' && (
                    <Badge className="neon-border-magenta">
                      {selectedVideo?.video_type === 'series' ? '📺 Сериал' : '🎬 Фильм'}
                    </Badge>
                  )}
                </div>
              </DialogHeader>
              <div className="border-t border-primary/20 pt-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                    <Icon name="Tv" size={20} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{selectedVideo?.channel_name}</span>
                      {selectedVideo?.is_verified && (
                        <Icon name="BadgeCheck" size={16} className="text-red-500" />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">15K подписчиков</span>
                  </div>
                  <Button className="ml-auto neon-border-purple">
                    Подписаться
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {selectedVideo?.description}
                </p>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="border-primary/30 neon-border">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {authMode === 'login' ? 'Вход' : 'Регистрация'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAuth} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username">Имя пользователя</Label>
              <Input
                id="username"
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                required
                className="bg-card border-primary/30"
              />
            </div>
            {authMode === 'register' && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  required
                  className="bg-card border-primary/30"
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                required
                className="bg-card border-primary/30"
              />
            </div>
            <Button type="submit" className="w-full neon-border">
              {authMode === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
            >
              {authMode === 'login' ? 'Нет аккаунта? Зарегистрируйтесь' : 'Уже есть аккаунт? Войдите'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="border-primary/30 neon-border max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">Загрузить видео</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Название</Label>
              <Input
                id="title"
                value={uploadForm.title}
                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                required
                className="bg-card border-primary/30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                className="bg-card border-primary/30 min-h-[100px]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="video_url">URL видео</Label>
                <Input
                  id="video_url"
                  value={uploadForm.video_url}
                  onChange={(e) => setUploadForm({ ...uploadForm, video_url: e.target.value })}
                  required
                  placeholder="https://example.com/video.mp4"
                  className="bg-card border-primary/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="thumbnail_url">URL превью</Label>
                <Input
                  id="thumbnail_url"
                  value={uploadForm.thumbnail_url}
                  onChange={(e) => setUploadForm({ ...uploadForm, thumbnail_url: e.target.value })}
                  required
                  placeholder="https://example.com/thumb.jpg"
                  className="bg-card border-primary/30"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Длительность (секунды)</Label>
                <Input
                  id="duration"
                  type="number"
                  value={uploadForm.duration}
                  onChange={(e) => setUploadForm({ ...uploadForm, duration: parseInt(e.target.value) })}
                  required
                  className="bg-card border-primary/30"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="video_type">Тип видео</Label>
                <Select 
                  value={uploadForm.video_type} 
                  onValueChange={(value) => setUploadForm({ ...uploadForm, video_type: value })}
                >
                  <SelectTrigger className="bg-card border-primary/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="regular">Обычное</SelectItem>
                    <SelectItem value="series">Сериал</SelectItem>
                    <SelectItem value="movie">Фильм</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button type="submit" className="w-full neon-border">
              <Icon name="Upload" size={16} className="mr-2" />
              Загрузить видео
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;