import React from 'react';
import { FormInput } from './FormInput';

/**
 * FormInput Component Examples
 * 
 * This file demonstrates various usage patterns for the FormInput component.
 */

export function FormInputExamples() {
  const [textValue, setTextValue] = React.useState('');
  const [emailValue, setEmailValue] = React.useState('');
  const [passwordValue, setPasswordValue] = React.useState('');
  const [numberValue, setNumberValue] = React.useState('');
  const [requiredValue, setRequiredValue] = React.useState('');
  const [errorValue, setErrorValue] = React.useState('invalid@');
  const [hostname, setHostname] = React.useState('');
  const [ipAddress, setIpAddress] = React.useState('');
  const [port, setPort] = React.useState('22');

  // Validation functions
  const validateEmail = (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? '' : 'Invalid email format';
  };

  const validatePort = (value) => {
    const num = parseInt(value);
    if (isNaN(num)) return 'Port must be a number';
    if (num < 1 || num > 65535) return 'Port must be between 1 and 65535';
    return '';
  };

  return (
    <div className="p-8 bg-[#060e20] min-h-screen">
      <h1 className="text-2xl font-bold text-[#dee5ff] mb-8">FormInput Component Examples</h1>

      {/* Basic Input Types */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Input Types</h2>
        
        <div className="space-y-4">
          <FormInput 
            label="Text Input" 
            value={textValue} 
            onChange={setTextValue}
            placeholder="Enter text"
          />

          <FormInput 
            label="Email Input" 
            value={emailValue} 
            onChange={setEmailValue}
            type="email"
            placeholder="user@example.com"
          />

          <FormInput 
            label="Password Input" 
            value={passwordValue} 
            onChange={setPasswordValue}
            type="password"
            placeholder="Enter password"
          />

          <FormInput 
            label="Number Input" 
            value={numberValue} 
            onChange={setNumberValue}
            type="number"
            placeholder="Enter number"
          />
        </div>
      </section>

      {/* Required Fields */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Required Fields</h2>
        
        <div className="space-y-4">
          <FormInput 
            label="Required Field" 
            value={requiredValue} 
            onChange={setRequiredValue}
            placeholder="This field is required"
            required
          />

          <FormInput 
            label="Optional Field" 
            value={textValue} 
            onChange={setTextValue}
            placeholder="This field is optional"
          />
        </div>
      </section>

      {/* Error States */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Error States</h2>
        
        <div className="space-y-4">
          <FormInput 
            label="Email with Error" 
            value={errorValue} 
            onChange={setErrorValue}
            type="email"
            error="Please enter a valid email address"
            required
          />

          <FormInput 
            label="Password with Error" 
            value="short" 
            onChange={() => {}}
            type="password"
            error="Password must be at least 8 characters"
            required
          />
        </div>
      </section>

      {/* Real-World Form Example */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Host Registration Form</h2>
        
        <div className="bg-[#06122d] rounded-lg p-6 space-y-4">
          <FormInput 
            label="Hostname" 
            value={hostname} 
            onChange={setHostname}
            placeholder="server-01"
            required
          />
          
          <FormInput 
            label="IP Address" 
            value={ipAddress} 
            onChange={setIpAddress}
            placeholder="192.168.1.100"
            required
          />
          
          <FormInput 
            label="SSH Port" 
            value={port} 
            onChange={setPort}
            type="number"
            placeholder="22"
          />

          <button className="w-full px-4 py-2 bg-[#7bd0ff] text-[#004560] text-xs font-bold rounded-lg hover:brightness-110 transition-all">
            Register Host
          </button>
        </div>
      </section>

      {/* Login Form Example */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Login Form</h2>
        
        <div className="bg-[#06122d] rounded-lg p-6 space-y-4">
          <FormInput 
            label="Email Address" 
            value={emailValue} 
            onChange={setEmailValue}
            type="email"
            placeholder="admin@patchmaster.local"
            required
          />
          
          <FormInput 
            label="Password" 
            value={passwordValue} 
            onChange={setPasswordValue}
            type="password"
            placeholder="Enter your password"
            required
          />

          <button className="w-full px-4 py-2 bg-[#7bd0ff] text-[#004560] text-xs font-bold rounded-lg hover:brightness-110 transition-all">
            Sign In
          </button>
        </div>
      </section>

      {/* LDAP Configuration Example */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">LDAP Configuration</h2>
        
        <div className="bg-[#06122d] rounded-lg p-6 space-y-4">
          <FormInput 
            label="LDAP Server" 
            value="" 
            onChange={() => {}}
            placeholder="ldap.example.com"
            required
          />
          
          <FormInput 
            label="Port" 
            value="389" 
            onChange={() => {}}
            type="number"
            placeholder="389"
          />
          
          <FormInput 
            label="Bind DN" 
            value="" 
            onChange={() => {}}
            placeholder="cn=admin,dc=example,dc=com"
            required
          />
          
          <FormInput 
            label="Bind Password" 
            value="" 
            onChange={() => {}}
            type="password"
            placeholder="Enter bind password"
            required
          />

          <button className="w-full px-4 py-2 bg-[#7bd0ff] text-[#004560] text-xs font-bold rounded-lg hover:brightness-110 transition-all">
            Test Connection
          </button>
        </div>
      </section>

      {/* Validation Example */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Live Validation</h2>
        
        <div className="bg-[#06122d] rounded-lg p-6 space-y-4">
          <FormInput 
            label="Email with Validation" 
            value={emailValue} 
            onChange={setEmailValue}
            type="email"
            placeholder="user@example.com"
            error={emailValue && validateEmail(emailValue)}
            required
          />
          
          <FormInput 
            label="Port with Validation" 
            value={port} 
            onChange={setPort}
            type="number"
            placeholder="1-65535"
            error={port && validatePort(port)}
            required
          />
        </div>
      </section>

      {/* Custom Styling Example */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Custom Styling</h2>
        
        <div className="space-y-4">
          <FormInput 
            label="With Custom Margin" 
            value="" 
            onChange={() => {}}
            placeholder="Custom margin bottom"
            className="mb-8"
          />

          <FormInput 
            label="With Custom Padding" 
            value="" 
            onChange={() => {}}
            placeholder="Custom padding"
            className="p-4 bg-[#05183c] rounded-lg"
          />
        </div>
      </section>

      {/* Disabled State (Simulated) */}
      <section className="mb-12 max-w-md">
        <h2 className="text-xl font-semibold text-[#dee5ff] mb-4">Read-Only Display</h2>
        
        <div className="bg-[#06122d] rounded-lg p-6 space-y-4">
          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-2">
              System Version
            </label>
            <div className="w-full bg-[#05183c] border border-[#2b4680]/20 rounded-lg py-2 px-4 text-sm text-[#dee5ff]">
              PatchMaster v2.0.0
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-widest font-bold text-[#91aaeb] mb-2">
              License Type
            </label>
            <div className="w-full bg-[#05183c] border border-[#2b4680]/20 rounded-lg py-2 px-4 text-sm text-[#dee5ff]">
              Enterprise
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export default FormInputExamples;
