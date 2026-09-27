import { useCallback, type FC } from 'react';

import { SwitchDescription, SwitchLabel, SwitchRow, SwitchText, Track } from './switch.styles';

import type { SwitchProps } from './switch.types';

export const Switch: FC<SwitchProps> = ({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
}) => {
  const handleClick = useCallback(() => {
    onChange(!checked);
  }, [checked, onChange]);
  const descriptionId = `${id}-description`;
  return (
    <SwitchRow>
      <SwitchText>
        <SwitchLabel htmlFor={id}>{label}</SwitchLabel>
        {description === undefined ? null : (
          <SwitchDescription id={descriptionId}>{description}</SwitchDescription>
        )}
      </SwitchText>
      <Track
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description === undefined ? undefined : descriptionId}
        disabled={disabled}
        $checked={checked}
        onClick={handleClick}
      />
    </SwitchRow>
  );
};
