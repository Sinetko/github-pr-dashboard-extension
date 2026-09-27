import { useCallback, useMemo, type FC } from 'react';

import { Button, IconButton, Stack, TextField } from '@shared/ui';

import type { RepositoryListEditorProps } from './repository-list-editor.types';

export const RepositoryListEditor: FC<RepositoryListEditorProps> = ({
  values,
  errors = {},
  onChange,
}) => {
  const rows = useMemo(() => (values.length === 0 ? [''] : values), [values]);

  const setAt = useCallback(
    (index: number, value: string) => {
      onChange(rows.map((current, position) => (position === index ? value : current)));
    },
    [rows, onChange],
  );
  const removeAt = useCallback(
    (index: number) => {
      onChange(rows.filter((_, position) => position !== index));
    },
    [rows, onChange],
  );
  const add = useCallback(() => {
    onChange([...rows, '']);
  }, [rows, onChange]);

  return (
    <Stack gap="xs">
      {rows.map((value, index) => (
        <TextField
          key={index}
          id={`repository-${index}`}
          label={`Repository ${index + 1}`}
          hideLabel
          placeholder="owner/repository"
          value={value}
          error={errors[index] ?? null}
          spellCheck={false}
          autoCapitalize="off"
          onChange={(event) => {
            setAt(index, event.target.value);
          }}
          trailingAction={
            rows.length > 1 ? (
              <IconButton
                label={`Remove repository ${index + 1}`}
                icon="✕"
                onClick={() => {
                  removeAt(index);
                }}
              />
            ) : undefined
          }
        />
      ))}
      <div>
        <Button size="sm" variant="ghost" onClick={add}>
          + Add repository
        </Button>
      </div>
    </Stack>
  );
};
