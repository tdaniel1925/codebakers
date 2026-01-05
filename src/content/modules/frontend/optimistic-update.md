# Optimistic Updates

> Copy-paste ready. Instant UI feedback before server response.

## Optimistic Toggle with SWR

```typescript
// components/todo-item.tsx
'use client';

import useSWR, { mutate } from 'swr';

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

export function TodoItem({ todo }: { todo: Todo }) {
  async function toggleComplete() {
    const newCompleted = !todo.completed;

    // Optimistic update - update UI immediately
    mutate(
      '/api/todos',
      (current: { todos: Todo[] } | undefined) => ({
        todos: current?.todos.map((t) =>
          t.id === todo.id ? { ...t, completed: newCompleted } : t
        ) || [],
      }),
      false // Don't revalidate yet
    );

    try {
      // Then update server
      await fetch(`/api/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: newCompleted }),
      });

      // Revalidate to sync with server
      mutate('/api/todos');
    } catch (error) {
      // Rollback on error
      mutate('/api/todos');
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 border rounded">
      <input
        type="checkbox"
        checked={todo.completed}
        onChange={toggleComplete}
        className="h-5 w-5"
      />
      <span className={todo.completed ? 'line-through text-gray-400' : ''}>
        {todo.title}
      </span>
    </div>
  );
}
```

## Optimistic Add with useOptimistic

```typescript
// components/comment-section.tsx
'use client';

import { useOptimistic, useRef } from 'react';
import { addComment } from './actions';

interface Comment {
  id: string;
  content: string;
  author: string;
  pending?: boolean;
}

export function CommentSection({
  postId,
  initialComments
}: {
  postId: string;
  initialComments: Comment[]
}) {
  const formRef = useRef<HTMLFormElement>(null);

  const [optimisticComments, addOptimisticComment] = useOptimistic(
    initialComments,
    (state, newComment: Comment) => [...state, newComment]
  );

  async function handleSubmit(formData: FormData) {
    const content = formData.get('content') as string;

    // Add optimistic comment immediately
    addOptimisticComment({
      id: `temp-${Date.now()}`,
      content,
      author: 'You',
      pending: true,
    });

    formRef.current?.reset();

    // Actually create on server
    await addComment(postId, content);
  }

  return (
    <div className="space-y-4">
      <form ref={formRef} action={handleSubmit} className="flex gap-2">
        <input
          name="content"
          placeholder="Add a comment..."
          className="flex-1 border rounded px-3 py-2"
        />
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Post
        </button>
      </form>

      <div className="space-y-3">
        {optimisticComments.map((comment) => (
          <div
            key={comment.id}
            className={`p-3 border rounded ${
              comment.pending ? 'opacity-50' : ''
            }`}
          >
            <p className="font-medium">{comment.author}</p>
            <p>{comment.content}</p>
            {comment.pending && (
              <span className="text-xs text-gray-400">Posting...</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Optimistic Delete

```typescript
// components/item-list.tsx
'use client';

import { useState } from 'react';

interface Item {
  id: string;
  name: string;
}

export function ItemList({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(id: string) {
    const itemToDelete = items.find((i) => i.id === id);
    if (!itemToDelete) return;

    // Optimistic remove
    setItems((prev) => prev.filter((i) => i.id !== id));
    setDeletingId(id);

    try {
      const res = await fetch(`/api/items/${id}`, { method: 'DELETE' });

      if (!res.ok) {
        throw new Error('Delete failed');
      }
    } catch (error) {
      // Rollback on error
      setItems((prev) => [...prev, itemToDelete].sort((a, b) =>
        a.id.localeCompare(b.id)
      ));
      alert('Failed to delete item');
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.id} className="flex justify-between p-3 border rounded">
          <span>{item.name}</span>
          <button
            onClick={() => handleDelete(item.id)}
            disabled={deletingId === item.id}
            className="text-red-600 hover:underline disabled:opacity-50"
          >
            Delete
          </button>
        </li>
      ))}
    </ul>
  );
}
```

## Optimistic Like Button

```typescript
// components/like-button.tsx
'use client';

import { useState } from 'react';

interface LikeButtonProps {
  postId: string;
  initialLiked: boolean;
  initialCount: number;
}

export function LikeButton({ postId, initialLiked, initialCount }: LikeButtonProps) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [isUpdating, setIsUpdating] = useState(false);

  async function handleLike() {
    const newLiked = !liked;
    const newCount = newLiked ? count + 1 : count - 1;

    // Optimistic update
    setLiked(newLiked);
    setCount(newCount);
    setIsUpdating(true);

    try {
      await fetch(`/api/posts/${postId}/like`, {
        method: newLiked ? 'POST' : 'DELETE',
      });
    } catch (error) {
      // Rollback
      setLiked(liked);
      setCount(count);
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <button
      onClick={handleLike}
      disabled={isUpdating}
      className={`flex items-center gap-2 px-3 py-1 rounded ${
        liked ? 'bg-red-100 text-red-600' : 'bg-gray-100'
      }`}
    >
      <span>{liked ? '❤️' : '🤍'}</span>
      <span>{count}</span>
    </button>
  );
}
```

## Test

```typescript
// components/like-button.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LikeButton } from './like-button';

describe('LikeButton', () => {
  it('updates optimistically on click', async () => {
    global.fetch = jest.fn().mockResolvedValueOnce({ ok: true });

    render(<LikeButton postId="1" initialLiked={false} initialCount={5} />);

    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('🤍')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button'));

    // Should update immediately (optimistic)
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('❤️')).toBeInTheDocument();
  });

  it('rolls back on error', async () => {
    global.fetch = jest.fn().mockRejectedValueOnce(new Error('Failed'));

    render(<LikeButton postId="1" initialLiked={false} initialCount={5} />);

    await userEvent.click(screen.getByRole('button'));

    // Optimistic update
    expect(screen.getByText('6')).toBeInTheDocument();

    // Wait for rollback
    await waitFor(() => {
      expect(screen.getByText('5')).toBeInTheDocument();
    });
  });
});
```

## Usage
Always update UI first, then sync with server. Handle errors by rolling back to previous state.
