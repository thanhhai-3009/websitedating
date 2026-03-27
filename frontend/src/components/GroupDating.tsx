import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Users, CheckCircle, UserPlus, MapPin } from 'lucide-react';
import { useToast } from '../hooks/use-toast';
import { Tooltip, TooltipTrigger, TooltipContent } from './ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { Button } from './ui/button';
import { useUser, useAuth } from '@clerk/clerk-react';
import { getApiToken } from '@/lib/clerkToken';

type UserProfile = {
  id: string;
  isVerified?: boolean;
  interests?: string[];
};

type Group = {
  _id: string;
  title: string;
  description?: string;
  category: 'Dining' | 'Travel' | 'Hangout' | string;
  tags: string[];
  maxMembers: number;
  members: string[];
  hostId: string;
  status: 'OPEN' | 'FULL' | 'CLOSED' | string;
  eventDate: string;
  host?: { isVerified?: boolean };
};

export const GroupDating: React.FC = () => {
  // Auth + toast
  const { user } = useUser();
  const { getToken } = useAuth();
  const { toast } = useToast();

  // State hooks (always declared at top-level)
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  // Create Group modal state
  const [openCreate, setOpenCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [form, setForm] = useState({ title: '', category: 'Dining', tags: '', eventDate: '', maxMembers: 4 });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      try {
        // Resolve an auth token (Clerk JWT) for backend requests
        const token = await getApiToken(getToken);

        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        // fetch profile
        const pRes = await fetch('/api/me', { headers });
        const pJson = pRes.ok ? await pRes.json() : null;
        if (!mounted) return;
        setProfile(pJson);

        // fetch groups using search endpoint when interests available
        const interests = Array.isArray(pJson?.interests) ? pJson.interests : [];
        const url = interests.length ? `/api/groups/search?interests=${encodeURIComponent(interests.join(','))}` : '/api/groups';
        const gRes = await fetch(url, { headers });
        const gJson = gRes.ok ? await gRes.json() : [];
        if (!mounted) return;
        setGroups(gJson as Group[]);
      } catch (err: any) {
        console.error(err);
        toast({ title: 'Load error', description: err?.message || String(err) });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, [getToken, toast]);

  // compute match count for client-side sorting
  const annotated = useMemo(() => {
    const interests = profile?.interests ?? [];
    return groups.map((g) => {
      const matchCount = g.tags.filter((t) => interests.includes(t)).length;
      return { group: g, matchCount };
    }).sort((a, b) => b.matchCount - a.matchCount || new Date(a.group.eventDate).getTime() - new Date(b.group.eventDate).getTime());
  }, [groups, profile]);

  const handleJoin = async (groupId: string) => {
    if (!profile) {
      toast({ title: 'Not logged in', description: 'Please log in to join groups.' });
      return;
    }
    const target = groups.find((g) => g._id === groupId);
    if (!target) return;
    if (target.status !== 'OPEN') {
      toast({ title: 'Cannot join', description: `Group is ${target.status}` });
      return;
    }
    if (target.members.some((m) => String(m) === String(profile.id))) {
      toast({ title: 'Already joined', description: 'You are already a member of this group.' });
      return;
    }

    try {
      setJoiningId(groupId);
      const res = await fetch(`/api/groups/${encodeURIComponent(groupId)}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile.id })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Join failed');

      // merge updated group from server if returned
      const updated: Group = json.group ?? json;
      setGroups((prev) => prev.map((g) => (g._id === groupId ? { ...g, members: updated.members ?? g.members, status: updated.status ?? g.status } : g)));
      toast({ title: 'Joined', description: 'You joined the group successfully.' });
    } catch (err: any) {
      toast({ title: 'Join failed', description: err?.message || String(err) });
    } finally {
      setJoiningId(null);
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '';
    try {
      const d = new Date(iso);
      return d.toLocaleString();
    } catch { return iso; }
  };

  if (loading) return <div className="p-4">Loading groups...</div>;

  const canCreate = !!profile?.isVerified && !loading;

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreate) return;
    setCreateLoading(true);
    try {
      const payload = {
        title: form.title,
        description: '',
        category: form.category,
        tags: form.tags.split(',').map(s => s.trim()).filter(Boolean),
        maxMembers: Number(form.maxMembers),
        hostId: profile?.id,
        eventDate: form.eventDate,
      } as any;

      // include auth token for create
      const token = await getApiToken(getToken);
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/groups', { method: 'POST', headers, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Create failed');
      // prepend created group
      setGroups(prev => [json, ...prev]);
      setOpenCreate(false);
      toast({ title: 'Group created', description: 'Your group was created successfully.' });
    } catch (err: any) {
      toast({ title: 'Create failed', description: err?.message || String(err) });
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2">
          {(profile?.interests || []).map((t) => (
            <span key={t} className="text-sm bg-gray-100 text-gray-800 px-2 py-1 rounded-full">#{t}</span>
          ))}
        </div>
        <div>
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button
                  onClick={() => setOpenCreate(true)}
                  disabled={!canCreate}
                  className={`${canCreate ? 'bg-pink-600 hover:bg-pink-700' : 'bg-gray-200 cursor-not-allowed'} inline-flex items-center gap-2 text-white`}
                >
                  {profile?.isVerified && <CheckCircle className="text-yellow-400" />}
                  Create Group
                </Button>
              </span>
            </TooltipTrigger>
            {!canCreate && (
              <TooltipContent>
                Xác minh danh tính để bắt đầu tạo nhóm hẹn hò của riêng bạn.
              </TooltipContent>
            )}
          </Tooltip>

          <Dialog open={openCreate} onOpenChange={setOpenCreate}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tạo nhóm hẹn hò</DialogTitle>
                <DialogDescription>Điền thông tin cơ bản để tạo nhóm theo sở thích của bạn.</DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateSubmit} className="space-y-4 mt-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Title</label>
                  <input className="w-full border rounded px-3 py-2" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category</label>
                  <select className="w-full border rounded px-3 py-2" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                    <option>Dining</option>
                    <option>Travel</option>
                    <option>Hangout</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
                  <input className="w-full border rounded px-3 py-2" value={form.tags} onChange={e => setForm({ ...form, tags: e.target.value })} placeholder="food, wine, italian" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Event Date</label>
                  <input type="datetime-local" className="w-full border rounded px-3 py-2" value={form.eventDate} onChange={e => setForm({ ...form, eventDate: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Max Members</label>
                  <input type="number" min={2} className="w-full border rounded px-3 py-2" value={String(form.maxMembers)} onChange={e => setForm({ ...form, maxMembers: Number(e.target.value) })} required />
                </div>

                <DialogFooter>
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" onClick={() => setOpenCreate(false)}>Cancel</Button>
                    <Button type="submit" className="bg-pink-600 hover:bg-pink-700 text-white" disabled={createLoading}>{createLoading ? 'Creating...' : 'Create'}</Button>
                  </div>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {annotated.map(({ group, matchCount }) => (
          <article key={group._id} className="bg-white shadow-sm rounded-md p-4">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  {group.title}
                  {group.host?.isVerified && (
                    <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded-md flex items-center gap-1"><CheckCircle size={12}/> Verified Host</span>
                  )}
                </h3>
                <div className="text-sm text-gray-500 flex items-center gap-3 mt-1">
                  <span className="flex items-center gap-1"><MapPin size={14}/> {group.category}</span>
                  <span className="flex items-center gap-1"><Calendar size={14}/> {formatDate(group.eventDate)}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="mb-2">
                  {group.status === 'OPEN' && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">OPEN</span>}
                  {group.status === 'FULL' && <span className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded">FULL</span>}
                  {group.status === 'CLOSED' && <span className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded">CLOSED</span>}
                </div>
                <div className="text-sm text-gray-500">{group.members.length}/{group.maxMembers}</div>
              </div>
            </div>

            <p className="mt-3 text-sm text-gray-700">{group.description}</p>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {group.tags.map((t) => (
                <span key={t} className="text-xs bg-indigo-50 text-indigo-700 px-2 py-1 rounded">{t}</span>
              ))}
              <span className="ml-auto text-xs text-gray-500">Matches: {matchCount}</span>
            </div>

            <div className="mt-3">
              <div className="w-full h-2 bg-gray-100 rounded overflow-hidden">
                <div className="h-full bg-indigo-500" style={{ width: `${Math.min(100, (group.members.length / Math.max(1, group.maxMembers)) * 100)}%` }} />
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={() => handleJoin(group._id)}
                disabled={joiningId === group._id || group.status !== 'OPEN' || (profile && group.members.some(m => String(m) === String(profile.id)))}
                className={`px-3 py-2 rounded-md text-white ${group.status === 'OPEN' ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-300 cursor-not-allowed'}`}>
                {joiningId === group._id ? 'Joining...' : (group.members.some(m => String(m) === String(profile?.id)) ? 'Joined' : 'Join')}
              </button>
              <div className="text-sm text-gray-500">{group.members.length} members</div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
};

export default GroupDating;
