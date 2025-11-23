import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Pin, PinOff, Trash2, Search, Tag, Save, Edit2 } from 'lucide-react';
import supabase from '../utils/supabase';
import { Note } from '../types';

interface NotesProps {}

const emptyNote = (): Note => ({
  id: '',
  title: '',
  content: '',
  pinned: false,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  tags: [],
});

const Notes: React.FC<NotesProps> = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Note | null>(null);
  const [tagInput, setTagInput] = useState('');
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id || '';
      setUserId(uid);
      if (uid) {
        loadNotes(uid);
      }
    });
  }, []);

  const loadNotes = async (uid: string) => {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .eq('user_id', uid)
      .order('pinned', { ascending: false })
      .order('updated_at', { ascending: false });
    if (!error) {
      const mapped: Note[] = (data || []).map((n: any) => ({
        id: n.id,
        title: n.title ?? '',
        content: n.content ?? '',
        pinned: !!n.pinned,
        tags: n.tags ?? [],
        createdAt: n.created_at ?? new Date().toISOString(),
        updatedAt: n.updated_at ?? new Date().toISOString(),
      }));
      setNotes(mapped);
    }
  };

  const startCreate = () => {
    const newDraft = emptyNote();
    setEditingId('new');
    setDraft(newDraft);
  };

  const startEdit = (note: Note) => {
    setEditingId(note.id);
    setDraft({ ...note });
    setTagInput('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft(null);
    setTagInput('');
  };

  const saveNote = async () => {
    if (!draft || !userId) return;
    const trimmedTitle = draft.title.trim();
    const trimmedContent = draft.content.trim();
    if (!trimmedTitle && !trimmedContent) {
      cancelEdit();
      return;
    }

    if (!draft.id) {
      // insert
      const { data, error } = await supabase
        .from('notes')
        .insert({
          user_id: userId,
          title: trimmedTitle,
          content: trimmedContent,
          pinned: draft.pinned,
          tags: draft.tags ?? [],
        })
        .select()
        .single();
      if (!error && data) {
        const newNote: Note = {
          id: data.id,
          title: data.title ?? '',
          content: data.content ?? '',
          pinned: !!data.pinned,
          tags: data.tags ?? [],
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
        setNotes((prev) => [newNote, ...prev]);
      }
    } else {
      // update
      const { data, error } = await supabase
        .from('notes')
        .update({
          title: trimmedTitle,
          content: trimmedContent,
          pinned: draft.pinned,
          tags: draft.tags ?? [],
          updated_at: new Date().toISOString(),
        })
        .eq('id', draft.id)
        .eq('user_id', userId)
        .select()
        .single();
      if (!error && data) {
        const updated: Note = {
          id: data.id,
          title: data.title ?? '',
          content: data.content ?? '',
          pinned: !!data.pinned,
          tags: data.tags ?? [],
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        };
        setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      }
    }

    cancelEdit();
  };

  const deleteNote = async (id: string) => {
    if (!userId) return;
    const { error } = await supabase.from('notes').delete().eq('id', id).eq('user_id', userId);
    if (!error) {
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (editingId === id) cancelEdit();
    }
  };

  const togglePin = async (id: string) => {
    if (!userId) return;
    const note = notes.find((n) => n.id === id);
    if (!note) return;
    const { data, error } = await supabase
      .from('notes')
      .update({ pinned: !note.pinned, updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();
    if (!error && data) {
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, pinned: data.pinned, updatedAt: data.updated_at } : n)));
    }
  };

  const addTag = () => {
    if (!draft) return;
    const t = tagInput.trim();
    if (!t) return;
    const updated = { ...draft, tags: Array.from(new Set([...(draft.tags || []), t])) };
    setDraft(updated);
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    if (!draft) return;
    const updated = { ...draft, tags: (draft.tags || []).filter((t) => t !== tag) };
    setDraft(updated);
  };

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    const list = notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.content.toLowerCase().includes(q) ||
        (n.tags || []).some((t) => t.toLowerCase().includes(q))
    );
    const pinned = list.filter((n) => n.pinned);
    const others = list.filter((n) => !n.pinned);
    // sort by updatedAt desc
    const byDateDesc = (a: Note, b: Note) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    return { pinned: pinned.sort(byDateDesc), others: others.sort(byDateDesc) };
  }, [notes, query]);

  const renderEditor = () => (
    <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow">
      <input
        className="w-full mb-3 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white outline-none"
        placeholder="Title"
        value={draft?.title || ''}
        onChange={(e) => setDraft((d) => ({ ...(d as Note), title: e.target.value }))}
      />
      <textarea
        className="w-full min-h-[120px] px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white outline-none"
        placeholder="Write your note..."
        value={draft?.content || ''}
        onChange={(e) => setDraft((d) => ({ ...(d as Note), content: e.target.value }))}
      />
      <div className="flex items-center gap-2 mt-3">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-gray-500" />
          <input
            className="px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 text-sm"
            placeholder="Add tag"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addTag()}
          />
          <button onClick={addTag} className="text-sm px-2 py-1 bg-gray-200 dark:bg-gray-600 rounded">
            Add
          </button>
        </div>
        <div className="flex flex-wrap gap-2 ml-2">
          {(draft?.tags || []).map((t) => (
            <span
              key={t}
              className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded cursor-pointer"
              onClick={() => removeTag(t)}
            >
              #{t}
            </span>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={saveNote} className="flex items-center gap-1 px-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded">
            <Save className="w-4 h-4" /> Save
          </button>
          <button onClick={cancelEdit} className="px-3 py-2 bg-gray-200 dark:bg-gray-700 rounded">Cancel</button>
        </div>
      </div>
    </div>
  );

  const renderCard = (note: Note) => (
    <div
      key={note.id}
      className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow border border-gray-200 dark:border-gray-700"
    >
      <div className="flex items-start justify-between">
        <div>
          <h4 className="font-semibold text-gray-900 dark:text-white">{note.title || 'Untitled'}</h4>
          <p className="text-sm text-gray-600 dark:text-gray-300 whitespace-pre-wrap mt-1">{note.content || '—'}</p>
          <div className="mt-2 flex flex-wrap gap-1">
            {(note.tags || []).map((t) => (
              <span
                key={t}
                className="px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded"
              >
                #{t}
              </span>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={() => togglePin(note.id)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Pin"
          >
            {note.pinned ? (
              <Pin className="w-4 h-4 text-blue-500" />
            ) : (
              <PinOff className="w-4 h-4 text-gray-500" />
            )}
          </button>
          <button
            onClick={() => startEdit(note)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
            aria-label="Edit"
          >
            <Edit2 className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => deleteNote(note.id)}
            className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
            aria-label="Delete"
          >
            <Trash2 className="w-4 h-4 text-red-500" />
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
        Updated {new Date(note.updatedAt).toLocaleString()}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Notes</h1>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search notes..."
                className="pl-9 pr-3 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm"
              />
            </div>
            <button
              onClick={startCreate}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-xl"
            >
              <Plus className="w-4 h-4" /> New
            </button>
          </div>
        </div>

        {editingId && draft ? renderEditor() : null}

        {filtered.pinned.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">Pinned</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.pinned.map(renderCard)}
            </div>
          </div>
        )}

        <div>
          {filtered.others.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.others.map(renderCard)}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-600 dark:text-gray-400">No notes yet</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Notes; 