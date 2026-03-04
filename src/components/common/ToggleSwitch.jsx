import React from 'react';

const ToggleSwitch = ({ checked, onChange, disabled = false, size = 'default' }) => {
  const sizes = {
    small: { width: 36, height: 20, thumbSize: 14 },
    default: { width: 44, height: 24, thumbSize: 18 },
    large: { width: 52, height: 28, thumbSize: 22 }
  };

  const currentSize = sizes[size] || sizes.default;
  const thumbOffset = (currentSize.height - currentSize.thumbSize) / 2;
  const translateX = currentSize.width - currentSize.thumbSize - thumbOffset;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: `${currentSize.width}px`,
        height: `${currentSize.height}px`,
        backgroundColor: checked ? '#2563EB' : '#30363D',
        borderRadius: `${currentSize.height}px`,
        border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 0.2s ease',
        opacity: disabled ? 0.5 : 1,
        padding: 0
      }}
    >
      <span
        style={{
          position: 'absolute',
          left: `${thumbOffset}px`,
          width: `${currentSize.thumbSize}px`,
          height: `${currentSize.thumbSize}px`,
          backgroundColor: 'white',
          borderRadius: '50%',
          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
          transition: 'transform 0.2s ease',
          transform: checked ? `translateX(${translateX}px)` : 'translateX(0)'
        }}
      />
    </button>
  );
};

export default ToggleSwitch;
