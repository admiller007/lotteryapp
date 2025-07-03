
"use client";
import { useState } from 'react';
import { useAppContext } from '@/context/AppContext';
import { findCSVUser } from '@/lib/firebaseService';

export default function LoginPage() {
  const { dispatch } = useAppContext();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [facilityName, setFacilityName] = useState('');
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState('');

  const handleLogin = async () => {
    console.log('Login clicked');
    
    if (!firstName.trim() || !lastName.trim() || !facilityName.trim() || !pin.trim()) {
      setMessage("Please fill in all fields.");
      return;
    }

    const userName = `${firstName.trim()} ${lastName.trim()}`;
    
    console.log('Checking login for:', {
      userName,
      facilityName: facilityName.trim(),
      pin: pin.trim()
    });
    
    try {
      // Check for hardcoded admin users first
      if (userName === 'Admin User' && facilityName.trim() === 'Admin Office' && pin.trim() === 'admin123') {
        console.log('Admin User match found');
        setMessage('Admin login successful! Redirecting...');
        
        dispatch({
          type: 'LOGIN_USER',
          payload: { firstName: 'Admin', lastName: 'User', facilityName: 'Admin Office', pin: 'admin123' }
        });
        
        setTimeout(() => {
          window.location.href = '/admin';
        }, 1000);
        return;
      }
      
      if (userName === 'Developer Admin' && facilityName.trim() === 'Dev Office' && pin.trim() === 'dev456') {
        console.log('Developer Admin match found');
        setMessage('Developer admin login successful! Redirecting...');
        
        dispatch({
          type: 'LOGIN_USER',
          payload: { firstName: 'Developer', lastName: 'Admin', facilityName: 'Dev Office', pin: 'dev456' }
        });
        
        setTimeout(() => {
          window.location.href = '/admin';
        }, 1000);
        return;
      }

      // Check Firebase for CSV user
      const firebaseUser = await findCSVUser(
        firstName.trim(),
        lastName.trim(), 
        facilityName.trim(),
        pin.trim()
      );

      if (firebaseUser) {
        console.log('Firebase user found:', firebaseUser);
        setMessage(`Welcome, ${firebaseUser.name}! Redirecting...`);
        
        // Add Firebase user to context and login
        dispatch({
          type: 'ADD_FIREBASE_USER',
          payload: {
            firstName: firebaseUser.firstName,
            lastName: firebaseUser.lastName,
            facilityName: firebaseUser.facilityName,
            tickets: firebaseUser.tickets,
            pin: firebaseUser.pin
          }
        });
        
        dispatch({
          type: 'LOGIN_USER',
          payload: { firstName, lastName, facilityName, pin }
        });
        
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
        return;
      }

      // No user found
      setMessage("Invalid credentials. Please check your information.");

    } catch (error) {
      console.error('Login error:', error);
      setMessage("Login failed. Please try again.");
    }
  };

  return (
    <div style={{ padding: '40px', maxWidth: '400px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px', color: '#333' }}>Welcome to TicketToss</h1>
      <p style={{ textAlign: 'center', marginBottom: '30px', color: '#666' }}>
        Please enter your first name, last name, facility name, and PIN to access the auction.
      </p>
      
      {message && (
        <div style={{ 
          padding: '10px', 
          marginBottom: '20px', 
          backgroundColor: '#e3f2fd', 
          border: '1px solid #2196f3',
          borderRadius: '4px',
          color: '#1976d2'
        }}>
          {message}
        </div>
      )}

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>First Name:</label>
        <input
          type="text"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          placeholder="Enter your first name"
          style={{ 
            width: '100%', 
            padding: '12px', 
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '16px'
          }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Last Name:</label>
        <input
          type="text"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          placeholder="Enter your last name"
          style={{ 
            width: '100%', 
            padding: '12px', 
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '16px'
          }}
        />
      </div>

      <div style={{ marginBottom: '15px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Facility Name:</label>
        <input
          type="text"
          value={facilityName}
          onChange={(e) => setFacilityName(e.target.value)}
          placeholder="Enter your facility name"
          style={{ 
            width: '100%', 
            padding: '12px', 
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '16px'
          }}
        />
      </div>

      <div style={{ marginBottom: '20px' }}>
        <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>PIN:</label>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          placeholder="Enter your PIN"
          style={{ 
            width: '100%', 
            padding: '12px', 
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '16px'
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
          cursor: 'pointer',
          fontWeight: 'bold'
        }}
      >
        🔐 Log In
      </button>

      <div style={{ marginTop: '30px', fontSize: '12px', color: '#666', backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '4px' }}>
        <p style={{ margin: '0 0 10px 0', fontWeight: 'bold' }}>Test Credentials:</p>
        <p style={{ margin: '5px 0' }}><strong>Admin:</strong> Admin / User / Admin Office / admin123</p>
        <p style={{ margin: '5px 0' }}><strong>Developer:</strong> Developer / Admin / Dev Office / dev456</p>
        <p style={{ margin: '5px 0' }}><strong>Firebase User:</strong> John / Doe / Main Office / 1234</p>
      </div>
    </div>
  );
}
