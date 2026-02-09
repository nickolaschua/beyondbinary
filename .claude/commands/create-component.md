# Create Component

Create a new React component with the following specifications:

**Component:** $ARGUMENTS

## Requirements

1. Use functional component with TypeScript
2. Define Props interface above component
3. Use Tailwind CSS for styling
4. Keep component under 200 lines
5. Use named export

## Structure

```typescript
interface ComponentNameProps {
  // props here
}

export function ComponentName({ ...props }: ComponentNameProps) {
  return (
    // JSX here
  );
}
```

## Checklist

- [ ] Props interface defined
- [ ] Component is accessible (proper ARIA labels, keyboard navigation)
- [ ] Loading states handled (if async)
- [ ] Error states handled (if applicable)
- [ ] Responsive design (mobile-first)

## Location

Place in `frontend/src/components/` or appropriate subdirectory based on feature.

Use the frontend design skill for styling guidance.
