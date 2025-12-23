"use client";

import { useEffect, useState } from 'react';
import { isFirebaseConfigured, missingVars, requiredEnvVars } from '@/lib/firebase/config';

interface DiagnosticResult {
  step: string;
  status: 'success' | 'error' | 'warning' | 'pending';
  message: string;
  details?: string;
}

export default function FirebaseDebugPage() {
  const [diagnostics, setDiagnostics] = useState<DiagnosticResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  // Environment variable check
  const envVars = {
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };

  const runDiagnostics = async () => {
    setIsRunning(true);
    const results: DiagnosticResult[] = [];

    // Step 1: Check environment variables
    const missingEnvVars = Object.entries(envVars)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (missingEnvVars.length === 0) {
      results.push({
        step: 'Environment Variables',
        status: 'success',
        message: 'All required environment variables are present in the bundle',
        details: `Checked: ${Object.keys(envVars).join(', ')}`
      });
    } else {
      results.push({
        step: 'Environment Variables',
        status: 'error',
        message: `Missing ${missingEnvVars.length} environment variables`,
        details: `Missing: ${missingEnvVars.join(', ')}`
      });
      setDiagnostics(results);
      setIsRunning(false);
      return; // Stop here if env vars are missing
    }

    // Step 2: Check Firebase configuration
    if (isFirebaseConfigured) {
      results.push({
        step: 'Firebase Configuration',
        status: 'success',
        message: 'Firebase configuration object created successfully',
        details: `Project ID: ${envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID}`
      });
    } else {
      results.push({
        step: 'Firebase Configuration',
        status: 'error',
        message: 'Firebase configuration failed',
        details: `Missing: ${missingVars.join(', ')}`
      });
      setDiagnostics(results);
      setIsRunning(false);
      return;
    }

    // Step 3: Test Firebase initialization
    try {
      const { db, auth, storage } = await import('@/lib/firebase');

      // Access a property to trigger the Proxy and initialize Firebase
      const dbType = db.type;

      results.push({
        step: 'Firebase Initialization',
        status: 'success',
        message: 'Firebase services initialized successfully',
        details: 'Firestore, Auth, and Storage are ready'
      });
    } catch (error: any) {
      results.push({
        step: 'Firebase Initialization',
        status: 'error',
        message: 'Firebase initialization failed',
        details: error.message
      });
      setDiagnostics(results);
      setIsRunning(false);
      return;
    }

    // Step 4: Test Firestore connection
    try {
      const { collection, getDocs } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');

      const usersRef = collection(db, 'users');
      const snapshot = await getDocs(usersRef);

      results.push({
        step: 'Firestore Connection',
        status: 'success',
        message: 'Successfully connected to Firestore',
        details: `Found ${snapshot.size} documents in 'users' collection`
      });
    } catch (error: any) {
      let errorDetails = error.message;
      if (error.code === 'permission-denied') {
        errorDetails = 'Permission denied - Check Firestore security rules';
      } else if (error.code === 'unavailable') {
        errorDetails = 'Network error - Cannot reach Firestore';
      }

      results.push({
        step: 'Firestore Connection',
        status: 'error',
        message: 'Failed to connect to Firestore',
        details: errorDetails
      });
    }

    // Step 5: Test data loading
    try {
      const { getPrizes } = await import('@/lib/firebaseService');
      const prizes = await getPrizes();

      results.push({
        step: 'Data Loading',
        status: 'success',
        message: 'Successfully loaded data from Firebase',
        details: `Loaded ${prizes.length} prizes`
      });
    } catch (error: any) {
      results.push({
        step: 'Data Loading',
        status: 'error',
        message: 'Failed to load data',
        details: error.message
      });
    }

    setDiagnostics(results);
    setIsRunning(false);
  };

  useEffect(() => {
    runDiagnostics();
  }, []);

  const getStatusIcon = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'pending':
        return '⏳';
      default:
        return '•';
    }
  };

  const getStatusColor = (status: DiagnosticResult['status']) => {
    switch (status) {
      case 'success':
        return '#22c55e';
      case 'error':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'pending':
        return '#6b7280';
      default:
        return '#000';
    }
  };

  const allSuccess = diagnostics.every(d => d.status === 'success');
  const hasErrors = diagnostics.some(d => d.status === 'error');

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace', maxWidth: '900px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', marginBottom: '10px' }}>🔥 Firebase Diagnostics</h1>
      <p style={{ color: '#6b7280', marginBottom: '30px' }}>
        Real-time Firebase connection and configuration testing
      </p>

      {/* Summary Banner */}
      {!isRunning && diagnostics.length > 0 && (
        <div style={{
          padding: '20px',
          marginBottom: '30px',
          borderRadius: '8px',
          backgroundColor: allSuccess ? '#dcfce7' : hasErrors ? '#fee2e2' : '#fef3c7',
          border: `2px solid ${allSuccess ? '#22c55e' : hasErrors ? '#ef4444' : '#f59e0b'}`
        }}>
          <h2 style={{
            fontSize: '18px',
            margin: '0 0 10px 0',
            color: allSuccess ? '#15803d' : hasErrors ? '#991b1b' : '#92400e'
          }}>
            {allSuccess ? '✅ All Systems Operational' : hasErrors ? '❌ Issues Detected' : '⚠️ Warnings'}
          </h2>
          <p style={{ margin: 0, color: '#374151' }}>
            {allSuccess
              ? 'Firebase is properly configured and all connections are working.'
              : 'There are issues preventing Firebase from working correctly. See details below.'}
          </p>
        </div>
      )}

      {/* Diagnostic Steps */}
      <div style={{ marginBottom: '30px' }}>
        {diagnostics.map((result, index) => (
          <div
            key={index}
            style={{
              padding: '20px',
              marginBottom: '15px',
              border: '1px solid #e5e7eb',
              borderRadius: '8px',
              backgroundColor: '#fff'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '24px', marginRight: '10px' }}>
                {getStatusIcon(result.status)}
              </span>
              <h3 style={{ margin: 0, fontSize: '16px', flex: 1 }}>
                Step {index + 1}: {result.step}
              </h3>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '12px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  backgroundColor: result.status === 'success' ? '#dcfce7' : '#fee2e2',
                  color: getStatusColor(result.status)
                }}
              >
                {result.status.toUpperCase()}
              </span>
            </div>
            <p style={{ margin: '10px 0', color: '#374151' }}>{result.message}</p>
            {result.details && (
              <pre style={{
                margin: '10px 0 0 0',
                padding: '10px',
                backgroundColor: '#f3f4f6',
                borderRadius: '4px',
                fontSize: '12px',
                overflow: 'auto'
              }}>
                {result.details}
              </pre>
            )}
          </div>
        ))}

        {isRunning && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>⏳</div>
            <p>Running diagnostics...</p>
          </div>
        )}
      </div>

      {/* Environment Variables Table */}
      <h2 style={{ fontSize: '18px', marginBottom: '15px', marginTop: '40px' }}>
        Environment Variables (Build Time)
      </h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f3f4f6' }}>
            <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #e5e7eb' }}>
              Variable
            </th>
            <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #e5e7eb' }}>
              Status
            </th>
            <th style={{ padding: '12px', textAlign: 'left', border: '1px solid #e5e7eb' }}>
              Value
            </th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(envVars).map(([key, value]) => (
            <tr key={key}>
              <td style={{ padding: '12px', border: '1px solid #e5e7eb', fontSize: '12px' }}>
                {key}
              </td>
              <td style={{
                padding: '12px',
                border: '1px solid #e5e7eb',
                color: value ? '#22c55e' : '#ef4444',
                fontWeight: 'bold'
              }}>
                {value ? '✓ SET' : '✗ MISSING'}
              </td>
              <td style={{
                padding: '12px',
                border: '1px solid #e5e7eb',
                fontSize: '12px',
                maxWidth: '300px',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
                {value ? `${String(value).substring(0, 20)}...` : 'undefined'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Troubleshooting Guide */}
      {hasErrors && (
        <div style={{
          padding: '20px',
          backgroundColor: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px'
        }}>
          <h2 style={{ fontSize: '18px', marginTop: 0 }}>💡 Troubleshooting</h2>
          <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
            <li>Check that all environment variables are set in Vercel Dashboard</li>
            <li>Redeploy with build cache disabled: Deployments → Redeploy (uncheck cache)</li>
            <li>Verify environment variables are enabled for this deployment environment</li>
            <li>Check that values are from the correct Firebase project</li>
            <li>Review Firestore security rules if getting permission errors</li>
          </ul>
        </div>
      )}

      <div style={{ marginTop: '40px', padding: '20px', backgroundColor: '#f3f4f6', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '18px', marginTop: 0 }}>Quick Links</h2>
        <ul style={{ margin: 0, paddingLeft: '20px' }}>
          <li><a href="/env-check" style={{ color: '#2563eb' }}>Server-side env check</a></li>
          <li><a href="/client-env-check" style={{ color: '#2563eb' }}>Client-side env check</a></li>
          <li><a href="/" style={{ color: '#2563eb' }}>Back to Home</a></li>
        </ul>
      </div>

      <button
        onClick={runDiagnostics}
        disabled={isRunning}
        style={{
          marginTop: '20px',
          padding: '12px 24px',
          backgroundColor: isRunning ? '#9ca3af' : '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: isRunning ? 'not-allowed' : 'pointer',
          fontSize: '14px',
          fontWeight: 'bold'
        }}
      >
        {isRunning ? 'Running...' : 'Run Diagnostics Again'}
      </button>
    </div>
  );
}
