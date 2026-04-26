import React from 'react';
import { Icon, getValidIconNames } from './Icon';

/**
 * IconDemo - Visual demonstration of the Icon component
 * 
 * This component displays all available Material Symbols icons
 * with their names for visual verification and reference.
 * 
 * Usage: Import and render this component in a test page or Storybook
 */
export function IconDemo() {
  const iconNames = getValidIconNames();
  
  // Common PatchMaster icons for quick reference
  const commonIcons = [
    'dashboard', 'dns', 'system_update', 'terminal', 'security',
    'backup', 'policy', 'monitoring', 'analytics', 'settings',
    'group', 'notifications', 'search', 'filter_list', 'refresh',
    'add', 'edit', 'delete', 'download', 'upload',
    'check_circle', 'warning', 'error', 'info'
  ];

  return (
    <div style={{ padding: '2rem', fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '1rem' }}>
        Material Symbols Icon Demo
      </h1>
      
      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
          Configuration Test
        </h2>
        <div style={{ 
          display: 'flex', 
          gap: '2rem', 
          padding: '1.5rem', 
          background: '#f3f4f6', 
          borderRadius: '8px' 
        }}>
          <div>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Default (24px, weight 400, fill 0, grade 0)
            </p>
            <Icon name="dashboard" />
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Size 20px
            </p>
            <Icon name="dashboard" size={20} />
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Weight 600
            </p>
            <Icon name="dashboard" weight={600} />
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Fill 1 (filled)
            </p>
            <Icon name="dashboard" fill={1} />
          </div>
          <div>
            <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '0.5rem' }}>
              Grade 200
            </p>
            <Icon name="dashboard" grade={200} />
          </div>
        </div>
      </div>

      <div style={{ marginBottom: '3rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
          Common PatchMaster Icons
        </h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', 
          gap: '1rem' 
        }}>
          {commonIcons.map(name => (
            <div 
              key={name}
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                padding: '1rem',
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                gap: '0.5rem'
              }}
            >
              <Icon name={name} size={24} />
              <span style={{ fontSize: '0.75rem', color: '#6b7280', textAlign: 'center' }}>
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem' }}>
          All Available Icons ({iconNames.length})
        </h2>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', 
          gap: '0.75rem' 
        }}>
          {iconNames.map(name => (
            <div 
              key={name}
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center', 
                padding: '0.75rem',
                background: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                gap: '0.5rem'
              }}
            >
              <Icon name={name} size={20} />
              <span style={{ fontSize: '0.625rem', color: '#9ca3af', textAlign: 'center' }}>
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default IconDemo;
