const env = process.env;
const LOCAL_ORIGIN = "http://localhost:3000";

// OIDC config for react-oidc-context
export const OIDC_CONFIG = {
  authority: env.REACT_APP_COGNITO_AUTHORITY || "", // https://cognito-idp.<region>.amazonaws.com/<userPoolId>
  client_id: env.REACT_APP_COGNITO_CLIENT_ID || "", // your app client id
  redirect_uri: env.REACT_APP_OIDC_REDIRECT_URI || LOCAL_ORIGIN, // must match callback URL in Cognito
  response_type: "code",
  scope: env.REACT_APP_OIDC_SCOPE || "openid email profile",
};

// Your Cognito domain (for logout)
export const COGNITO_DOMAIN = env.REACT_APP_COGNITO_DOMAIN || "";
// e.g. https://my-domain.auth.eu-central-1.amazoncognito.com
// You can find it in the Cognito User Pool console under "Managed Login" > "Domain".

// Logout redirect (must be in allowed logout URLs)
export const LOGOUT_URI = env.REACT_APP_LOGOUT_URI || LOCAL_ORIGIN;

// Express backend
export const API_BASE = env.REACT_APP_API_BASE || "http://localhost:3001";
