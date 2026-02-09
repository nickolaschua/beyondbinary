---
name: react-patterns
description: Use when building React components, managing state, or structuring frontend code. Provides patterns and best practices for React + TypeScript development.
---

# React Patterns for Hackathons

Quick reference for building React applications fast without accumulating technical debt.

## Component Structure

### Basic Component Template

```typescript
interface ComponentNameProps {
  title: string;
  onAction: () => void;
  children?: React.ReactNode;
}

export function ComponentName({ title, onAction, children }: ComponentNameProps) {
  return (
    <div className="...">
      <h2>{title}</h2>
      {children}
      <button onClick={onAction}>Action</button>
    </div>
  );
}
```

### File Organization

```
src/
├── components/
│   ├── ui/              # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   └── Card.tsx
│   └── features/        # Feature-specific components
│       ├── auth/
│       └── dashboard/
├── hooks/               # Custom hooks
├── utils/               # Helper functions
├── api/                 # API client functions
└── types/               # Shared TypeScript types
```

## State Management Patterns

### Local State (useState)

Use for: UI state, form inputs, toggles

```typescript
const [isOpen, setIsOpen] = useState(false);
const [formData, setFormData] = useState({ email: '', password: '' });
```

### Derived State (useMemo)

Use for: Computed values from state/props

```typescript
// DON'T: Store derived state
const [filteredItems, setFilteredItems] = useState([]);

// DO: Compute when needed
const filteredItems = useMemo(
  () => items.filter(item => item.active),
  [items]
);
```

### Server State (React Query / SWR)

Use for: API data fetching

```typescript
// With React Query
const { data, isLoading, error } = useQuery({
  queryKey: ['users'],
  queryFn: () => fetch('/api/users').then(r => r.json()),
});

if (isLoading) return <Spinner />;
if (error) return <Error message={error.message} />;
return <UserList users={data} />;
```

### Complex State (useReducer)

Use for: Multiple related state values

```typescript
type State = { count: number; step: number };
type Action = 
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'setStep'; step: number };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment': return { ...state, count: state.count + state.step };
    case 'decrement': return { ...state, count: state.count - state.step };
    case 'setStep': return { ...state, step: action.step };
  }
}

const [state, dispatch] = useReducer(reducer, { count: 0, step: 1 });
```

## Common Patterns

### Loading + Error States

```typescript
function DataComponent() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (error) return <ErrorMessage>{error}</ErrorMessage>;
  if (!data) return <EmptyState />;
  
  return <DataDisplay data={data} />;
}
```

### Form Handling

```typescript
function LoginForm({ onSubmit }: { onSubmit: (data: LoginData) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate
    const newErrors: Record<string, string> = {};
    if (!email) newErrors.email = 'Email required';
    if (!password) newErrors.password = 'Password required';
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    onSubmit({ email, password });
  };

  return (
    <form onSubmit={handleSubmit}>
      <Input 
        value={email} 
        onChange={e => setEmail(e.target.value)}
        error={errors.email}
      />
      <Input 
        type="password"
        value={password} 
        onChange={e => setPassword(e.target.value)}
        error={errors.password}
      />
      <Button type="submit">Login</Button>
    </form>
  );
}
```

### Conditional Rendering

```typescript
// Good: Early returns
function UserProfile({ user }: { user: User | null }) {
  if (!user) return <LoginPrompt />;
  if (user.role === 'admin') return <AdminProfile user={user} />;
  return <StandardProfile user={user} />;
}

// Good: Inline conditionals for simple cases
return (
  <div>
    {isLoading && <Spinner />}
    {error && <ErrorBanner>{error}</ErrorBanner>}
    {data && <DataDisplay data={data} />}
  </div>
);
```

## Performance Quick Wins

### Avoid Unnecessary Rerenders

```typescript
// Memoize expensive components
const ExpensiveList = memo(function ExpensiveList({ items }: Props) {
  return items.map(item => <ExpensiveItem key={item.id} item={item} />);
});

// Memoize callbacks passed to children
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);

// Memoize expensive calculations
const sortedItems = useMemo(
  () => [...items].sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);
```

### Keys in Lists

```typescript
// WRONG: Index as key
{items.map((item, index) => <Item key={index} {...item} />)}

// RIGHT: Stable unique ID
{items.map(item => <Item key={item.id} {...item} />)}
```

## Anti-Patterns to Avoid

| Bad | Why | Instead |
|-----|-----|---------|
| `useEffect` for derived state | Unnecessary renders | `useMemo` |
| Prop drilling 5+ levels | Hard to maintain | Context or composition |
| `any` type | Defeats TypeScript | Proper interfaces |
| Inline object/array props | New reference each render | `useMemo` or extract |
| State for everything | Overcomplicates | Only state that changes |

## Quick Reference: When to Use What

| Situation | Solution |
|-----------|----------|
| Simple UI toggle | `useState` |
| Form with validation | `useState` + handler |
| Data from API | React Query / SWR |
| Complex form state | `useReducer` |
| Shared state across tree | Context |
| Computed from props/state | `useMemo` |
| Stable callback reference | `useCallback` |
