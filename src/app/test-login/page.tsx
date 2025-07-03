"use client";

export default function TestLogin() {
  const handleLogin = () => {
    alert("Login test successful!");
    window.location.href = '/';
  };

  return (
    <div style={{ padding: '20px', textAlign: 'center' }}>
      <h1>Simple Login Test</h1>
      <button 
        onClick={handleLogin}
        style={{ 
          padding: '10px 20px', 
          fontSize: '16px', 
          backgroundColor: '#0070f3', 
          color: 'white', 
          border: 'none', 
          borderRadius: '5px',
          cursor: 'pointer' 
        }}
      >
        Test Login
      </button>
    </div>
  );
}