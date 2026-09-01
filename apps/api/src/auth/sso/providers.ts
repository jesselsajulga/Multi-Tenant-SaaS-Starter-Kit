import { OAuth2Client } from "google-auth-library";

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

export class GoogleProvider implements SsoProvider {
  private client: OAuth2Client;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.GOOGLE_CLIENT_ID || "";
    this.clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";

    if (!this.clientId) {
      throw new Error("GOOGLE_CLIENT_ID is required for Google OAuth");
    }
    if (!this.clientSecret) {
      throw new Error("GOOGLE_CLIENT_SECRET is required for Google OAuth");
    }

    this.client = new OAuth2Client({
      clientId: this.clientId,
      clientSecret: this.clientSecret,
    });
  }

  async getAuthorizationUrl(state: string, pkceChallenge?: string): Promise<string> {
    const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:4000/auth/sso/google/callback";
    
    // Construct the standard OAuth2 URL
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.append("client_id", this.clientId);
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
    const redirect = process.env.GOOGLE_REDIRECT_URI || redirectUri;
    
    // 1. Exchange the code at Google's token endpoint
    const { tokens } = await this.client.getToken({
      code,
      redirect_uri: redirect,
      codeVerifier: pkceVerifier,
    });

    if (!tokens.id_token) {
      throw new Error("No ID token returned from Google");
    }

    // 2. Cryptographic verification of the ID Token
    const ticket = await this.client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.clientId,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      throw new Error("Failed to extract ID token payload");
    }

    // 3. Extract verified identity using the stable `sub` claim
    return {
      issuer: payload.iss || "https://accounts.google.com",
      subject: payload.sub,
      email: payload.email || "",
      emailVerified: payload.email_verified || false,
    };
  }
}

// Fail-fast on startup: instantiate the provider so it throws immediately if env vars are missing.
const googleProvider = new GoogleProvider();

export function getSsoProvider(providerName: string): SsoProvider | null {
  if (providerName === "google") {
    return googleProvider;
  }
  return null;
}
