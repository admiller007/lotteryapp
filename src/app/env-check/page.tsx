export default function EnvCheck() {
  // These will be replaced at BUILD time by Next.js
  const envVars = {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    NODE_ENV: process.env.NODE_ENV,
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>Environment Variables Check</h1>
      <p>This page shows what environment variables were baked into the build at BUILD TIME.</p>
      <p>Build time: {new Date().toISOString()}</p>

      <h2>NEXT_PUBLIC_* Environment Variables:</h2>
      <table border={1} cellPadding={10}>
        <thead>
          <tr>
            <th>Variable Name</th>
            <th>Status</th>
            <th>Value (first 10 chars)</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(envVars).map(([key, value]) => (
            <tr key={key}>
              <td>{key}</td>
              <td style={{
                color: value ? 'green' : 'red',
                fontWeight: 'bold'
              }}>
                {value ? '✓ SET' : '✗ MISSING'}
              </td>
              <td>{value ? String(value).substring(0, 10) + '...' : 'undefined'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Diagnostics:</h2>
      <pre>{JSON.stringify({
        allVarsPresent: Object.values(envVars).every(v => v !== undefined),
        missingVars: Object.entries(envVars)
          .filter(([, v]) => !v)
          .map(([k]) => k),
        buildTime: 'Check page source to see when this was built'
      }, null, 2)}</pre>
    </div>
  );
}
