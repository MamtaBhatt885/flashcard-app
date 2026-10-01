import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeckForm } from './DeckForm';

afterEach(cleanup);

function setup(props: Partial<Parameters<typeof DeckForm>[0]> = {}) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const user = userEvent.setup();
  render(<DeckForm mode="create" onSubmit={onSubmit} onCancel={onCancel} {...props} />);
  const title = screen.getByLabelText('Title') as HTMLInputElement;
  const description = screen.getByLabelText('Description (optional)') as HTMLTextAreaElement;
  return { user, onSubmit, onCancel, title, description };
}

describe('DeckForm', () => {
  it('renders labeled fields', () => {
    const { title, description } = setup();
    expect(title.tagName).toBe('INPUT');
    expect(description.tagName).toBe('TEXTAREA');
  });

  it('is controlled: typing updates the value and the character counter', async () => {
    const { user, title } = setup();
    await user.type(title, 'Spanish');
    expect(title.value).toBe('Spanish');
    expect(screen.getByText('7/120')).toBeTruthy();
  });

  it('blocks an empty submit, shows the schema error, and focuses the field', async () => {
    const { user, onSubmit, title } = setup();
    await user.click(screen.getByRole('button', { name: 'Create deck' }));
    expect(onSubmit).not.toHaveBeenCalled();
    const error = screen.getByText('Title is required');
    expect(title.getAttribute('aria-invalid')).toBe('true');
    expect(title.getAttribute('aria-describedby')).toContain(error.id);
    expect(document.activeElement).toBe(title);
  });

  it('hides errors until the field is touched, then updates them live', async () => {
    const { user, title, description } = setup();
    expect(screen.queryByText('Title is required')).toBeNull();
    await user.click(title);
    await user.click(description); // blur title
    expect(screen.getByText('Title is required')).toBeTruthy();
    await user.type(title, 'A');
    expect(screen.queryByText('Title is required')).toBeNull();
  });

  it('treats a whitespace-only title as empty (schema trims)', async () => {
    const { user, onSubmit, title } = setup();
    await user.type(title, '    ');
    await user.click(screen.getByRole('button', { name: 'Create deck' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Title is required')).toBeTruthy();
  });

  it('enforces the shared max length', async () => {
    const { user, onSubmit, title } = setup();
    await user.click(title);
    await user.paste('x'.repeat(121));
    await user.click(screen.getByRole('button', { name: 'Create deck' }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText('Title must be 120 characters or fewer')).toBeTruthy();
    expect(screen.getByText('121/120').className).toContain('text-red');
  });

  it('submits trimmed values and omits a blank description', async () => {
    const { user, onSubmit, title, description } = setup();
    await user.type(title, '  Biology  ');
    await user.type(description, '   ');
    await user.click(screen.getByRole('button', { name: 'Create deck' }));
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Biology', description: undefined });
  });

  it('edit mode: prefilled, Save disabled until something changes', async () => {
    const { user, onSubmit, title, description } = setup({
      mode: 'edit',
      initialValues: { title: 'Spanish', description: null },
    });
    expect(title.value).toBe('Spanish');
    expect(description.value).toBe('');
    const save = screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await user.type(title, ' Basics');
    expect(save.disabled).toBe(false);
    await user.click(save);
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Spanish Basics', description: undefined });
  });

  it('shows a server error and wires up Cancel', async () => {
    const { user, onCancel } = setup({ serverError: 'Can’t reach the server' });
    expect(screen.getByRole('alert').textContent).toBe('Can’t reach the server');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  // ---- added in the critique pass ----
  it('can’t be double-submitted while the save is in flight', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    const { rerender } = render(<DeckForm mode="create" onSubmit={onSubmit} />);
    await user.type(screen.getByLabelText('Title'), 'Biology');
    await user.click(screen.getByRole('button', { name: 'Create deck' }));
    rerender(<DeckForm mode="create" onSubmit={onSubmit} pending />);
    const button = screen.getByRole('button', { name: /Create deck/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    await user.click(button);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('keeps what you typed when the server rejects it (e.g. 409 duplicate title)', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DeckForm mode="create" onSubmit={vi.fn()} />);
    await user.type(screen.getByLabelText('Title'), 'Chemistry');
    await user.type(screen.getByLabelText('Description (optional)'), 'Atoms');
    rerender(<DeckForm mode="create" onSubmit={vi.fn()} serverError="You already have a deck named “Chemistry”" />);
    expect(screen.getByRole('alert').textContent).toMatch(/already have a deck/);
    expect((screen.getByLabelText('Title') as HTMLInputElement).value).toBe('Chemistry');
    expect((screen.getByLabelText('Description (optional)') as HTMLTextAreaElement).value).toBe('Atoms');
  });
});
