import { ErrorText, Field, Hint, Input, InputRow, Label } from './text-field.styles';

import type { TextFieldProps } from './text-field.types';
import type { FC } from 'react';

export const TextField: FC<TextFieldProps> = ({
  id,
  label,
  hideLabel = false,
  hint,
  error,
  trailingAction,
  ...inputProps
}) => {
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const hasError = error !== undefined && error !== null && error !== '';
  const describedBy = [hint === undefined ? null : hintId, hasError ? errorId : null]
    .filter((value) => value !== null)
    .join(' ');
  return (
    <Field>
      <Label htmlFor={id} $isHidden={hideLabel}>
        {label}
      </Label>
      <InputRow>
        <Input
          {...inputProps}
          id={id}
          $hasError={hasError}
          aria-invalid={hasError || undefined}
          aria-describedby={describedBy === '' ? undefined : describedBy}
        />
        {trailingAction}
      </InputRow>
      {hint === undefined ? null : <Hint id={hintId}>{hint}</Hint>}
      {hasError ? (
        <ErrorText id={errorId} role="alert">
          {error}
        </ErrorText>
      ) : null}
    </Field>
  );
};
