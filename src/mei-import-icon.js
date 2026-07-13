import React from 'react';
import iconNs from '@ant-design/icons';

const Icon = iconNs.default || iconNs;

export function MeiImportIconComponent() {
  return (
    <svg height="1em" style={{ enableBackground: 'new 0 0 1000 1000' }} width="1em" viewBox="0 0 1000 1000">
      <path
        style={{ fill: 'currentColor' }}
        d="M180 40h420l220 220v620a80 80 0 0 1-80 80H180a80 80 0 0 1-80-80V120a80 80 0 0 1 80-80z
          M580 60v190a40 40 0 0 0 40 40h190"
        fillRule="evenodd"
        />
      <path
        style={{ fill: 'currentColor' }}
        d="M660 380a24 24 0 0 0-30 23v290a95 95 0 1 0 48 82V470l140 45v235a95 95 0 1 0 48 82V500a24 24 0 0 0-17-23z"
        />
    </svg>
  );
}

function MeiImportIcon() {
  return (
    <Icon component={MeiImportIconComponent} />
  );
}

export default MeiImportIcon;
