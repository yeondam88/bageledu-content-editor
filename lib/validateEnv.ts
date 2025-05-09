/**
 * Environment variable validation helper
 * Validates that required environment variables are set and meet requirements
 */

export function validateEnv() {
  const requiredVars = [
    'NEXTAUTH_SECRET',
    'GOOGLE_CLIENT_ID',
    'GOOGLE_CLIENT_SECRET',
    'GITHUB_OWNER',
    'GITHUB_REPO',
    'GITHUB_TOKEN',
    'OPENAI_API_KEY',
    'DO_SPACES_ENDPOINT',
    'DO_SPACES_BUCKET',
    'DO_SPACES_REGION',
    'DO_SPACES_KEY',
    'DO_SPACES_SECRET'
  ];

  // Track missing variables
  const missingVars: string[] = [];

  // Check for missing variables
  requiredVars.forEach(varName => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  // Additional validation for specific variables
  if (process.env.DO_SPACES_ENDPOINT && !process.env.DO_SPACES_ENDPOINT.startsWith('https://')) {
    console.error('DO_SPACES_ENDPOINT must start with https://');
  }

  if (process.env.GITHUB_TOKEN && process.env.GITHUB_TOKEN.length < 30) {
    console.error('GITHUB_TOKEN appears to be invalid (too short)');
  }

  if (process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('sk-')) {
    console.error('OPENAI_API_KEY appears to be invalid (should start with sk-)');
  }

  // Return validation result
  if (missingVars.length > 0) {
    console.error('Missing required environment variables:', missingVars.join(', '));
    return false;
  }

  return true;
} 