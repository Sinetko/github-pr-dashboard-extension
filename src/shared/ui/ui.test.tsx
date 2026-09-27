import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type FC } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithTheme } from '@test/render';

import {
  Avatar,
  Banner,
  Button,
  Collapsible,
  EmptyState,
  IconButton,
  Pill,
  SegmentedControl,
  Select,
  Spinner,
  Stack,
  Switch,
  TabPanel,
  Tabs,
  TextField,
} from '.';
import { initialsFor } from './avatar/avatar.model';
import { nextTabIndex } from './tabs/tabs.model';

type TabValue = 'all' | 'mine' | 'team';
const TAB_ITEMS = [
  { value: 'all', label: 'All', count: 4 },
  { value: 'mine', label: 'Mine' },
  { value: 'team', label: 'Team' },
] as const;

const ControlledTabs: FC = () => {
  const [value, setValue] = useState<TabValue>('all');
  return (
    <>
      <Tabs items={TAB_ITEMS} value={value} onChange={setValue} label="Views" idPrefix="views" />
      <TabPanel idPrefix="views" value={value}>
        panel:{value}
      </TabPanel>
    </>
  );
};

describe('Button', () => {
  it('fires onClick and defaults to type=button', async () => {
    const onClick = vi.fn();
    renderWithTheme(<Button onClick={onClick}>Save</Button>);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('type', 'button');
    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is disabled and busy while loading', async () => {
    const onClick = vi.fn();
    renderWithTheme(
      <Button variant="primary" isLoading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders every variant', () => {
    renderWithTheme(
      <Stack>
        <Button variant="danger">d</Button>
        <Button variant="ghost" size="sm" fullWidth>
          g
        </Button>
      </Stack>,
    );
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });
});

describe('IconButton', () => {
  it('uses its label as the accessible name', () => {
    renderWithTheme(<IconButton label="Refresh" icon="↻" isActive />);
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
  });
});

describe('Tabs', () => {
  it('selects on click and supports arrow/Home/End keys with wrap-around', async () => {
    renderWithTheme(<ControlledTabs />);
    expect(screen.getByRole('tab', { name: 'All (4)' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('panel:all');

    await userEvent.click(screen.getByRole('tab', { name: 'Mine' }));
    expect(screen.getByRole('tabpanel')).toHaveTextContent('panel:mine');

    const tabList = screen.getByRole('tablist', { name: 'Views' });
    fireEvent.keyDown(tabList, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Team' })).toHaveFocus();
    fireEvent.keyDown(tabList, { key: 'ArrowRight' });
    expect(screen.getByRole('tabpanel')).toHaveTextContent('panel:all');
    fireEvent.keyDown(tabList, { key: 'End' });
    expect(screen.getByRole('tabpanel')).toHaveTextContent('panel:team');
    fireEvent.keyDown(tabList, { key: 'a' });
    expect(screen.getByRole('tabpanel')).toHaveTextContent('panel:team');
  });

  it('computes navigation indices', () => {
    expect(nextTabIndex('ArrowLeft', 0, 3)).toBe(2);
    expect(nextTabIndex('Home', 2, 3)).toBe(0);
    expect(nextTabIndex('Enter', 1, 3)).toBeNull();
  });
});

describe('TextField', () => {
  it('links label, hint and error for assistive tech', () => {
    renderWithTheme(
      <TextField id="token" label="Token" hint="Needs repo scope" error="Invalid token" />,
    );
    const input = screen.getByLabelText('Token');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', 'token-hint token-error');
    expect(screen.getByRole('alert')).toHaveTextContent('Invalid token');
  });

  it('has no description when neither hint nor error is set', () => {
    renderWithTheme(<TextField id="query" label="Search" hideLabel error={null} />);
    const input = screen.getByLabelText('Search');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(input).not.toHaveAttribute('aria-invalid');
  });
});

describe('Switch', () => {
  it('reports the toggled value', async () => {
    const onChange = vi.fn();
    renderWithTheme(
      <Switch
        id="sound"
        label="Play sound"
        description="On new events"
        checked={false}
        onChange={onChange}
      />,
    );
    const toggle = screen.getByRole('switch', { name: 'Play sound' });
    expect(toggle).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(toggle);
    expect(onChange).toHaveBeenCalledWith(true);
  });
});

describe('Select', () => {
  it('emits the typed option value', async () => {
    const onChange = vi.fn();
    renderWithTheme(
      <Select
        id="sort"
        label="Sort"
        options={[
          { value: 'created', label: 'Created' },
          { value: 'updated', label: 'Updated' },
        ]}
        value="created"
        onChange={onChange}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Sort'), 'Updated');
    expect(onChange).toHaveBeenCalledWith('updated');
  });
});

describe('SegmentedControl', () => {
  it('behaves as a radio group', async () => {
    const onChange = vi.fn();
    renderWithTheme(
      <SegmentedControl
        label="Drafts"
        options={[
          { value: 'all', label: 'All' },
          { value: 'hide', label: 'Hide' },
        ]}
        value="all"
        onChange={onChange}
      />,
    );
    expect(screen.getByRole('radio', { name: 'All' })).toHaveAttribute('aria-checked', 'true');
    await userEvent.click(screen.getByRole('radio', { name: 'Hide' }));
    expect(onChange).toHaveBeenCalledWith('hide');
  });
});

describe('Avatar', () => {
  it('falls back to initials when the image fails', () => {
    renderWithTheme(<Avatar src="https://example.invalid/a.png" name="octo cat" />);
    fireEvent.error(screen.getByRole('img', { name: 'octo cat' }));
    expect(screen.getByRole('img', { name: 'octo cat' })).toHaveTextContent('OC');
  });

  it('renders initials without a source', () => {
    renderWithTheme(<Avatar src={null} name="ghost" size={32} />);
    expect(screen.getByRole('img', { name: 'ghost' })).toHaveTextContent('G');
  });

  it('computes initials', () => {
    expect(initialsFor('mona-lisa_octocat')).toBe('ML');
    expect(initialsFor('   ')).toBe('?');
  });
});

describe('Collapsible', () => {
  it('toggles and hides content when closed', async () => {
    const onToggle = vi.fn();
    const { rerender } = renderWithTheme(
      <Collapsible id="stats" title="Stats" isOpen={false} onToggle={onToggle}>
        body
      </Collapsible>,
    );
    expect(screen.queryByText('body')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Stats/ }));
    expect(onToggle).toHaveBeenCalledWith(true);
    rerender(
      <Collapsible id="stats" title="Stats" isOpen onToggle={onToggle}>
        body
      </Collapsible>,
    );
    expect(screen.getByRole('button', { name: /Stats/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('body')).toBeVisible();
  });
});

describe('status primitives', () => {
  it('renders pill, banner, spinner and empty state accessibly', () => {
    renderWithTheme(
      <Stack direction="row" gap="md" align="center" justify="space-between" wrap as="section">
        <Pill tone="danger" title="Checks failed">
          failing
        </Pill>
        <Banner tone="danger" title="Rate limited" action={<Button>Retry</Button>}>
          Resuming at 14:05
        </Banner>
        <Banner title="Synced" />
        <Spinner size="lg" />
        <EmptyState
          title="No pull requests"
          description="Nothing to review"
          action={<Button>Add repo</Button>}
        />
      </Stack>,
    );
    expect(screen.getByTitle('Checks failed')).toHaveTextContent('failing');
    expect(screen.getByRole('alert')).toHaveTextContent('Rate limited');
    expect(screen.getAllByRole('status')).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'No pull requests' })).toBeInTheDocument();
  });
});
