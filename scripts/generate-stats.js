// Busca stats reais do GitHub via GraphQL e gera um SVG estilo "metric row"
// Roda dentro do GitHub Actions, usando METRICS_TOKEN como autenticação.

const https = require("https");

const USERNAME = "brsenax";
const TOKEN = process.env.METRICS_TOKEN;

if (!TOKEN) {
  console.error("METRICS_TOKEN não definido.");
  process.exit(1);
}

function graphql(query) {
  const data = JSON.stringify({ query });
  const options = {
    hostname: "api.github.com",
    path: "/graphql",
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `bearer ${TOKEN}`,
      "User-Agent": "stats-script",
      "Content-Length": Buffer.byteLength(data),
    },
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const query = `
  {
    user(login: "${USERNAME}") {
      repositories(first: 100, ownerAffiliations: OWNER, isFork: false) {
        totalCount
        nodes { stargazerCount }
      }
      contributionsCollection {
        totalCommitContributions
        contributionCalendar {
          totalContributions
        }
      }
      followers { totalCount }
    }
  }`;

  const res = await graphql(query);

  if (res.errors) {
    console.error(JSON.stringify(res.errors, null, 2));
    process.exit(1);
  }

  const user = res.data.user;
  const totalStars = user.repositories.nodes.reduce(
    (sum, r) => sum + r.stargazerCount,
    0
  );
  const totalRepos = user.repositories.totalCount;
  const totalCommits = user.contributionsCollection.contributionCalendar.totalContributions;
  const followers = user.followers.totalCount;

  const metrics = [
    { label: "stars", value: totalStars },
    { label: "repos", value: totalRepos },
    { label: "commits (ano)", value: totalCommits },
    { label: "seguidores", value: followers },
  ];

  const cardWidth = 150;
  const cardHeight = 90;
  const gap = 14;
  const totalWidth = cardWidth * metrics.length + gap * (metrics.length - 1);
  const totalHeight = cardHeight;

  const cards = metrics
    .map((m, i) => {
      const x = i * (cardWidth + gap);
      return `
    <g transform="translate(${x}, 0)">
      <rect width="${cardWidth}" height="${cardHeight}" rx="12"
        fill="var(--surface-1, #f4f4f2)" stroke="var(--border, #e4e3de)" stroke-width="1"/>
      <text x="${cardWidth / 2}" y="38" text-anchor="middle"
        font-family="-apple-system, Segoe UI, Helvetica, Arial, sans-serif"
        font-size="26" font-weight="600" fill="var(--text-primary, #1a1a18)">${m.value}</text>
      <text x="${cardWidth / 2}" y="62" text-anchor="middle"
        font-family="-apple-system, Segoe UI, Helvetica, Arial, sans-serif"
        font-size="12" fill="var(--text-secondary, #6b6a64)">${m.label}</text>
    </g>`;
    })
    .join("");

  const svg = `<svg width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" xmlns="http://www.w3.org/2000/svg">
  <style>
    :root { --surface-1: #f4f4f2; --border: #e4e3de; --text-primary: #1a1a18; --text-secondary: #6b6a64; }
    @media (prefers-color-scheme: dark) {
      :root { --surface-1: #26262a; --border: #3a3a3f; --text-primary: #f2f2f0; --text-secondary: #a3a2a0; }
    }
  </style>
  ${cards}
</svg>`;

  require("fs").writeFileSync("github-metrics.svg", svg);
  console.log("SVG gerado com sucesso.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
