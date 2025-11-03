import { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import VideoPlayer from '@/components/VideoPlayer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

const API_URLS = {
  auth: 'https://functions.poehali.dev/3477a78a-977d-4cda-90bc-5519dceaf38c',
  videos: 'https://functions.poehali.dev/66bc61b3-8db7-4807-9d85-faed71a55c6b',
  upload: 'https://functions.poehali.dev/464e8d08-84e3-4dda-9946-ab2245beb5b2',
  actions: 'https://functions.poehali.dev/edc1a64e-22f5-4af8-9d25-9eb74708783e',
  channel: 'https://functions.poehali.dev/7fe1f93a-f70c-4770-86c0-b926b9e2151c'
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
  dislikes_count?: number;
  video_type: string;
  channel_name?: string;
  channel_id?: number;
  is_verified?: boolean;
  user_liked?: boolean;
  user_disliked?: boolean;
  user_subscribed?: boolean;
}

const Index = () => {
  const [currentPage, setCurrentPage] = useState('home');
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [user, setUser] = useState<any>(null);
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [showChannelDialog, setShowChannelDialog] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const { toast } = useToast();

  const [authForm, setAuthForm] = useState({ username: '', email: '', password: '' });
  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    duration: 0,
    video_type: 'regular'
  });
  
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [channelForm, setChannelForm] = useState({
    name: '',
    description: '',
    avatar_url: ''
  });
  
  const videoInputRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
    loadVideos();
  }, []);

  useEffect(() => {
    if (user) {
      loadChannelInfo();
    }
  }, [user]);

  const loadVideos = async () => {
    try {
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (user?.id) {
        headers['X-User-Id'] = user.id.toString();
      }
      
      const response = await fetch(API_URLS.videos, { headers });
      const data = await response.json();
      setVideos(data.videos || []);
    } catch (error) {
      console.error('Failed to load videos:', error);
    }
  };

  const loadChannelInfo = async () => {
    if (!user?.channel_id) return;
    
    try {
      const response = await fetch(`${API_URLS.channel}?channel_id=${user.channel_id}`, {
        headers: {
          'X-User-Id': user.id.toString()
        }
      });
      const data = await response.json();
      if (response.ok && data.channel) {
        setChannelForm({
          name: data.channel.name || '',
          description: data.channel.description || '',
          avatar_url: data.channel.avatar_url || ''
        });
      }
    } catch (error) {
      console.error('Failed to load channel info:', error);
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
        loadVideos(); // Reload videos with user context
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка сети', variant: 'destructive' });
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Extract base64 part without the data:mime/type;base64, prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  };

  const getVideoDuration = (file: File): Promise<number> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        window.URL.revokeObjectURL(video.src);
        resolve(Math.floor(video.duration));
      };
      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = URL.createObjectURL(file);
    });
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast({ title: 'Войдите в аккаунт', variant: 'destructive' });
      return;
    }

    if (!videoFile) {
      toast({ title: 'Выберите видео файл', variant: 'destructive' });
      return;
    }

    if (!thumbnailFile) {
      toast({ title: 'Выберите миниатюру', variant: 'destructive' });
      return;
    }
    
    try {
      setIsUploading(true);
      setUploadProgress(10);

      // Get video duration
      const duration = await getVideoDuration(videoFile);
      setUploadProgress(20);

      // Convert files to base64
      const videoBase64 = await fileToBase64(videoFile);
      setUploadProgress(50);
      const thumbnailBase64 = await fileToBase64(thumbnailFile);
      setUploadProgress(70);

      const response = await fetch(API_URLS.upload, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Id': user.id.toString()
        },
        body: JSON.stringify({
          title: uploadForm.title,
          description: uploadForm.description,
          video_type: uploadForm.video_type,
          duration,
          video_data: videoBase64,
          thumbnail_data: thumbnailBase64,
          video_filename: videoFile.name,
          thumbnail_filename: thumbnailFile.name,
          channel_id: user.channel_id
        })
      });
      
      setUploadProgress(90);
      const data = await response.json();
      
      if (response.ok) {
        toast({ title: 'Видео загружено!' });
        setShowUploadDialog(false);
        loadVideos();
        setUploadForm({ title: '', description: '', duration: 0, video_type: 'regular' });
        setVideoFile(null);
        setThumbnailFile(null);
        setUploadProgress(100);
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast({ title: 'Ошибка загрузки', description: error instanceof Error ? error.message : 'Неизвестная ошибка', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleVideoOpen = async (video: Video) => {
    setSelectedVideo(video);
    
    // Record view
    if (user?.id) {
      try {
        await fetch(API_URLS.actions, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-User-Id': user.id.toString()
          },
          body: JSON.stringify({
            action: 'view',
            video_id: video.id
          })
        });
        
        // Update local video views
        setVideos(prevVideos => 
          prevVideos.map(v => 
            v.id === video.id ? { ...v, views_count: v.views_count + 1 } : v
          )
        );
        
        // Update selected video
        setSelectedVideo(prev => prev ? { ...prev, views_count: prev.views_count + 1 } : null);
      } catch (error) {
        console.error('Failed to record view:', error);
      }
    }
  };

  const handleLike = async () => {
    if (!user?.id || !selectedVideo) {
      toast({ title: 'Войдите в аккаунт', variant: 'destructive' });
      return;
    }

    try {
      const response = await fetch(API_URLS.actions, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Id': user.id.toString()
        },
        body: JSON.stringify({
          action: 'like',
          video_id: selectedVideo.id
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        // Update video state
        setSelectedVideo(prev => prev ? {
          ...prev,
          user_liked: !prev.user_liked,
          user_disliked: false,
          likes_count: prev.user_liked ? prev.likes_count - 1 : prev.likes_count + 1,
          dislikes_count: prev.user_disliked ? (prev.dislikes_count || 1) - 1 : prev.dislikes_count
        } : null);

        // Update in videos list
        setVideos(prevVideos => 
          prevVideos.map(v => 
            v.id === selectedVideo.id ? {
              ...v,
              user_liked: !v.user_liked,
              user_disliked: false,
              likes_count: v.user_liked ? v.likes_count - 1 : v.likes_count + 1
            } : v
          )
        );
        
        toast({ title: data.message || 'Лайк добавлен!' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', variant: 'destructive' });
    }
  };

  const handleDislike = async () => {
    if (!user?.id || !selectedVideo) {
      toast({ title: 'Войдите в аккаунт', variant: 'destructive' });
      return;
    }

    try {
      const response = await fetch(API_URLS.actions, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Id': user.id.toString()
        },
        body: JSON.stringify({
          action: 'dislike',
          video_id: selectedVideo.id
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        // Update video state
        setSelectedVideo(prev => prev ? {
          ...prev,
          user_disliked: !prev.user_disliked,
          user_liked: false,
          dislikes_count: prev.user_disliked ? (prev.dislikes_count || 1) - 1 : (prev.dislikes_count || 0) + 1,
          likes_count: prev.user_liked ? prev.likes_count - 1 : prev.likes_count
        } : null);

        // Update in videos list
        setVideos(prevVideos => 
          prevVideos.map(v => 
            v.id === selectedVideo.id ? {
              ...v,
              user_disliked: !v.user_disliked,
              user_liked: false,
              likes_count: v.user_liked ? v.likes_count - 1 : v.likes_count
            } : v
          )
        );
        
        toast({ title: data.message || 'Дизлайк добавлен!' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', variant: 'destructive' });
    }
  };

  const handleSubscribe = async () => {
    if (!user?.id || !selectedVideo?.channel_id) {
      toast({ title: 'Войдите в аккаунт', variant: 'destructive' });
      return;
    }

    try {
      const response = await fetch(API_URLS.actions, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Id': user.id.toString()
        },
        body: JSON.stringify({
          action: 'subscribe',
          channel_id: selectedVideo.channel_id
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        // Update video state
        setSelectedVideo(prev => prev ? {
          ...prev,
          user_subscribed: !prev.user_subscribed
        } : null);

        // Update in videos list
        setVideos(prevVideos => 
          prevVideos.map(v => 
            v.channel_id === selectedVideo.channel_id ? {
              ...v,
              user_subscribed: !v.user_subscribed
            } : v
          )
        );
        
        toast({ title: data.message || 'Подписка оформлена!' });
      }
    } catch (error) {
      toast({ title: 'Ошибка', variant: 'destructive' });
    }
  };

  const handleChannelUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.channel_id) return;

    try {
      const response = await fetch(API_URLS.channel, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'X-User-Id': user.id.toString()
        },
        body: JSON.stringify({
          channel_id: user.channel_id,
          ...channelForm
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        toast({ title: 'Канал обновлен!' });
        setShowChannelDialog(false);
        loadVideos(); // Reload to get updated channel names
      } else {
        toast({ title: 'Ошибка', description: data.error, variant: 'destructive' });
      }
    } catch (error) {
      toast({ title: 'Ошибка обновления', variant: 'destructive' });
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('user');
    toast({ title: 'Вы вышли из аккаунта' });
    loadVideos(); // Reload videos without user context
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleVideoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('video/')) {
      setVideoFile(files[0]);
    } else {
      toast({ title: 'Пожалуйста, выберите видео файл', variant: 'destructive' });
    }
  };

  const handleThumbnailDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.dataTransfer.files;
    if (files.length > 0 && files[0].type.startsWith('image/')) {
      setThumbnailFile(files[0]);
    } else {
      toast({ title: 'Пожалуйста, выберите изображение', variant: 'destructive' });
    }
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
                  className="neon-border"
                  onClick={() => setShowChannelDialog(true)}
                >
                  <Icon name="Settings" size={20} />
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
        <div className="flex gap-2 mb-6 flex-wrap">
          {['Все', 'Музыка', 'Игры', 'Новости', 'Спорт', 'Обучение', 'Технологии'].map((tag) => (
            <Badge key={tag} variant="outline" className="cursor-pointer hover:bg-primary/20 transition-colors">
              {tag}
            </Badge>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {videos.filter(v => v.title.toLowerCase().includes(searchQuery.toLowerCase())).map((video) => (
            <Card 
              key={video.id} 
              className="group cursor-pointer overflow-hidden border-primary/20 hover:border-primary/60 transition-all duration-300 hover:scale-105 neon-card"
              onClick={() => handleVideoOpen(video)}
            >
              <div className="relative aspect-video overflow-hidden">
                <img 
                  src={video.thumbnail_url} 
                  alt={video.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                />
                <div className="absolute bottom-2 right-2 bg-black/80 px-2 py-1 rounded text-xs font-semibold">
                  {formatDuration(video.duration)}
                </div>
                {video.video_type === 'short' && (
                  <div className="absolute top-2 left-2 bg-secondary/90 px-2 py-1 rounded text-xs font-semibold">
                    SHORT
                  </div>
                )}
              </div>
              <div className="p-4">
                <h3 className="font-semibold mb-2 line-clamp-2 group-hover:text-primary transition-colors">
                  {video.title}
                </h3>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Icon name="User" size={14} />
                    {video.channel_name || 'Unknown'}
                    {video.is_verified && <Icon name="BadgeCheck" size={14} className="text-primary" />}
                  </span>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                  <span className="flex items-center gap-1">
                    <Icon name="Eye" size={12} />
                    {formatViews(video.views_count)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Icon name="ThumbsUp" size={12} />
                    {formatViews(video.likes_count)}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>

      {/* Video Dialog */}
      <Dialog open={!!selectedVideo} onOpenChange={(open) => !open && setSelectedVideo(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {selectedVideo && (
            <div className="space-y-4">
              <div className="aspect-video w-full bg-black rounded-lg overflow-hidden">
                <VideoPlayer 
                  src={selectedVideo.video_url}
                  poster={selectedVideo.thumbnail_url}
                />
              </div>
              
              <div>
                <h2 className="text-2xl font-bold mb-2">{selectedVideo.title}</h2>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Icon name="User" size={16} />
                    <span className="font-semibold">{selectedVideo.channel_name || 'Unknown'}</span>
                    {selectedVideo.is_verified && <Icon name="BadgeCheck" size={16} className="text-primary" />}
                  </div>
                  
                  {user && selectedVideo.channel_id !== user.channel_id && (
                    <Button
                      variant={selectedVideo.user_subscribed ? 'outline' : 'default'}
                      size="sm"
                      onClick={handleSubscribe}
                      className={selectedVideo.user_subscribed ? '' : 'neon-border'}
                    >
                      <Icon name={selectedVideo.user_subscribed ? 'UserCheck' : 'UserPlus'} size={16} className="mr-2" />
                      {selectedVideo.user_subscribed ? 'Отписаться' : 'Подписаться'}
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-4 mb-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLike}
                      className={selectedVideo.user_liked ? 'bg-primary/20 border-primary' : ''}
                    >
                      <Icon name="ThumbsUp" size={16} className="mr-2" />
                      {formatViews(selectedVideo.likes_count)}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleDislike}
                      className={selectedVideo.user_disliked ? 'bg-destructive/20 border-destructive' : ''}
                    >
                      <Icon name="ThumbsDown" size={16} className="mr-2" />
                      {selectedVideo.dislikes_count ? formatViews(selectedVideo.dislikes_count) : 0}
                    </Button>
                  </div>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Icon name="Eye" size={16} />
                      {formatViews(selectedVideo.views_count)} просмотров
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-card rounded-lg border border-primary/20">
                  <p className="text-sm whitespace-pre-wrap">{selectedVideo.description}</p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Auth Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{authMode === 'login' ? 'Вход' : 'Регистрация'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <Label htmlFor="username">Имя пользователя</Label>
              <Input
                id="username"
                value={authForm.username}
                onChange={(e) => setAuthForm({ ...authForm, username: e.target.value })}
                required
              />
            </div>
            {authMode === 'register' && (
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={authForm.email}
                  onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                  required
                />
              </div>
            )}
            <div>
              <Label htmlFor="password">Пароль</Label>
              <Input
                id="password"
                type="password"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                required
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

      {/* Upload Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Загрузить видео</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            <div>
              <Label htmlFor="title">Название</Label>
              <Input
                id="title"
                value={uploadForm.title}
                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="description">Описание</Label>
              <Textarea
                id="description"
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="video_type">Тип видео</Label>
              <Select 
                value={uploadForm.video_type} 
                onValueChange={(value) => setUploadForm({ ...uploadForm, video_type: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="regular">Обычное</SelectItem>
                  <SelectItem value="short">Shorts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Video File Upload */}
            <div>
              <Label>Видео файл</Label>
              <div
                className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/60 transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleVideoDrop}
                onClick={() => videoInputRef.current?.click()}
              >
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setVideoFile(file);
                  }}
                />
                {videoFile ? (
                  <div className="flex items-center justify-center gap-2">
                    <Icon name="FileVideo" size={24} className="text-primary" />
                    <span className="text-sm">{videoFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setVideoFile(null);
                      }}
                    >
                      <Icon name="X" size={16} />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Icon name="Upload" size={48} className="mx-auto mb-4 text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Нажмите или перетащите видео файл сюда
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Thumbnail File Upload */}
            <div>
              <Label>Миниатюра</Label>
              <div
                className="border-2 border-dashed border-primary/30 rounded-lg p-8 text-center cursor-pointer hover:border-primary/60 transition-colors"
                onDragOver={handleDragOver}
                onDrop={handleThumbnailDrop}
                onClick={() => thumbnailInputRef.current?.click()}
              >
                <input
                  ref={thumbnailInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setThumbnailFile(file);
                  }}
                />
                {thumbnailFile ? (
                  <div className="space-y-2">
                    <img 
                      src={URL.createObjectURL(thumbnailFile)} 
                      alt="Preview" 
                      className="max-h-40 mx-auto rounded"
                    />
                    <div className="flex items-center justify-center gap-2">
                      <Icon name="Image" size={20} className="text-primary" />
                      <span className="text-sm">{thumbnailFile.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setThumbnailFile(null);
                        }}
                      >
                        <Icon name="X" size={16} />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <Icon name="Image" size={48} className="mx-auto mb-4 text-primary" />
                    <p className="text-sm text-muted-foreground">
                      Нажмите или перетащите изображение сюда
                    </p>
                  </div>
                )}
              </div>
            </div>

            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Загрузка...</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="h-2 bg-card rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full neon-border"
              disabled={isUploading || !videoFile || !thumbnailFile}
            >
              {isUploading ? 'Загрузка...' : 'Загрузить'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Channel Edit Dialog */}
      <Dialog open={showChannelDialog} onOpenChange={setShowChannelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Настройки канала</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleChannelUpdate} className="space-y-4">
            <div>
              <Label htmlFor="channel_name">Название канала</Label>
              <Input
                id="channel_name"
                value={channelForm.name}
                onChange={(e) => setChannelForm({ ...channelForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="channel_description">Описание канала</Label>
              <Textarea
                id="channel_description"
                value={channelForm.description}
                onChange={(e) => setChannelForm({ ...channelForm, description: e.target.value })}
                rows={4}
              />
            </div>
            <div>
              <Label htmlFor="avatar_url">URL аватара</Label>
              <Input
                id="avatar_url"
                value={channelForm.avatar_url}
                onChange={(e) => setChannelForm({ ...channelForm, avatar_url: e.target.value })}
                placeholder="https://example.com/avatar.jpg"
              />
            </div>
            <Button type="submit" className="w-full neon-border">
              Сохранить изменения
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
