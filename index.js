const { Octokit: OctokitCore } = require("@octokit/core");
const { paginateRest } = require("@octokit/plugin-paginate-rest");
const { throttling } = require("@octokit/plugin-throttling");

const { name, version } = require("./package.json");

const Octokit = OctokitCore.plugin(paginateRest, throttling).defaults({
  userAgent: [name, version].join("/"),
  throttle: {
    onAbuseLimit: (error, options) => {
      octokit.log.error("onAbuseLimit", error, options);
    },
    onRateLimit: (error, options) => {
      octokit.log.error("onRateLimit", error, options);
    },
  },
});

run(process.argv[2] === "remove").catch(console.error);

async function run(doRemove) {
  if (!process.env.GITHUB_TOKEN) throw new Error("GITHUB_TOKEN must be set");

  const octokit = new Octokit({
    auth: process.env.GITHUB_TOKEN,
  });

  // find JavaScript / TypeScript repositories
  console.log("Finding repositories ...");
  const repositories = await octokit.paginate("/search/repositories", {
    q: "org:octokit language:JavaScript language:TypeScript",
  });

  for (const repository of repositories) {
    // ignore archived repositories
    if (repository.archived) continue;

    const owner = repository.owner.login;
    const repo = repository.name;

    console.log("- %s", repository.html_url);

    // get current topics
    const {
      data: { names: topics },
    } = await octokit.request("GET /repos/{owner}/{repo}/topics", {
      owner,
      repo,
      mediaType: {
        previews: ["mercy"],
      },
    });

    console.log("  current topics: %s", topics.join(", ") || "<none>");

    // set topics including "hacktoberfest"
    await octokit.request("PUT /repos/{owner}/{repo}/topics", {
      owner,
      repo,
      names: doRemove
        ? topics.filter((name) => name !== "hacktoberfest")
        : topics.concat("hacktoberfest"),
      mediaType: {
        previews: ["mercy"],
      },
    });

    console.log("  'hacktoberfest' topic %s", doRemove ? "removed" : "added");
  }
}
