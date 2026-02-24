import { render, screen } from '@solidjs/testing-library';
import { describe, it, expect } from 'vitest';
import App from './app';
import { TaskProvider } from './store/taskStore';

describe('App', () => {
  it('renders without crashing', () => {
    render(() => (
      <TaskProvider>
        <App />
      </TaskProvider>
    ));
    // Since App renders Dashboard, and Dashboard renders Inbox by default
    expect(screen.getByRole('heading', { name: /Inbox/i })).toBeInTheDocument();
  });
});
