import React, { useEffect, useState } from "react";
import { useAuth } from "react-oidc-context";
import { API_BASE, COGNITO_DOMAIN, LOGOUT_URI, OIDC_CONFIG } from "./config";
import "./App.css";

const CHART_WIDTH = 680;
const CHART_HEIGHT = 260;
const CHART_PADDING = 36;

const toKwhNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
};

const formatKwh = (value) => `${Number(value || 0).toFixed(2)} kWh`;

const sampleEvenly = (items, maxItems) => {
  if (items.length <= maxItems) return items;
  if (maxItems <= 1) return [items[0]];

  return Array.from({ length: maxItems }, (_, index) => {
    const sourceIndex = Math.round((index * (items.length - 1)) / (maxItems - 1));
    return items[sourceIndex];
  });
};

const formatChartDateTime = (timestamp) => {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp || "-";
  }

  return date.toLocaleString("ro-RO", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
  });
};

const formatChartDay = (timestamp) => {
  const date = new Date(timestamp);

  if (Number.isNaN(date.getTime())) {
    return timestamp || "-";
  }

  return date.toLocaleDateString("ro-RO", {
    month: "short",
    day: "2-digit",
  });
};

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function LineChart({ title, subtitle, data }) {
  if (!data.length) {
    return (
      <div className="chart-card">
        <h3>{title}</h3>
        <p className="muted">No chart data available.</p>
      </div>
    );
  }

  const values = data.map((item) => item.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;

  const points = data.map((item, index) => {
    const x =
      data.length === 1
        ? CHART_WIDTH / 2
        : CHART_PADDING +
        (index * (CHART_WIDTH - CHART_PADDING * 2)) / (data.length - 1);

    const y =
      CHART_HEIGHT -
      CHART_PADDING -
      ((item.value - minValue) / range) * (CHART_HEIGHT - CHART_PADDING * 2);

    return {
      ...item,
      x,
      y,
    };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const areaPath = `${linePath} L ${points[points.length - 1].x} ${
    CHART_HEIGHT - CHART_PADDING
  } L ${points[0].x} ${CHART_HEIGHT - CHART_PADDING} Z`;

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <span>{formatKwh(maxValue)} max</span>
      </div>

      <svg className="line-chart" viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
        <line
          className="chart-axis"
          x1={CHART_PADDING}
          y1={CHART_HEIGHT - CHART_PADDING}
          x2={CHART_WIDTH - CHART_PADDING}
          y2={CHART_HEIGHT - CHART_PADDING}
        />
        <line
          className="chart-axis"
          x1={CHART_PADDING}
          y1={CHART_PADDING}
          x2={CHART_PADDING}
          y2={CHART_HEIGHT - CHART_PADDING}
        />

        {[0.25, 0.5, 0.75].map((ratio) => {
          const y =
            CHART_HEIGHT -
            CHART_PADDING -
            ratio * (CHART_HEIGHT - CHART_PADDING * 2);

          return (
            <line
              key={ratio}
              className="chart-grid-line"
              x1={CHART_PADDING}
              y1={y}
              x2={CHART_WIDTH - CHART_PADDING}
              y2={y}
            />
          );
        })}

        <path className="chart-area" d={areaPath} />
        <path className="chart-line" d={linePath} />

        {points.map((point, index) => (
          <circle
            key={`${point.label}-${index}`}
            className="chart-point"
            cx={point.x}
            cy={point.y}
            r="4"
          >
            <title>
              {point.label}: {formatKwh(point.value)}
            </title>
          </circle>
        ))}
      </svg>

      <div className="chart-axis-labels">
        <span>{data[0].label}</span>
        <span>{data[data.length - 1].label}</span>
      </div>
    </div>
  );
}

function BarChart({ title, subtitle, data }) {
  if (!data.length) {
    return (
      <div className="chart-card">
        <h3>{title}</h3>
        <p className="muted">No chart data available.</p>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="chart-card">
      <div className="chart-head">
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <span>{data.length} groups</span>
      </div>

      <div className="bar-chart">
        {data.map((item) => (
          <div className="bar-row" key={item.label}>
            <div className="bar-label" title={item.label}>
              {item.label}
            </div>

            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${Math.max((item.value / maxValue) * 100, 4)}%`,
                }}
              />
            </div>

            <div className="bar-value">{formatKwh(item.value)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function App() {
  const auth = useAuth();

  const [profile, setProfile] = useState(null);
  const [dataResponse, setDataResponse] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState(null);
  const [showToken, setShowToken] = useState(false);
  const [copied, setCopied] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  const idToken = auth.user?.id_token;

  const ROWS_PER_PAGE = 15;

  const formatHeader = (key) =>
    key.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

  const tableRows = dataResponse?.data || [];
  const totalPages = Math.max(1, Math.ceil(tableRows.length / ROWS_PER_PAGE));
  const paginatedRows = tableRows.slice(
    (currentPage - 1) * ROWS_PER_PAGE,
    currentPage * ROWS_PER_PAGE
  );

  const totalKwh = tableRows.reduce((sum, row) => sum + toKwhNumber(row.kwh), 0);
  const averageKwh = tableRows.length ? totalKwh / tableRows.length : 0;

  const uniqueDevices = new Set(tableRows.map((row) => row.device_id).filter(Boolean)).size;
  const uniqueLocations = new Set(tableRows.map((row) => row.location).filter(Boolean)).size;

  const trendData = sampleEvenly(
    Object.values(
      tableRows.reduce((acc, row) => {
        const timestamp = row.timestamp || "Unknown";
        const date = new Date(timestamp);
        const sortValue = Number.isNaN(date.getTime()) ? 0 : date.getTime();

        if (!acc[timestamp]) {
          acc[timestamp] = {
            label: formatChartDateTime(timestamp),
            value: 0,
            sortValue,
          };
        }

        acc[timestamp].value += toKwhNumber(row.kwh);
        return acc;
      }, {})
    )
      .sort((a, b) => a.sortValue - b.sortValue)
      .map((item) => ({
        ...item,
        value: Number(item.value.toFixed(3)),
      })),
    40
  );

  const barDataRaw = Object.values(
    tableRows.reduce((acc, row) => {
      const isAdmin = dataResponse?.role === "admin";

      const date = new Date(row.timestamp);
      const dayKey = Number.isNaN(date.getTime())
        ? row.timestamp || "Unknown"
        : date.toISOString().slice(0, 10);

      const key = isAdmin ? row.device_id || "Unknown device" : dayKey;
      const label = isAdmin ? row.device_id || "Unknown device" : formatChartDay(row.timestamp);

      if (!acc[key]) {
        acc[key] = {
          label,
          value: 0,
          sortValue: Number.isNaN(date.getTime()) ? 0 : date.getTime(),
        };
      }

      acc[key].value += toKwhNumber(row.kwh);
      return acc;
    }, {})
  ).map((item) => ({
    ...item,
    value: Number(item.value.toFixed(3)),
  }));

  const barData =
    dataResponse?.role === "admin"
      ? barDataRaw.sort((a, b) => b.value - a.value).slice(0, 12)
      : barDataRaw.sort((a, b) => a.sortValue - b.sortValue).slice(0, 14);

  const barChartTitle = dataResponse?.role === "admin" ? "Total kWh by Device" : "Daily kWh Usage";

  const barChartSubtitle =
    dataResponse?.role === "admin"
      ? "Top devices by total energy consumption"
      : "Daily consumption for your assigned device";

  // Call backend when we have an idToken
  useEffect(() => {
    if (!idToken) {
      setProfile(null);
      setDataResponse(null);
      setCurrentPage(1);
      return;
    }

    setError(null);

    // /api/profile
    setLoadingProfile(true);
    fetch(`${API_BASE}/api/profile`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Error calling /api/profile");
        return res.json();
      })
      .then((data) => setProfile(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoadingProfile(false));

    // /api/data
    setLoadingData(true);
    fetch(`${API_BASE}/api/data`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error("Error calling /api/data");
        return res.json();
      })
      .then((data) => {
        setDataResponse(data);
        setCurrentPage(1);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingData(false));
  }, [idToken]);

  const signOutRedirect = () => {
    const clientId = OIDC_CONFIG.client_id;
    const logoutUri = LOGOUT_URI;
    const cognitoDomain = COGNITO_DOMAIN;

    // Clear local OIDC user (react-oidc-context)
    auth.removeUser();

    // Redirect to Cognito logout endpoint
    window.location.href =
      `${cognitoDomain}/logout?client_id=${clientId}` +
      `&logout_uri=${encodeURIComponent(logoutUri)}`;
  };

  const copyToken = async () => {
    if (!idToken) return;
    try {
      await navigator.clipboard.writeText(idToken);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch (copyError) {
      setError("Unable to copy token to clipboard.");
    }
  };

  if (auth.isLoading) {
    return (
      <div className="app-shell">
        <div className="status-panel">Loading authentication...</div>
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="app-shell">
        <div className="status-panel status-panel-error">
          Encountering error... {auth.error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="bg-orb bg-orb-left" />
      <div className="bg-orb bg-orb-right" />
      <main className="app">
        <header className="hero">
          <p className="hero-kicker">Identity + Serverless</p>
          <h1>Cloud Computing App</h1>
          <p className="hero-subtitle">
            Secure frontend with Amazon Cognito authentication and Azure Functions APIs.
          </p>
        </header>

        {error && (
          <div className="alert">
            <strong>Error:</strong> {error}
          </div>
        )}

        <section className="card status-card">
          {auth.isAuthenticated ? (
            <>
              <p className="status-line">
                <span className="status-dot status-dot-online" />
                Logged in as <strong>{auth.user?.profile?.email || "(no email claim)"}</strong>
              </p>
              <button className="btn btn-secondary" onClick={signOutRedirect}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <p className="status-line">
                <span className="status-dot" />
                Not logged in
              </p>
              <button className="btn" onClick={() => auth.signinRedirect()}>
                Sign in
              </button>
            </>
          )}
        </section>

        {auth.isAuthenticated && (
          <div className="grid">
            <section className="card">
              <div className="section-head">
                <h2>Authentication Token</h2>
                <div className="actions">
                  <button
                    className="btn btn-small btn-ghost"
                    onClick={() => setShowToken((current) => !current)}
                  >
                    {showToken ? "Hide" : "Show"}
                  </button>
                  <button className="btn btn-small btn-ghost" onClick={copyToken}>
                    {copied ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <pre className="code-block">
                ID Token: {showToken ? auth.user?.id_token : "••••••••••••••••••••"}
              </pre>
            </section>

            <section className="card">
              <h2>User Profile API Response</h2>
              {loadingProfile ? (
                <p className="muted">Loading profile...</p>
              ) : profile ? (
                <pre className="code-block">{JSON.stringify(profile, null, 2)}</pre>
              ) : (
                <p className="muted">No profile loaded yet.</p>
              )}
            </section>

            {dataResponse && tableRows.length > 0 && (
              <section className="card card-wide">
                <div className="section-head">
                  <h2>Energy Usage Charts</h2>
                  <span className="table-count">
                    {dataResponse.role === "admin" ? "Admin overview" : "User overview"}
                  </span>
                </div>

                <div className="stats-grid">
                  <StatCard label="Total usage" value={formatKwh(totalKwh)} />
                  <StatCard label="Average row usage" value={formatKwh(averageKwh)} />
                  <StatCard label="Devices" value={uniqueDevices || "-"} />
                  <StatCard label="Locations" value={uniqueLocations || "-"} />
                </div>

                <div className="charts-grid">
                  <LineChart
                    title="kWh Usage Over Time"
                    subtitle={
                      dataResponse.role === "admin"
                        ? "Aggregated consumption across all visible devices"
                        : "Consumption over time for your device"
                    }
                    data={trendData}
                  />

                  <BarChart title={barChartTitle} subtitle={barChartSubtitle} data={barData} />
                </div>
              </section>
            )}

            <section className="card card-wide">
              <div className="section-head">
                <h2>Data API Response</h2>
                {dataResponse?.data?.length ? (
                  <span className="table-count">
                    {tableRows.length} rows • Page {currentPage} / {totalPages}
                  </span>
                ) : null}
              </div>

              {loadingData ? (
                <p className="muted">Loading data...</p>
              ) : dataResponse ? (
                <div className="table-wrapper">
                  <div className="table-meta">
                    <p>
                      <strong>Role:</strong> {dataResponse.role}
                    </p>
                    <p>
                      <strong>Device ID:</strong> {dataResponse.device_id || "-"}
                    </p>
                  </div>

                  {tableRows.length ? (
                    <>
                      <div className="table-scroll">
                        <table className="data-table">
                          <thead>
                            <tr>
                              {Object.keys(tableRows[0]).map((key) => (
                                <th key={key}>{formatHeader(key)}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedRows.map((row, index) => (
                              <tr key={index}>
                                {Object.entries(row).map(([key, value]) => (
                                  <td key={key}>{value ?? "-"}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="table-pagination">
                        <button
                          className="btn btn-small btn-ghost"
                          onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                          disabled={currentPage === 1}
                        >
                          Previous
                        </button>

                        <span className="pagination-label">
                          Page {currentPage} of {totalPages}
                        </span>

                        <button
                          className="btn btn-small btn-ghost"
                          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                          disabled={currentPage === totalPages}
                        >
                          Next
                        </button>
                      </div>
                    </>
                  ) : (
                    <p className="muted">No rows found.</p>
                  )}
                </div>
              ) : (
                <p className="muted">No data loaded yet.</p>
              )}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
