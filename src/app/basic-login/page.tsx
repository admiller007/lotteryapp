"use client";
import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';

export default function BasicLogin() {
  const { dispatch } = useAppContext();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = () => {
    console.log('Login clicked');
    
    if (!firstName || !lastName || !facilityName || !pin) {
      setMessage('Please fill all fields');
      return;
    }

    console.log('Attempting login with:', { firstName, lastName, facilityName, pin });

    // Try admin login first
    if (firstName === 'Admin' && lastName === 'User' && facilityName === 'Admin Office' && pin === 'admin123') {
      console.log('Admin login successful');
      setMessage('Admin login successful! Redirecting...');
      
      // Directly set a user in context to bypass the complex lookup
      dispatch({
        type: 'LOGIN_USER',
        payload: { firstName: 'Admin', lastName: 'User', facilityName: 'Admin Office', pin: 'admin123' }
      });
      
      setTimeout(() => {
        window.location.href = '/admin';
      }, 1000);
      return;
    }

    setMessage('Invalid credentials');
  };

  return (
    <div style={{ padding: '40px', maxWidth: '400px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>Basic Login</h1>
      
      {message && (
        <div style={{ 
          padding: '10px', 
          marginBottom: '20px', 
          backgroundColor: '#f0f0f0', 
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}>
          {message}
        </div>
      )}

      <div style={{ marginBottom: '15px' }}>
        <label>First Name:</label>
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '8px', 
            border: '1px solid #ccc',
            borderRadius: '4px',
            marginTop: '5px'
          }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>Last Name:</label>
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '8px', 
            border: '1px solid #ccc',
            borderRadius: '4px',
            marginTop: '5px'
          }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label>Facility Name:</label>
        <input
          type="text"
          value={facilityName}
          onChange={(e) => setFacilityName(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '8px', 
            border: '1px solid #ccc',
            borderRadius: '4px',
            marginTop: '5px'
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label>PIN:</label>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          style={{ 
            width: '100%', 
            padding: '8px', 
            border: '1px solid #ccc',
            borderRadius: '4px',
            marginTop: '5px'
          }}
        />
      </div>

      <button
        onClick={handleLogin}
        style={{
          width: '100%',
          padding: '12px',
          backgroundColor: '#0070f3',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '16px',
          cursor: 'pointer'
        }}
      >
        Login
      </button>

      <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
        <p><strong>Test credentials:</strong></p>
        <p>First Name: Admin</p>
        <p>Last Name: User</p>
        <p>Facility: Admin Office</p>
        <p>PIN: admin123</p>
      </div>
    </div>
  );
}