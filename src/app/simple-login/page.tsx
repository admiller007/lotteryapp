export default function SimpleLogin() {
  return (
    <div style={{ padding: '40px', maxWidth: '400px', margin: '0 auto' }}>
      <h1>Simple Login</h1>
      <form action="/admin" method="get">
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="firstName" style={{ display: 'block', marginBottom: '5px' }}>
            First Name:
          </label>
          <input
            type="text"
            id="firstName"
            name="firstName"
            style={{ 
              width: '100%', 
              padding: '8px', 
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="lastName" style={{ display: 'block', marginBottom: '5px' }}>
            Last Name:
          </label>
          <input
            type="text"
            id="lastName"
            name="lastName"
            style={{ 
              width: '100%', 
              padding: '8px', 
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="facilityName" style={{ display: 'block', marginBottom: '5px' }}>
            Facility Name:
          </label>
          <input
            type="text"
            id="facilityName"
            name="facilityName"
            style={{ 
              width: '100%', 
              padding: '8px', 
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
        </div>
        
        <div style={{ marginBottom: '20px' }}>
          <label htmlFor="pin" style={{ display: 'block', marginBottom: '5px' }}>
            PIN:
          </label>
          <input
            type="password"
            id="pin"
            name="pin"
            style={{ 
              width: '100%', 
              padding: '8px', 
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
        </div>
        
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#0070f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Login (Go to Admin)
        </button>
      </form>
      
      <br />
      
      <form action="/" method="get">
        <button
          type="submit"
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            fontSize: '16px',
            cursor: 'pointer'
          }}
        >
          Go to Main Page
        </button>
      </form>
    </div>
  );
}