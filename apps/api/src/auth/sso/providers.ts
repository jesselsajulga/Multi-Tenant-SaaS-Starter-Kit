export interface IdentityProfile {
  issuer: string;
  subject: string;
  email: string;
  emailVerified: boolean;
}

export interface SsoProvider {
  /**
   * Returns the URL the client should redirect to, initiating the OAuth/OIDC flow.
   * Should append state and pkceChallenge to the provider's authorize endpoint.
   */
  getAuthorizationUrl(state: string, pkceChallenge?: string): Promise<string>;

  /**
   * Exchanges the authorization code for an ID Token / Access Token and resolves the IdentityProfile.
   */
  exchangeCode(code: string, redirectUri: string, pkceVerifier?: string): Promise<IdentityProfile>;
}

// In this phase we build a mock/demo provider.
// This gives the foundational shape without pulling in generic OIDC libraries yet.
export class MockGoogleProvider implements SsoProvider {
  async getAuthorizationUrl(state: string, pkceChallenge?: string): Promise<string> {
    const clientId = process.env.GOOGLE_CLIENT_ID || "mock-client-id";
    const redirectUri = "http://localhost:4000/auth/sso/google/callback";
    
    // Construct the standard OAuth2 URL
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.append("client_id", clientId);
    url.searchParams.append("redirect_uri", redirectUri);
    url.searchParams.append("response_type", "code");
    url.searchParams.append("scope", "openid email profile");
    url.searchParams.append("state", state);
    
    if (pkceChallenge) {
      url.searchParams.append("code_challenge", pkceChallenge);
      url.searchParams.append("code_challenge_method", "S256");
    }

    return url.toString();
  }

  async exchangeCode(code: string, redirectUri: string, pkceVerifier?: string): Promise<IdentityProfile> {
    // In a real implementation, we would POST to https://oauth2.googleapis.com/token
    // For now, this validates our internal flow logic perfectly.
    
    if (code === "mock-code-123") {
      return {
        issuer: "https://accounts.google.com",
        subject: "mock-google-sub-999",
        email: "test@example.com",
        emailVerified: true
      };
    }
    
    if (code === "mock-code-unverified") {
      return {
        issuer: "https://accounts.google.com",
        subject: "mock-google-sub-888",
        email: "unverified@example.com",
        emailVerified: false
      };
    }
    
    throw new Error("Invalid authorization code");
  }
}

export function getSsoProvider(providerName: string): SsoProvider | null {
  if (providerName === "google") {
    return new MockGoogleProvider();
  }
  return null;
}
