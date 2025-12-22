"use client";

export default function ClientEnvCheck() {
  // These values are baked into the JavaScript at BUILD time
  const buildTimeVars = {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>CLIENT-SIDE Environment Check</h1>
      <p style={{ color: 'red', fontWeight: 'bold' }}>
        This is a CLIENT component - values are baked into JavaScript at BUILD time
      </p>
      <p>These are the ACTUAL values in the bundled JavaScript that runs in your browser.</p>

      <h2>Environment Variables (from client bundle):</h2>
      <table border={1} cellPadding={10}>
        <thead>
          <tr>
            <th>Variable Name</th>
            <th>Status</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(buildTimeVars).map(([key, value]) => (
            <tr key={key}>
              <td>{key}</td>
              <td style={{
                color: value ? 'green' : 'red',
                fontWeight: 'bold'
              }}>
                {value ? '✓ SET' : '✗ MISSING (undefined in bundle)'}
              </td>
              <td style={{
                maxWidth: '400px',
                overflow: 'auto',
                color: value ? 'black' : 'red'
              }}>
                {value || 'undefined'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Diagnostics:</h2>
      <pre style={{ background: '#f0f0f0', padding: '10px' }}>
        {JSON.stringify({
          allVarsPresent: Object.values(buildTimeVars).every(v => v !== undefined),
          missingVars: Object.entries(buildTimeVars)
            .filter(([, v]) => !v)
            .map(([k]) => k),
          issue: Object.values(buildTimeVars).every(v => v !== undefined)
            ? "All vars present in client bundle"
            : "Env vars NOT baked into client bundle at build time"
        }, null, 2)}
      </pre>

      <h2>Explanation:</h2>
      <p>
        If you see MISSING values here but /env-check shows them as SET, it means:
        <br />
        - Environment variables ARE configured in Vercel ✅
        <br />
        - But they were NOT available during the build process ❌
        <br />
        - Next.js could not inject them into the client-side JavaScript bundles
      </p>
    </div>
  );
}
