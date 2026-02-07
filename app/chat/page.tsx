'use client';

import { useEffect, useMemo, useRef, useState, FormEvent } from 'react';
import useSWR from 'swr';
import { useAuth } from '@/hooks/use-auth';
import { ProtectedRoute } from '@/components/protected-route';
import { DashboardSidebar } from '@/components/dashboard-sidebar';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Plus, Search, MoreVertical, Smile, Loader2, AlertCircle, ChevronDown, X, Edit2, Trash2, Reply as ReplyIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import EmojiPicker, { Theme } from 'emoji-picker-react';
import { io as ClientIO } from 'socket.io-client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ChatRoom {
  id: number;
  name: string;
  type: 'direct' | 'group' | 'channel';
  description?: string;
  created_at?: string;
}

interface RoomMember {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url?: string;
}

interface Message {
  id: number;
  sender_id: number;
  room_id?: number;
  content: string;
  created_at: string;
  first_name?: string;
  last_name?: string;
  avatar_url?: string;
  reply_to_id?: number | null;
  is_edited?: boolean;
  reactions?: any;
  attachment_url?: string;
  message_type?: 'text' | 'image' | 'file' | 'system';
}

type Workspace = { id: number; name: string };

const authFetcher = async (url: string) => {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Request failed');
  }
  return res.json();
};

function ChatContent() {
  const { user } = useAuth();
  const { data: workspaces } = useSWR<Workspace[]>('/api/workspaces', authFetcher);
  const workspaceList = useMemo(() => workspaces || [], [workspaces]);



  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>('');
  const [socket, setSocket] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('active_workspace_id');
    if (stored) {
      setActiveWorkspaceId(stored);
    } else if (workspaceList.length > 0) {
      setActiveWorkspaceId(String(workspaceList[0].id));
    }
  }, [workspaceList]);

  useEffect(() => {
    if (activeWorkspaceId) localStorage.setItem('active_workspace_id', activeWorkspaceId);
  }, [activeWorkspaceId]);



  // Fetch global rooms
  const roomsKey = '/api/chat-rooms?workspaceId=1'; // Defaulting to 1 for now or just generic if API handles it
  const {
    data: rooms,
    error: roomsError,
    isLoading: roomsLoading,
    mutate: mutateRooms,
  } = useSWR<ChatRoom[]>(roomsKey, authFetcher);

  const roomList = useMemo(() => rooms || [], [rooms]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);

  useEffect(() => {
    // Auto-select General if nothing selected
    if (selectedRoomId) return;
    if (roomList.length > 0) {
      const general = roomList.find(r => r.name === 'General');
      if (general) setSelectedRoomId(general.id);
      else setSelectedRoomId(roomList[0].id);
    }
  }, [roomList, selectedRoomId]);

  const selectedRoom = useMemo(
    () => roomList.find((r) => r.id === selectedRoomId) || null,
    [roomList, selectedRoomId]
  );

  // Socket Init
  useEffect(() => {
    const socketInstance = ClientIO(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000', {
      path: '/api/socket/io',
      addTrailingSlash: false,
    });

    socketInstance.on('connect', () => {
      setIsConnected(true);
      if (user?.id) socketInstance.emit('join-user', user.id);
    });

    socketInstance.on('disconnect', () => setIsConnected(false));

    setSocket(socketInstance);

    return () => {
      socketInstance.disconnect();
    };
  }, [user?.id]);

  // Join Room
  useEffect(() => {
    if (!socket || !selectedRoomId) return;
    socket.emit('join-room', selectedRoomId);
    return () => {
      socket.emit('leave-room', selectedRoomId);
    };
  }, [socket, selectedRoomId]);

  const messagesKey = selectedRoomId ? `/api/messages?roomId=${selectedRoomId}&limit=100` : null;
  const {
    data: messages,
    error: messagesError,
    isLoading: messagesLoading,
    mutate: mutateMessages,
  } = useSWR<Message[]>(messagesKey, authFetcher);

  const messageList = useMemo(() => messages || [], [messages]);
  const [messageInput, setMessageInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // const [isCreateRoomOpen, setIsCreateRoomOpen] = useState(false);
  // const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  // const [createRoomError, setCreateRoomError] = useState('');
  // const [createRoomForm, setCreateRoomForm] = useState<{
  //   name: string;
  //   type: 'direct' | 'group' | 'channel';
  //   description: string;
  // }>({
  //   name: '',
  //   type: 'channel',
  //   description: '',
  // });

  const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false);
  const [isUpdatingMembers, setIsUpdatingMembers] = useState(false);
  const [memberError, setMemberError] = useState('');
  const [memberSearch, setMemberSearch] = useState('');
  const [memberSearchResults, setMemberSearchResults] = useState<any[]>([]);

  const membersKey = selectedRoomId ? `/api/chat-room-members?roomId=${selectedRoomId}` : null;
  const {
    data: roomMembers,
    isLoading: membersLoading,
    error: membersError,
    mutate: mutateMembers,
  } = useSWR<RoomMember[]>(membersKey, authFetcher);

  // New State for Advanced Features
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Socket Events
  useEffect(() => {
    if (!socket) return;

    const handleTyping = (data: { roomId: number; user: string; isTyping: boolean }) => {
      if (Number(data.roomId) !== Number(selectedRoomId)) return;
      setTypingUsers(prev => {
        const next = new Set(prev);
        if (data.isTyping) next.add(data.user);
        else next.delete(data.user);
        return next;
      });
    };

    const handleMessageUpdated = (updatedMsg: Message) => {
      if (updatedMsg.room_id && Number(updatedMsg.room_id) !== Number(selectedRoomId)) return;
      mutateMessages(current => current?.map(m => m.id === updatedMsg.id ? { ...m, ...updatedMsg } : m), { revalidate: false });
    };

    const handleMessageDeleted = (data: { id: number; room_id: number }) => {
      if (data.room_id && Number(data.room_id) !== Number(selectedRoomId)) return;
      mutateMessages(current => current?.filter(m => m.id !== data.id), { revalidate: false });
    };

    socket.on('typing', handleTyping);
    socket.on('message-updated', handleMessageUpdated);
    socket.on('message-deleted', handleMessageDeleted);

    return () => {
      socket.off('typing', handleTyping);
      socket.off('message-updated', handleMessageUpdated);
      socket.off('message-deleted', handleMessageDeleted);
    };
  }, [socket, selectedRoomId, mutateMessages]);

  const handleTypingInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setMessageInput(e.target.value);

    if (!socket || !selectedRoomId || !user) return;

    socket.emit('typing', { roomId: selectedRoomId, user: user.first_name, isTyping: true });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing', { roomId: selectedRoomId, user: user.first_name, isTyping: false });
    }, 2000);
  };

  // Mark as read when room opens or changes
  useEffect(() => {
    if (!selectedRoomId) return;

    const markRead = async () => {
      try {
        const token = localStorage.getItem('auth_token');
        await fetch('/api/chat/read', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ room_id: selectedRoomId })
        });
        // Optionally revalidate sidebar count here if context available, 
        // but sidebar polls every 5s so it will update automatically.
      } catch (err) {
        console.error('Failed to mark read:', err);
      }
    };

    markRead();
    scrollToBottom();
  }, [selectedRoomId, messageList.length]); // Also mark read when new messages arrive while open? Yes.

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSearchUsersForRoom = async () => {
    if (!activeWorkspaceId || !memberSearch.trim()) return;
    setMemberError('');
    try {
      const token = localStorage.getItem('auth_token');
      const params = new URLSearchParams({
        workspaceId: activeWorkspaceId,
        q: memberSearch.trim(),
      });
      const res = await fetch(`/api/users/search?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to search users');
      setMemberSearchResults(data);
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : 'Failed to search users');
    }
  };

  const handleAddMember = async (userId: number) => {
    if (!selectedRoomId) return;
    setIsUpdatingMembers(true);
    setMemberError('');
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/chat-room-members', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ room_id: selectedRoomId, user_id: userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to add member');
      setMemberSearch('');
      setMemberSearchResults([]);
      await mutateMembers();
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : 'Failed to add member');
    } finally {
      setIsUpdatingMembers(false);
    }
  };

  const handleRemoveMember = async (userId: number) => {
    if (!selectedRoomId) return;
    setIsUpdatingMembers(true);
    setMemberError('');
    try {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/chat-room-members', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ room_id: selectedRoomId, user_id: userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to remove member');
      await mutateMembers();
    } catch (err) {
      setMemberError(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setIsUpdatingMembers(false);
    }
  };

  const handleEmojiClick = (emojiData: any) => {
    setMessageInput(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!confirm('Are you sure you want to delete this message?')) return;
    try {
      const token = localStorage.getItem('auth_token');
      await fetch(`/api/messages?id=${messageId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      mutateMessages(current => current?.filter(m => m.id !== messageId), { revalidate: false });
      // Socket emit handled by API or we can emit here too for faster UI
      if (socket && selectedRoomId) {
        socket.emit('delete-message', { id: messageId, room_id: selectedRoomId });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMessage = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!messageInput.trim()) return;
    if (!selectedRoomId) return;

    const token = localStorage.getItem('auth_token');

    // Handle Edit
    if (editingMessage) {
      try {
        await fetch('/api/messages', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ id: editingMessage.id, content: messageInput })
        });

        // Optimistic update
        mutateMessages(current => current?.map(m => m.id === editingMessage.id ? { ...m, content: messageInput, is_edited: true } : m), { revalidate: false });

        if (socket) {
          socket.emit('edit-message', { ...editingMessage, content: messageInput, is_edited: true, room_id: selectedRoomId });
        }

        setEditingMessage(null);
        setMessageInput('');
      } catch (err) {
        console.error(err);
      }
      return;
    }

    // Handle New Message
    const optimistic: Message = {
      id: Date.now(),
      sender_id: user?.id || 0,
      content: messageInput,
      created_at: new Date().toISOString(),
      first_name: user?.first_name,
      last_name: user?.last_name,
      avatar_url: user?.avatar_url,
      reply_to_id: replyTo?.id || null,
    };

    setMessageInput('');
    setReplyTo(null);
    await mutateMessages(async (current) => [...(current || []), optimistic], { revalidate: false });

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          room_id: selectedRoomId,
          content: optimistic.content,
          reply_to_id: optimistic.reply_to_id,
        }),
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'Failed to send message');

      if (socket) {
        socket.emit('send-message', {
          ...optimistic,
          id: payload.id || optimistic.id, // Use real ID if available
          room_id: selectedRoomId,
        });

        // Notify other members (for sidebar unread count)
        roomMembers?.forEach((m) => {
          if (m.user_id !== user?.id) {
            socket.emit('notify-user', { userId: m.user_id, roomId: selectedRoomId });
          }
        });
      }

      await mutateMessages();
    } catch (err) {
      console.error(err);
      await mutateMessages();
    }
  };

  const { data: chatUsers, error: chatUsersError, isLoading: chatUsersLoading } = useSWR('/api/chat-users', authFetcher);

  const handleUserClick = async (targetUser: any) => {
    // 1. Check if we already have a DM with this user
    // Note: This check is purely client-side based on room name convention or description protocol
    // Ideally backend returns "dm_partner_id" but for now we look for room type 'direct' and description === targetUser.id
    const existingRoom = roomList.find(r => r.type === 'direct' && (r.description === String(targetUser.id) || r.name === `${targetUser.first_name} ${targetUser.last_name}`));

    if (existingRoom) {
      setSelectedRoomId(existingRoom.id);
      return;
    }

    // 2. Create new DM room
    try {
      const token = localStorage.getItem('auth_token');
      // setIsCreatingRoom(true); 

      const res = await fetch('/api/chat-rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({

          name: `${targetUser.first_name} ${targetUser.last_name}`,
          type: 'direct',
          description: String(targetUser.id),
          member_ids: [targetUser.id],
          workspace_id: activeWorkspaceId ? Number(activeWorkspaceId) : 1,
        }),
      });
      const data = await res.json();
      if (data.roomId) {
        await mutateRooms();
        setSelectedRoomId(data.roomId);
      }
    } catch (e) { console.error(e); }

  };



  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !selectedRoomId) return;
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', e.target.files[0]);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Send message with attachment
      const token = localStorage.getItem('auth_token');
      const isImage = e.target.files[0].type.startsWith('image/');
      const optimistic: Message = {
        id: Date.now(),
        sender_id: user?.id || 0,
        content: isImage ? 'Sent an image' : 'Sent a file',
        created_at: new Date().toISOString(),
        first_name: user?.first_name,
        last_name: user?.last_name,
        avatar_url: user?.avatar_url,
        attachment_url: data.url,
        message_type: isImage ? 'image' : 'file',
      };

      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          room_id: selectedRoomId,
          content: optimistic.content,
          attachment_url: data.url,
          message_type: optimistic.message_type
        })
      });

      // Socket emit
      if (socket) {
        socket.emit('send-message', { ...optimistic, room_id: selectedRoomId });
      }
      mutateMessages();
    } catch (err) {
      console.error('Upload failed', err);
      alert('Failed to upload file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const filteredRooms = roomList.filter((room) =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background flex">
      <DashboardSidebar />

      <main className="w-full md:pl-64 flex">
        {/* Sidebar */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:flex w-80 bg-card border-r border-border flex-col"
        >
          {/* Header */}
          <div className="p-6 border-b border-border">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-foreground">Messages</h2>
            </div>



            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-9 text-sm"
              />
            </div>
          </div>

          {/* Rooms List */}
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence>
              {roomsLoading ? (
                <div className="p-6 text-center text-muted-foreground">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                  Loading rooms...
                </div>
              ) : roomsError ? (
                <div className="p-6 text-center text-muted-foreground">
                  <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-60" />
                  {(roomsError as Error).message}
                </div>
              ) : filteredRooms.length === 0 ? (
                <div className="p-6 text-center text-muted-foreground">
                  No rooms found
                </div>
              ) : (
                filteredRooms.map((room, index) => (
                  <motion.button
                    key={room.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedRoomId(room.id)}
                    className={`w-full text-left p-4 border-b border-border hover:bg-secondary transition-colors ${selectedRoomId === room.id ? 'bg-primary/10' : ''
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary/50 to-accent/50 rounded-full flex items-center justify-center text-2xl flex-shrink-0">
                        {room.type === 'direct' ? '👤' : room.type === 'group' ? '👥' : '#'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-foreground truncate">
                          {room.name}
                        </h3>
                        <p className="text-xs text-muted-foreground capitalize">
                        </p>
                      </div>
                    </div>

                  </motion.button>
                ))
              )}
            </AnimatePresence>

            {/* Users List (Direct Messages) */}
            <div className="mt-6 px-6 pb-2">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Direct Messages
              </h3>
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-1">
              {chatUsersLoading ? (
                <div className="text-center text-xs text-muted-foreground py-2">Loading users...</div>
              ) : chatUsers?.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground py-2">No other users found</div>
              ) : (
                chatUsers?.filter((u: any) => u.id !== user?.id).map((u: any) => (
                  <button
                    key={u.id}
                    onClick={() => handleUserClick(u)}
                    className="w-full flex items-center gap-2 p-2 rounded-md hover:bg-secondary transition-colors text-left group"
                  >
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">
                        {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full rounded-full object-cover" /> : u.first_name?.[0]}
                      </div>
                      <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${u.is_active ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate group-hover:text-primary transition-colors">{u.first_name} {u.last_name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{u.role}</div>
                    </div>
                  </button>
                ))
              )}
            </div>

          </div>
        </motion.div>

        {/* Chat Area */}
        < motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 flex flex-col"
        >
          {/* Chat Header */}
          < div className="bg-card border-b border-border p-6 flex justify-between items-center" >
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {selectedRoom?.name || 'Select a room'}
              </h3>
              <p className="text-sm text-muted-foreground capitalize flex items-center gap-3">
                <span>
                  {selectedRoom?.type === 'channel' ? '#' : ''}
                  {selectedRoom?.type || ''}
                </span>
                {selectedRoomId && (
                  <Dialog open={isMembersDialogOpen} onOpenChange={setIsMembersDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 px-2 text-xs">
                        Members
                        {Array.isArray(roomMembers) && roomMembers.length > 0 && (
                          <span className="ml-1 inline-flex items-center justify-center rounded-full bg-secondary px-1.5 text-[10px]">
                            {roomMembers.length}
                          </span>
                        )}
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Room members</DialogTitle>
                        <DialogDescription>
                          View and manage members in this chat room.
                        </DialogDescription>
                      </DialogHeader>

                      {memberError && (
                        <div className="mb-3 p-2 rounded-md border border-destructive/40 bg-destructive/10 text-xs text-destructive">
                          {memberError}
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            Current members
                          </p>
                          <div className="max-h-52 overflow-y-auto border rounded-md divide-y">
                            {membersLoading ? (
                              <div className="p-3 text-xs text-muted-foreground">Loading members...</div>
                            ) : membersError ? (
                              <div className="p-3 text-xs text-muted-foreground">
                                Failed to load members
                              </div>
                            ) : !roomMembers || roomMembers.length === 0 ? (
                              <div className="p-3 text-xs text-muted-foreground">No members yet.</div>
                            ) : (
                              roomMembers.map((m) => {
                                const initials = `${m.first_name?.[0] || ''}${m.last_name?.[0] || ''}` || 'U';
                                const isSelf = m.user_id === user?.id;
                                return (
                                  <div key={m.id} className="flex items-center justify-between px-3 py-2 text-sm">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[11px] font-semibold">
                                        {initials}
                                      </div>
                                      <div>
                                        <div className="text-xs font-medium">
                                          {m.first_name} {m.last_name}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground">{m.email}</div>
                                      </div>
                                    </div>
                                    {!isSelf && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={isUpdatingMembers}
                                        onClick={() => handleRemoveMember(m.user_id)}
                                        className="h-7 px-2 text-[11px] text-destructive hover:text-destructive"
                                      >
                                        Remove
                                      </Button>
                                    )}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>

                        <div className="pt-2 border-t">
                          <p className="text-xs font-semibold text-muted-foreground mb-1">
                            Add members from workspace
                          </p>
                          <div className="flex gap-2 mb-2">
                            <Input
                              placeholder="Search by name or email"
                              value={memberSearch}
                              onChange={(e) => setMemberSearch(e.target.value)}
                              className="h-8 text-xs"
                            />
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={isUpdatingMembers || !memberSearch.trim()}
                              onClick={handleSearchUsersForRoom}
                              className="h-8 px-3 text-[11px]"
                            >
                              Search
                            </Button>
                          </div>
                          {memberSearchResults.length > 0 && (
                            <div className="max-h-40 overflow-y-auto border rounded-md divide-y">
                              {memberSearchResults.map((u) => {
                                const initials = `${u.first_name?.[0] || ''}${u.last_name?.[0] || ''}` || 'U';
                                const alreadyMember = roomMembers?.some((m) => m.user_id === u.id);
                                return (
                                  <div key={u.id} className="flex items-center justify-between px-3 py-2 text-sm">
                                    <div className="flex items-center gap-2">
                                      <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[11px] font-semibold">
                                        {initials}
                                      </div>
                                      <div>
                                        <div className="text-xs font-medium">
                                          {u.first_name} {u.last_name}
                                        </div>
                                        <div className="text-[11px] text-muted-foreground">{u.email}</div>
                                      </div>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      disabled={isUpdatingMembers || alreadyMember}
                                      onClick={() => handleAddMember(u.id)}
                                      className="h-7 px-2 text-[11px]"
                                    >
                                      {alreadyMember ? 'Already in room' : 'Add'}
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      <DialogFooter className="mt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsMembersDialogOpen(false)}
                          className="bg-transparent"
                        >
                          Close
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </p>
            </div>
            <Button variant="ghost" size="sm">
              <MoreVertical className="w-4 h-4" />
            </Button>
          </div >

          {
            selectedRoomId ? (
              <>
                {/* Messages */}
                < div className="flex-1 overflow-y-auto p-6 space-y-4" >
                  <AnimatePresence>
                    {messagesLoading ? (
                      <div className="text-center text-muted-foreground py-8">
                        <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
                        Loading messages...
                      </div>
                    ) : messagesError ? (
                      <div className="text-center text-muted-foreground py-8">
                        <AlertCircle className="w-6 h-6 mx-auto mb-2 opacity-60" />
                        {(messagesError as Error).message}
                      </div>
                    ) : messageList.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8">
                        No messages yet. Start the conversation!
                      </div>
                    ) : (
                      messageList.map((msg, index) => {
                        const isMine = Number(msg.sender_id) === Number(user?.id);
                        const senderName = `${msg.first_name || 'User'} ${msg.last_name || ''}`;
                        const parentMsg = msg.reply_to_id
                          ? messageList.find((m) => m.id === msg.reply_to_id)
                          : null;

                        return (
                          <motion.div
                            key={msg.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.02 }}
                            className={`flex gap-3 group items-start ${isMine ? 'justify-end' : 'justify-start'}`}
                          >
                            {!isMine && (
                              <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 text-xs font-bold mt-1">
                                {msg.avatar_url ? (
                                  <img src={msg.avatar_url} className="w-full h-full rounded-full object-cover" alt="" />
                                ) : (
                                  (msg.first_name?.[0] || 'U')
                                )}
                              </div>
                            )}

                            <div className={`max-w-xs lg:max-w-md ${isMine ? 'order-2' : 'order-1'}`}>
                              {!isMine && (
                                <p className="text-xs font-semibold text-muted-foreground mb-1 ml-1">
                                  {senderName}
                                </p>
                              )}

                              <div className="flex flex-col gap-1">
                                {/* Reply Context */}
                                {parentMsg && (
                                  <div className={`text-xs p-1 px-2 rounded-md mb-1 flex items-center gap-1 opacity-70 ${isMine ? 'bg-primary-foreground/20 text-white' : 'bg-muted text-muted-foreground'}`}>
                                    <ReplyIcon className="w-3 h-3" />
                                    <span className="truncate max-w-[150px]">{parentMsg.content}</span>
                                  </div>
                                )}

                                <motion.div
                                  className={`px-4 py-3 rounded-2xl relative transition-all ${isMine
                                    ? 'bg-primary text-white rounded-br-none'
                                    : 'bg-secondary text-foreground rounded-bl-none'
                                    }`}
                                >
                                  <p className="break-words text-sm whitespace-pre-wrap">{msg.content}</p>
                                  {msg.attachment_url && (
                                    <div className="mt-2">
                                      {msg.message_type === 'image' || msg.attachment_url.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                                        <img src={msg.attachment_url} alt="Attachment" className="max-w-full h-auto rounded-lg max-h-60 object-cover border" />
                                      ) : (
                                        <a href={msg.attachment_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-2 bg-background/50 rounded-md hover:bg-background/80 transition-colors">
                                          <div className="p-2 bg-primary/10 rounded-md">
                                            <svg className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
                                          </div>
                                          <span className="text-xs text-primary underline truncate max-w-[150px]">View Attachment</span>
                                        </a>
                                      )}
                                    </div>
                                  )}
                                  {msg.is_edited && <span className="text-[10px] opacity-60 ml-2">(edited)</span>}
                                </motion.div>
                              </div>

                              <div className={`flex items-center gap-2 mt-1 px-1 ${isMine ? 'justify-end' : 'justify-start'}`}>
                                <p className="text-[10px] text-muted-foreground">
                                  {new Date(msg.created_at).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </p>

                                {/* Message Actions */}
                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                                  <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setReplyTo(msg)} title="Reply">
                                    <ReplyIcon className="w-3 h-3" />
                                  </Button>
                                  {isMine && (
                                    <>
                                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setEditingMessage(msg); setMessageInput(msg.content); }} title="Edit">
                                        <Edit2 className="w-3 h-3" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => handleDeleteMessage(msg.id)} title="Delete">
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                    {typingUsers.size > 0 && (
                      <div className="text-xs text-muted-foreground italic px-4 animate-pulse">
                        {Array.from(typingUsers).join(', ')} is typing...
                      </div>
                    )}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div >

                {/* Input Area */}
                < motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="bg-card border-t border-border p-6 relative"
                >
                  <AnimatePresence>
                    {replyTo && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute -top-12 left-6 right-6 bg-secondary/90 backdrop-blur-sm p-2 px-4 rounded-md flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <ReplyIcon className="w-4 h-4 text-primary" />
                          <span>Replying to <strong>{replyTo.first_name}</strong>: {replyTo.content.substring(0, 30)}...</span>
                        </div>
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setReplyTo(null)}><X className="w-4 h-4" /></Button>
                      </motion.div>
                    )}
                    {editingMessage && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute -top-12 left-6 right-6 bg-secondary/90 backdrop-blur-sm p-2 px-4 rounded-md flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <Edit2 className="w-4 h-4 text-primary" />
                          <span>Editing message</span>
                        </div>
                        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => { setEditingMessage(null); setMessageInput(''); }}><X className="w-4 h-4" /></Button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {
                    showEmojiPicker && (
                      <div className="absolute bottom-20 right-6 z-50">
                        <EmojiPicker onEmojiClick={handleEmojiClick} theme={Theme.DARK} />
                      </div>
                    )
                  }

                  <input
                    type="file"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileSelect}
                  />

                  <form onSubmit={handleSendMessage} className="flex gap-3 items-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={isUploading}
                    >
                      {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                    </Button>

                    <Input
                      placeholder={replyTo ? "Type your reply..." : "Type your message..."}
                      value={messageInput}
                      onChange={handleTypingInput}
                      className="flex-1 bg-secondary/50 border-0 focus-visible:ring-1 focus-visible:ring-primary h-11"
                    />

                    <Button variant="ghost" size="sm" type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className={`text-muted-foreground hover:text-foreground ${showEmojiPicker ? 'text-primary' : ''}`}>
                      <Smile className="w-5 h-5" />
                    </Button>

                    <Button type="submit" size="sm" disabled={!messageInput.trim() && !isUploading} className="h-11">
                      <Send className="w-4 h-4" />
                    </Button>
                  </form>
                </motion.div >
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-4">
                <div className="p-4 bg-secondary/50 rounded-full">
                  <span className="text-4xl">💬</span>
                </div>
                <p className="text-lg font-medium">Select a conversation</p>
                <p className="text-sm max-w-xs text-center">Choose a room or user from the sidebar to start chatting.</p>
              </div>
            )}
        </motion.div >
      </main >
    </div >
  );
}


export default function ChatPage() {
  return (
    <ProtectedRoute>
      <ChatContent />
    </ProtectedRoute>
  );
}
