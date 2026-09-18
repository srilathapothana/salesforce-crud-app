require("dotenv").config();
const express = require("express");
const session = require("express-session");
const cors = require("cors");
const axios = require("axios");
const path = require("path");
const crypto = require("crypto");
const { OBJECT_CONFIG, ALLOWED_OBJECTS } = require("./objectConfig");

const {
  SF_CLIENT_ID,
  SF_CLIENT_SECRET,
  SF_REDIRECT_URI,
  SF_LOGIN_URL,
  SESSION_SECRET,
  CLIENT_URL,
  PORT = 5000,
  NODE_ENV = "development"
} = process.env;

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: NODE_ENV === "production" ? true : CLIENT_URL,
    credentials: true
  })
);

app.set("trust proxy", 1);
app.use(
  session({
    secret: SESSION_SECRET || "dev-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: NODE_ENV === "production",
      sameSite: NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 2 // 2 hours
    }
  })
);

// ---------- Auth helpers ----------

function requireAuth(req, res, next) {
  if (!req.session.sfAuth) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  next();
}

function sfApi(req) {
  const { accessToken, instanceUrl } = req.session.sfAuth;
  return axios.create({
    baseURL: `${instanceUrl}/services/data/v59.0`,
    headers: { Authorization: `Bearer ${accessToken}` }
  });
}

// If a Salesforce call fails with 401, try once to refresh the access token
async function sfApiWithRefresh(req, requestFn) {
  try {
    return await requestFn(sfApi(req));
  } catch (err) {
    const status = err.response && err.response.status;
    const refreshToken = req.session.sfAuth && req.session.sfAuth.refreshToken;
    if (status === 401 && refreshToken) {
      const tokenRes = await axios.post(
        `${SF_LOGIN_URL}/services/oauth2/token`,
        new URLSearchParams({
          grant_type: "refresh_token",
          client_id: SF_CLIENT_ID,
          client_secret: SF_CLIENT_SECRET,
          refresh_token: refreshToken
        })
      );
      req.session.sfAuth.accessToken = tokenRes.data.access_token;
      // Refresh Token Rotation is enabled on the External Client App, so
      // Salesforce issues a new refresh token on every refresh call and
      // invalidates the old one - we must store it or the next refresh fails.
      if (tokenRes.data.refresh_token) {
        req.session.sfAuth.refreshToken = tokenRes.data.refresh_token;
      }
      return await requestFn(sfApi(req));
    }
    throw err;
  }
}

// ---------- OAuth routes ----------

// Salesforce External Client Apps now require PKCE on the Authorization
// Code flow, so we generate a verifier/challenge pair per login attempt and
// stash the verifier in the session until the callback needs it.
function base64url(buffer) {
  return buffer.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

app.get("/auth/login", (req, res) => {
  const codeVerifier = base64url(crypto.randomBytes(32));
  const codeChallenge = base64url(crypto.createHash("sha256").update(codeVerifier).digest());
  req.session.pkceVerifier = codeVerifier;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: SF_CLIENT_ID,
    redirect_uri: SF_REDIRECT_URI,
    scope: "api refresh_token offline_access",
    code_challenge: codeChallenge,
    code_challenge_method: "S256"
  });
  res.redirect(`${SF_LOGIN_URL}/services/oauth2/authorize?${params.toString()}`);
});

app.get("/auth/callback", async (req, res) => {
  const { code, error, error_description } = req.query;
  if (error) {
    return res.status(400).send(`Salesforce OAuth error: ${error} - ${error_description}`);
  }
  const codeVerifier = req.session.pkceVerifier;
  if (!codeVerifier) {
    return res.status(400).send("Missing PKCE verifier - please restart login from /auth/login.");
  }

  try {
    const tokenRes = await axios.post(
      `${SF_LOGIN_URL}/services/oauth2/token`,
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        client_id: SF_CLIENT_ID,
        client_secret: SF_CLIENT_SECRET,
        redirect_uri: SF_REDIRECT_URI,
        code_verifier: codeVerifier
      })
    );

    delete req.session.pkceVerifier;
    req.session.sfAuth = {
      accessToken: tokenRes.data.access_token,
      refreshToken: tokenRes.data.refresh_token,
      instanceUrl: tokenRes.data.instance_url,
      userId: tokenRes.data.id
    };

    // Redirect back to the SPA root (works both in dev and single-service prod)
    res.redirect(NODE_ENV === "production" ? "/" : CLIENT_URL);
  } catch (err) {
    console.error(err.response ? err.response.data : err.message);
    res.status(500).send("OAuth token exchange failed. Check server logs.");
  }
});

app.post("/auth/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/auth/status", (req, res) => {
  if (req.session.sfAuth) {
    res.json({ loggedIn: true, instanceUrl: req.session.sfAuth.instanceUrl });
  } else {
    res.json({ loggedIn: false });
  }
});

// ---------- Object metadata ----------

app.get("/api/objects", requireAuth, (req, res) => {
  const objects = ALLOWED_OBJECTS.map((key) => ({
    name: key,
    label: OBJECT_CONFIG[key].label,
    fields: OBJECT_CONFIG[key].fields
  }));
  res.json(objects);
});

function assertValidObject(objectName, res) {
  if (!ALLOWED_OBJECTS.includes(objectName)) {
    res.status(400).json({ error: `Object '${objectName}' is not supported` });
    return false;
  }
  return true;
}

// ---------- CRUD routes ----------

// READ (paginated): /api/records/Account?offset=0&limit=20
app.get("/api/records/:objectName", requireAuth, async (req, res) => {
  const { objectName } = req.params;
  if (!assertValidObject(objectName, res)) return;

  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const offset = parseInt(req.query.offset, 10) || 0;
  const fieldNames = ["Id", ...OBJECT_CONFIG[objectName].fields.map((f) => f.name)];
  const soql = `SELECT ${fieldNames.join(", ")} FROM ${objectName} ORDER BY CreatedDate DESC LIMIT ${limit} OFFSET ${offset}`;

  try {
    const result = await sfApiWithRefresh(req, (api) =>
      api.get("/query", { params: { q: soql } })
    );
    res.json({
      records: result.data.records,
      totalSize: result.data.totalSize,
      hasMore: offset + result.data.records.length < result.data.totalSize
    });
  } catch (err) {
    handleSfError(err, res);
  }
});

// CREATE
app.post("/api/records/:objectName", requireAuth, async (req, res) => {
  const { objectName } = req.params;
  if (!assertValidObject(objectName, res)) return;

  try {
    const result = await sfApiWithRefresh(req, (api) =>
      api.post(`/sobjects/${objectName}`, req.body)
    );
    res.status(201).json(result.data);
  } catch (err) {
    handleSfError(err, res);
  }
});

// UPDATE
app.patch("/api/records/:objectName/:id", requireAuth, async (req, res) => {
  const { objectName, id } = req.params;
  if (!assertValidObject(objectName, res)) return;

  try {
    await sfApiWithRefresh(req, (api) =>
      api.patch(`/sobjects/${objectName}/${id}`, req.body)
    );
    res.json({ ok: true });
  } catch (err) {
    handleSfError(err, res);
  }
});

// DELETE
app.delete("/api/records/:objectName/:id", requireAuth, async (req, res) => {
  const { objectName, id } = req.params;
  if (!assertValidObject(objectName, res)) return;

  try {
    await sfApiWithRefresh(req, (api) => api.delete(`/sobjects/${objectName}/${id}`));
    res.json({ ok: true });
  } catch (err) {
    handleSfError(err, res);
  }
});

// Single record (used by the "View" button)
app.get("/api/records/:objectName/:id", requireAuth, async (req, res) => {
  const { objectName, id } = req.params;
  if (!assertValidObject(objectName, res)) return;
  const fieldNames = ["Id", ...OBJECT_CONFIG[objectName].fields.map((f) => f.name)];

  try {
    const result = await sfApiWithRefresh(req, (api) =>
      api.get(`/sobjects/${objectName}/${id}`, { params: { fields: fieldNames.join(",") } })
    );
    res.json(result.data);
  } catch (err) {
    handleSfError(err, res);
  }
});

function handleSfError(err, res) {
  console.error(err.response ? JSON.stringify(err.response.data) : err.message);
  const status = (err.response && err.response.status) || 500;
  const body = (err.response && err.response.data) || { message: err.message };
  res.status(status).json({ error: body });
}

// ---------- Serve the built React app in production ----------

if (NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "..", "client", "dist");
  app.use(express.static(clientDist));
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT} (${NODE_ENV})`);
});
